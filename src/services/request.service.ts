import { createProxyService, registerService } from '@webext-core/proxy-service';
import { browser } from 'wxt/browser';
import { Checksum256, PrivateKey, SignedTransaction, type Transaction } from '@wharfkit/antelope';
import type {
  AbiMap,
  ResolvedSigningRequest,
  SigningRequest,
  TransactionContext,
} from '@wharfkit/signing-request';
import { clientFor } from '@/lib/antelope/client';
import {
  abiMapToRecord,
  abiProviderFor,
  encodeTransactionRequest,
  forbiddenActions,
  fuelPresentation,
  parseSigningRequest,
  requestUsesPlaceholders,
  requestedSigner,
  type FuelPresentation,
} from '@/lib/antelope/esr';
import {
  FUEL_NOOP_CONTRACT,
  fuelEndpointFor,
  requestFuel,
  validateFuelTransaction,
} from '@/lib/antelope/fuel';
import {
  EXPIRE_SIGN_SECONDS,
  decodeActions,
  normalizeChainError,
  transactionToJson,
  unsignedExport,
  type DecodedAction,
  type TxError,
} from '@/lib/antelope/transaction';
import {
  blockchainsItem,
  pendingRequestsItem,
  settingsItem,
  walletsItem,
} from '@/lib/storage/items';
import type {
  Blockchain,
  PendingRequest,
  RequestSigner,
  RequestStatus,
  Wallet,
} from '@/lib/storage/schemas';
import { readerFor, type FuelState } from './transaction.service';
import { signingKeyFor } from './wallet.service';

export interface RequestView {
  id: string;
  uri: string;
  status: RequestStatus;
  receivedAt: number;
  kind: 'identity' | 'transaction';
  chainIds: string[];
  chainId: string | null;
  chain: Blockchain | null;
  wallets: Wallet[];
  signer: RequestSigner | null;
  placeholders: boolean;
  requestedSigner: { actor: string; permission: string } | null;
  signerMissing: boolean;
  actions: DecodedAction[];
  transaction: Record<string, unknown> | null;
  expiration: string | null;
  broadcast: boolean;
  callback: { url: string; background: boolean; origin: string } | null;
  forbidden: string[];
  dangerousAllowed: boolean;
  fuel: FuelPresentation;
  error: 'unknown_chain' | 'no_wallets' | 'invalid' | null;
  errorMessage?: string;
}

export type RequestOutcome =
  | {
      status: 'done';
      transactionId?: string;
      blockNum?: number;
      signatures: string[];
      identity: boolean;
      fuel: FuelState;
      fee?: string;
      callback: { url: string; background: boolean; sent: boolean; error?: string } | null;
    }
  | {
      status: 'unsigned';
      file: Record<string, unknown>;
      esr: string;
      expiration: string;
      actions: DecodedAction[];
    }
  | { status: 'fee_required'; fee: string; costs: Record<string, string> }
  | { status: 'error'; error: TxError };

export interface RequestService {
  open(uri: string): Promise<{ id: string }>;
  get(id: string): Promise<PendingRequest | undefined>;
  list(): Promise<PendingRequest[]>;
  resolve(id: string, signer?: RequestSigner): Promise<RequestView>;
  sign(
    id: string,
    signer: RequestSigner,
    options?: { acceptFee?: boolean },
  ): Promise<RequestOutcome>;
  cancel(id: string): Promise<void>;
  focus(id: string): Promise<void>;
  windowClosed(windowId: number): Promise<void>;
  openCallback(id: string): Promise<void>;
  updateBadge(): Promise<void>;
}

const SERVICE_KEY = 'RequestService';
const PROMPT_WIDTH = 940;
const PROMPT_HEIGHT = 580;
const FINAL_STATUSES = new Set<RequestStatus>(['done', 'error', 'cancelled']);
const REJECTION = { rejected: 'Request cancelled from within Waxos Wallet.' };

