import { createProxyService, registerService } from '@webext-core/proxy-service';
import { SigningRequest } from '@wharfkit/signing-request';
import { abiProviderFor, isSigningRequestUri, zlib, MAX_REQUEST_LENGTH } from '@/lib/antelope/esr';
import { isProviderMethod, type ProviderMethod } from '@/lib/page/provider';
import {
  blockchainsItem,
  connectedSitesItem,
  pendingRequestsItem,
  settingsItem,
} from '@/lib/storage/items';
import {
  settingsSchema,
  type Blockchain,
  type ConnectedSite,
  type PendingRequest,
  type RequestStatus,
} from '@/lib/storage/schemas';
import { requestService, type RequestOutcome } from './request.service';
import { readerFor } from './transaction.service';

export interface LoginResult {
  chainId: string;
  actor: string;
  permission: string;
}

export interface TransactResult {
  chainId: string;
  transactionId?: string;
  blockNum?: number;
  signatures: string[];
}

export interface ProviderService {
  listSites(): Promise<ConnectedSite[]>;
  revoke(origin: string): Promise<void>;
  revokeAll(): Promise<void>;
}

const SERVICE_KEY = 'ProviderService';
const FINAL_STATUSES = new Set<RequestStatus>(['done', 'error', 'cancelled']);
const OUTCOME_TIMEOUT_MS = 5 * 60_000;

async function siteFor(origin: string): Promise<ConnectedSite | undefined> {
  return (await connectedSitesItem.getValue()).find((site) => site.origin === origin);
}

async function rememberSite(site: ConnectedSite): Promise<void> {
  const sites = await connectedSitesItem.getValue();
  const rest = sites.filter((entry) => entry.origin !== site.origin);
  await connectedSitesItem.setValue([...rest, site]);
}

async function touchSite(origin: string): Promise<void> {
  const sites = await connectedSitesItem.getValue();
  const next = sites.map((site) =>
    site.origin === origin ? { ...site, lastUsedAt: Date.now() } : site,
  );
  await connectedSitesItem.setValue(next);
}

async function chainFor(chainId: string | null): Promise<Blockchain> {
  const [chains, settings] = await Promise.all([
    blockchainsItem.getValue(),
    settingsItem.getValue().then((stored) => settingsSchema.parse(stored)),
  ]);
  const enabled = chains.filter((chain) => settings.enabledChains.includes(chain.chainId));
  if (enabled.length === 0) throw new Error('no_chains');
  if (chainId) {
    const match = enabled.find((chain) => chain.chainId === chainId);
    if (!match) throw new Error('unknown_chain');
    return match;
  }
  return enabled.find((chain) => chain.chainId === settings.chainId) ?? enabled[0]!;
}

function outcomeOf(record: PendingRequest): RequestOutcome | undefined {
  return record.outcome as RequestOutcome | undefined;
}

async function waitForOutcome(id: string): Promise<PendingRequest> {
  const settled = (record: PendingRequest | undefined): boolean =>
    record === undefined || FINAL_STATUSES.has(record.status);
  const current = (await pendingRequestsItem.getValue()).find((entry) => entry.id === id);
  if (settled(current)) return current ?? Promise.reject(new Error('rejected'));

  return new Promise<PendingRequest>((resolve, reject) => {
    const finish = (outcome: PendingRequest | undefined): void => {
      clearTimeout(timer);
      unwatch();
      if (outcome) resolve(outcome);
      else reject(new Error('rejected'));
    };
    const timer = setTimeout(() => finish(undefined), OUTCOME_TIMEOUT_MS);
    const unwatch = pendingRequestsItem.watch((requests) => {
      const record = requests.find((entry) => entry.id === id);
      if (settled(record)) finish(record);
    });
  });
}

function resultFrom(record: PendingRequest, chainId: string): TransactResult {
  const outcome = outcomeOf(record);
  if (record.status === 'cancelled') throw new Error('rejected');
  if (!outcome || outcome.status !== 'done') {
    throw new Error(outcome?.status === 'error' ? outcome.error.kind : 'rejected');
  }
  return {
    chainId,
    transactionId: outcome.transactionId,
    blockNum: outcome.blockNum,
    signatures: outcome.signatures,
  };
}

async function run(uri: string, origin: string): Promise<PendingRequest> {
  const { id } = await requestService.open(uri, origin);
  if (!id) throw new Error('requests_disabled');
  return waitForOutcome(id);
}