interface Context {
  record: PendingRequest;
  request: SigningRequest | null;
  chainIds: string[];
  chain: Blockchain | null;
  wallets: Wallet[];
  signer: RequestSigner | null;
  abis: AbiMap | null;
  resolved: ResolvedSigningRequest | null;
  actions: DecodedAction[];
  placeholders: boolean;
  requested: { actor: string; permission: string } | null;
  error: RequestView['error'];
  errorMessage?: string;
}

async function openPromptWindow(id: string): Promise<number | undefined> {
  const url = browser.runtime.getURL(`/prompt.html?id=${encodeURIComponent(id)}`);
  const current = await browser.windows.getLastFocused().catch(() => undefined);
  const left =
    current?.left !== undefined && current.width !== undefined
      ? Math.round(current.left + (current.width - PROMPT_WIDTH) / 2)
      : undefined;
  const top =
    current?.top !== undefined && current.height !== undefined
      ? Math.round(current.top + (current.height - PROMPT_HEIGHT) / 2)
      : undefined;
  const created = await browser.windows.create({
    url,
    type: 'popup',
    width: PROMPT_WIDTH,
    height: PROMPT_HEIGHT,
    focused: true,
    left,
    top,
  });
  return created?.id;
}

async function readRecord(id: string): Promise<PendingRequest> {
  const record = (await pendingRequestsItem.getValue()).find((entry) => entry.id === id);
  if (!record) throw new Error('unknown_request');
  return record;
}

async function patchRecord(id: string, patch: Partial<PendingRequest>): Promise<PendingRequest> {
  const requests = await pendingRequestsItem.getValue();
  const next = requests.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry));
  await pendingRequestsItem.setValue(next);
  await requestService.updateBadge();
  return next.find((entry) => entry.id === id)!;
}

function sameSigner(wallet: Wallet, actor: string, permission: string): boolean {
  return wallet.account === actor && wallet.authorization === permission;
}

function callbackOf(request: SigningRequest): RequestView['callback'] {
  const url = request.data.callback;
  if (!url) return null;
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    origin = url;
  }
  return { url, background: request.data.flags.background, origin };
}

async function postJson(url: string, body: unknown): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`callback_${response.status}`);
}

async function rejectCallback(record: PendingRequest): Promise<void> {
  try {
    const callback = callbackOf(parseSigningRequest(record.uri));
    if (callback && /^https?:/i.test(callback.url)) await postJson(callback.url, REJECTION);
  } catch {
    return;
  }
}

async function buildContext(id: string, signerRef?: RequestSigner): Promise<Context> {
  const record = await readRecord(id);
  const base: Context = {
    record,
    request: null,
    chainIds: [],
    chain: null,
    wallets: [],
    signer: null,
    abis: null,
    resolved: null,
    actions: [],
    placeholders: false,
    requested: null,
    error: null,
  };
  let request: SigningRequest;
  try {
    request = parseSigningRequest(record.uri);
  } catch (error) {
    return { ...base, error: 'invalid', errorMessage: error instanceof Error ? error.message : '' };
  }
  base.request = request;

  const [settings, chains, wallets] = await Promise.all([
    settingsItem.getValue(),
    blockchainsItem.getValue(),
    walletsItem.getValue(),
  ]);
  const known = new Set(chains.map((chain) => chain.chainId));
  let chainIds = request.isMultiChain()
    ? (request.getChainIds() ?? []).map((entry) => String(entry))
    : [String(request.getChainId())];
  if (request.isMultiChain()) {
    const usable = chainIds.filter(
      (chainId) =>
        known.has(chainId) &&
        settings.enabledChains.includes(chainId) &&
        wallets.some((wallet) => wallet.chainId === chainId),
    );
    if (usable.length > 0) chainIds = usable;
  }
  base.chainIds = chainIds;

  const chainId =
    signerRef?.chainId ??
    record.chainId ??
    chainIds.find((entry) => known.has(entry) && wallets.some((w) => w.chainId === entry)) ??
    chainIds[0] ??
    null;
  const chain = chains.find((entry) => entry.chainId === chainId) ?? null;
  if (!chain) return { ...base, error: 'unknown_chain' };
  base.chain = chain;

  const walletsForChain = wallets.filter((wallet) => wallet.chainId === chain.chainId);
  base.wallets = walletsForChain;
  if (walletsForChain.length === 0) return { ...base, error: 'no_wallets' };

  const reader = readerFor(chain);
  let abis: AbiMap;
  try {
    abis = await request.fetchAbis(abiProviderFor(reader));
  } catch (error) {
    return { ...base, error: 'invalid', errorMessage: error instanceof Error ? error.message : '' };
  }
  base.abis = abis;
  base.placeholders = requestUsesPlaceholders(request, abis);
  base.requested = requestedSigner(request);

  const preferred =
    signerRef && signerRef.chainId === chain.chainId
      ? walletsForChain.find((w) => sameSigner(w, signerRef.account, signerRef.authorization))
      : undefined;
  const remembered =
    record.signer && record.signer.chainId === chain.chainId
      ? walletsForChain.find((w) =>
          sameSigner(w, record.signer!.account, record.signer!.authorization),
        )
      : undefined;
  const requestedWallet = base.requested
    ? walletsForChain.find((w) => sameSigner(w, base.requested!.actor, base.requested!.permission))
    : undefined;
  const current =
    settings.chainId === chain.chainId && settings.account && settings.authorization
      ? walletsForChain.find((w) => sameSigner(w, settings.account!, settings.authorization!))
      : undefined;
  const wallet = preferred ?? remembered ?? requestedWallet ?? current ?? walletsForChain[0]!;
  base.signer = {
    chainId: chain.chainId,
    account: wallet.account,
    authorization: wallet.authorization,
  };

  let ctx: TransactionContext = {};
  if (request.requiresTapos()) {
    try {
      const header = (await reader.getInfo()).getTransactionHeader(EXPIRE_SIGN_SECONDS);
      ctx = {
        expiration: header.expiration,
        ref_block_num: header.ref_block_num,
        ref_block_prefix: header.ref_block_prefix,
      };
    } catch (error) {
      return {
        ...base,
        error: 'invalid',
        errorMessage: error instanceof Error ? error.message : 'network',
      };
    }
  }
  try {
    base.resolved = request.resolve(
      abis,
      { actor: wallet.account, permission: wallet.authorization },
      ctx,
    );
    base.actions = decodeActions(base.resolved.transaction, abiMapToRecord(abis));
  } catch (error) {
    return { ...base, error: 'invalid', errorMessage: error instanceof Error ? error.message : '' };
  }
  return base;
}

async function viewFrom(context: Context): Promise<RequestView> {
  const settings = await settingsItem.getValue();
  const { record, request, chain, resolved } = context;
  const identity = request?.isIdentity() ?? false;
  return {
    id: record.id,
    uri: record.uri,
    status: record.status,
    receivedAt: record.receivedAt,
    kind: identity ? 'identity' : 'transaction',
    chainIds: context.chainIds,
    chainId: chain?.chainId ?? null,
    chain,
    wallets: context.wallets,
    signer: context.signer,
    placeholders: context.placeholders,
    requestedSigner: context.requested,
    signerMissing: Boolean(
      context.requested &&
      !context.wallets.some((w) =>
        sameSigner(w, context.requested!.actor, context.requested!.permission),
      ),
    ),
    actions: context.actions,
    transaction: resolved ? transactionToJson(resolved.transaction) : null,
    expiration: resolved && !identity ? String(resolved.transaction.expiration) : null,
    broadcast: request ? request.shouldBroadcast() && !identity : false,
    callback: request ? callbackOf(request) : null,
    forbidden: chain ? forbiddenActions(context.actions, chain.systemContract) : [],
    dangerousAllowed: settings.allowDangerousTransactions,
    fuel: fuelPresentation(context.actions),
    error: context.error,
    errorMessage: context.errorMessage,
  };
}