async function login(origin: string, chainId: unknown): Promise<LoginResult> {
  if (chainId !== undefined && typeof chainId !== 'string') throw new Error('invalid_params');
  const chain = await chainFor(chainId ?? null);
  const request = SigningRequest.createSync({ chainId: chain.chainId, identity: {} }, { zlib });
  const record = await run(request.encode(true, false), origin);
  if (record.status !== 'done' || !record.signer) throw new Error('rejected');
  const site: ConnectedSite = {
    origin,
    chainId: chain.chainId,
    actor: record.signer.account,
    permission: record.signer.authorization,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  };
  await rememberSite(site);
  return { chainId: site.chainId, actor: site.actor, permission: site.permission };
}

function actionsFrom(args: Record<string, unknown>): unknown[] {
  if (Array.isArray(args.actions)) return args.actions;
  if (args.action) return [args.action];
  const transaction = args.transaction as { actions?: unknown } | undefined;
  if (transaction && Array.isArray(transaction.actions)) return transaction.actions;
  throw new Error('invalid_params');
}

function withAuthorization(action: unknown, site: ConnectedSite): unknown {
  if (typeof action !== 'object' || action === null) throw new Error('invalid_params');
  const entry = action as { authorization?: unknown };
  if (Array.isArray(entry.authorization) && entry.authorization.length > 0) return action;
  return { ...entry, authorization: [{ actor: site.actor, permission: site.permission }] };
}

async function transact(origin: string, args: unknown): Promise<TransactResult> {
  const site = await siteFor(origin);
  if (!site) throw new Error('not_connected');
  if (typeof args === 'string') return signRequest(site, origin, args);
  if (typeof args !== 'object' || args === null) throw new Error('invalid_params');

  const input = args as Record<string, unknown>;
  const chain = await chainFor(typeof input.chainId === 'string' ? input.chainId : site.chainId);
  const actions = actionsFrom(input).map((action) => withAuthorization(action, site));
  const request = await SigningRequest.create(
    {
      chainId: chain.chainId,
      actions: actions as Parameters<typeof SigningRequest.create>[0]['actions'],
      broadcast: input.broadcast !== false,
    },
    { zlib, abiProvider: abiProviderFor(readerFor(chain)) },
  );
  const record = await run(request.encode(true, false), origin);
  await touchSite(origin);
  return resultFrom(record, chain.chainId);
}

async function signRequest(
  site: ConnectedSite,
  origin: string,
  uri: unknown,
): Promise<TransactResult> {
  if (typeof uri !== 'string' || uri.length > MAX_REQUEST_LENGTH) throw new Error('invalid_params');
  if (!isSigningRequestUri(uri)) throw new Error('invalid_params');
  const record = await run(uri, origin);
  await touchSite(origin);
  return resultFrom(record, record.chainId ?? site.chainId);
}

export async function handleProviderCall(
  method: unknown,
  params: unknown,
  origin: string,
): Promise<unknown> {
  if (!isProviderMethod(method)) throw new Error('unknown_method');
  const args = Array.isArray(params) ? params : [];
  const settings = settingsSchema.parse(await settingsItem.getValue());
  if (!settings.allowSiteConnections) throw new Error('connections_disabled');

  const calls: Record<ProviderMethod, () => Promise<unknown>> = {
    isConnected: async () => (await siteFor(origin)) !== undefined,
    disconnect: async () => {
      await providerService.revoke(origin);
      return true;
    },
    login: () => login(origin, args[0]),
    transact: () => transact(origin, args[0]),
    sign: async () => {
      const site = await siteFor(origin);
      if (!site) throw new Error('not_connected');
      return signRequest(site, origin, args[0]);
    },
  };
  return calls[method]();
}

export const providerService: ProviderService = {
  listSites: () => connectedSitesItem.getValue(),

  async revoke(origin) {
    const sites = await connectedSitesItem.getValue();
    await connectedSitesItem.setValue(sites.filter((site) => site.origin !== origin));
  },

  async revokeAll() {
    await connectedSitesItem.setValue([]);
  },
};

export function registerProviderService(): void {
  registerService(SERVICE_KEY, providerService);
}

export function useProviderService(): ProviderService {
  return createProxyService<ProviderService>(SERVICE_KEY);
}