function badgeApi(): typeof browser.action | undefined {
  const api = browser as unknown as {
    action?: typeof browser.action;
    browserAction?: typeof browser.action;
  };
  return api.action ?? api.browserAction;
}

export const requestService: RequestService = {
  async open(uri) {
    const id = crypto.randomUUID();
    const request: PendingRequest = { id, uri, receivedAt: Date.now(), status: 'received' };
    const requests = await pendingRequestsItem.getValue();
    await pendingRequestsItem.setValue([...requests, request]);
    const windowId = await openPromptWindow(id);
    await patchRecord(id, { windowId });
    return { id };
  },

  async get(id) {
    return (await pendingRequestsItem.getValue()).find((request) => request.id === id);
  },

  list: () => pendingRequestsItem.getValue(),

  async resolve(id, signer) {
    const context = await buildContext(id, signer);
    if (!context.error && context.signer) {
      await patchRecord(id, {
        status: FINAL_STATUSES.has(context.record.status) ? context.record.status : 'ready',
        chainId: context.chain?.chainId,
        signer: context.signer,
      });
    } else if (context.error) {
      await patchRecord(id, { status: 'error', error: context.error });
    }
    const view = await viewFrom(context);
    view.status = (await readRecord(id)).status;
    return view;
  },

  async sign(id, signerRef, options = {}) {
    const store = async (
      outcome: RequestOutcome,
      status: RequestStatus,
    ): Promise<RequestOutcome> => {
      await patchRecord(id, {
        status,
        outcome,
        error: outcome.status === 'error' ? outcome.error.kind : undefined,
      });
      return outcome;
    };
    try {
      const context = await buildContext(id, signerRef);
      const { request, chain, resolved, abis, signer } = context;
      if (context.error || !request || !chain || !resolved || !abis || !signer) {
        throw new Error(context.error === 'unknown_chain' ? 'unknown_chain' : 'invalid');
      }
      const settings = await settingsItem.getValue();
      const forbidden = forbiddenActions(context.actions, chain.systemContract);
      if (forbidden.length > 0 && !settings.allowDangerousTransactions)
        throw new Error('forbidden');

      const wallet = context.wallets.find((w) =>
        sameSigner(w, signer.account, signer.authorization),
      );
      if (!wallet) throw new Error('invalid');
      const abiRecord = abiMapToRecord(abis);

      if (wallet.mode === 'watch' || wallet.mode === 'cold') {
        return store(
          {
            status: 'unsigned',
            file: unsignedExport(resolved.transaction, abiRecord),
            esr: context.record.uri,
            expiration: String(resolved.transaction.expiration),
            actions: context.actions,
          },
          'ready',
        );
      }

      const key = await signingKeyFor(wallet.pubkey);
      if (!key) throw new Error('locked');
      await patchRecord(id, { status: 'signing' });

      const identity = request.isIdentity();
      const broadcast = request.shouldBroadcast() && !identity;
      let transaction: Transaction = resolved.transaction;
      let cosignatures: string[] = [];
      let fuel: FuelState = 'none';
      let fee: string | undefined;

      const endpoint = broadcast ? fuelEndpointFor(chain) : null;
      if (endpoint && String(transaction.actions[0]?.account) !== FUEL_NOOP_CONTRACT) {
        const fuelSigner = { actor: wallet.account, permission: wallet.authorization };
        const esr = await encodeTransactionRequest(transaction, chain.chainId, abiRecord);
        const quote = await requestFuel(endpoint, esr, fuelSigner);
        if (quote.kind === 'free') {
          validateFuelTransaction(transaction, quote.transaction, fuelSigner);
          transaction = quote.transaction;
          cosignatures = quote.signatures;
          fuel = 'free';
        } else if (quote.kind === 'fee') {
          if (!(options.acceptFee || settings.transactionFees)) {
            return store({ status: 'fee_required', fee: quote.fee, costs: quote.costs }, 'ready');
          }
          validateFuelTransaction(transaction, quote.transaction, fuelSigner, true);
          transaction = quote.transaction;
          cosignatures = quote.signatures;
          fuel = 'fee';
          fee = quote.fee;
        }
      }

      const digest = transaction.signingDigest(Checksum256.from(chain.chainId));
      const signature = String(PrivateKey.from(key).signDigest(digest));
      const signatures = [...cosignatures, signature];

      let transactionId: string | undefined;
      let blockNum: number | undefined;
      if (broadcast) {
        await patchRecord(id, { status: 'broadcasting' });
        const signed = SignedTransaction.from({ ...transaction, signatures });
        const response = await clientFor(chain.node).v1.chain.send_transaction(signed);
        transactionId = String(response.transaction_id);
        const num = Number(response.processed?.block_num ?? 0);
        blockNum = num > 0 ? num : undefined;
      } else if (!identity) {
        transactionId = String(transaction.id);
      }

      let callback: Extract<RequestOutcome, { status: 'done' }>['callback'] = null;
      const resolvedCallback = resolved.getCallback(signatures, blockNum);
      if (resolvedCallback) {
        const payload = { ...resolvedCallback.payload };
        if (transactionId) payload.tx = transactionId;
        if (blockNum) payload.bn = String(blockNum);
        callback = {
          url: resolvedCallback.url,
          background: resolvedCallback.background,
          sent: false,
        };
        if (resolvedCallback.background) {
          await patchRecord(id, { status: 'callback' });
          try {
            await postJson(resolvedCallback.url, payload);
            callback.sent = true;
          } catch (error) {
            callback.error = error instanceof Error ? error.message : 'callback_failed';
          }
        }
      }

      return store(
        { status: 'done', transactionId, blockNum, signatures, identity, fuel, fee, callback },
        'done',
      );
    } catch (error) {
      const normalized = normalizeChainError(error);
      const final = normalized.kind === 'locked' || normalized.kind === 'fee_required';
      return store({ status: 'error', error: normalized }, final ? 'ready' : 'error');
    }
  },

  async cancel(id) {
    const record = await readRecord(id);
    if (FINAL_STATUSES.has(record.status)) return;
    await patchRecord(id, { status: 'cancelled' });
    await rejectCallback(record);
  },

  async focus(id) {
    const record = await readRecord(id);
    if (record.windowId !== undefined) {
      try {
        await browser.windows.update(record.windowId, { focused: true });
        return;
      } catch {
        await patchRecord(id, { windowId: undefined });
      }
    }
    const windowId = await openPromptWindow(id);
    await patchRecord(id, { windowId });
  },

  async windowClosed(windowId) {
    const requests = await pendingRequestsItem.getValue();
    for (const record of requests) {
      if (record.windowId !== windowId) continue;
      if (FINAL_STATUSES.has(record.status)) continue;
      await patchRecord(record.id, { status: 'cancelled', windowId: undefined });
      await rejectCallback(record);
    }
  },

  async openCallback(id) {
    const record = await readRecord(id);
    const outcome = record.outcome as RequestOutcome | undefined;
    if (outcome?.status !== 'done' || !outcome.callback || outcome.callback.background) return;
    await browser.tabs.create({ url: outcome.callback.url });
    await patchRecord(id, {
      outcome: { ...outcome, callback: { ...outcome.callback, sent: true } },
    });
  },

  async updateBadge() {
    const api = badgeApi();
    if (!api) return;
    const requests = await pendingRequestsItem.getValue();
    const count = requests.filter((entry) => !FINAL_STATUSES.has(entry.status)).length;
    await api.setBadgeBackgroundColor({ color: '#d9720f' }).catch(() => undefined);
    await api.setBadgeText({ text: count > 0 ? String(count) : '' }).catch(() => undefined);
  },
};

export function registerRequestService(): void {
  registerService(SERVICE_KEY, requestService);
}

export function useRequestService(): RequestService {
  return createProxyService<RequestService>(SERVICE_KEY);
}
