import {
  PlaceholderName,
  PlaceholderPermission,
  SigningRequest,
  type AbiMap,
  type AbiProvider,
  type ZlibProvider,
} from '@wharfkit/signing-request';
import { ABI, Serializer, type Transaction } from '@wharfkit/antelope';
import { FUEL_FEE_RECEIVER, FUEL_NOOP_CONTRACT } from './fuel';
import type { ChainReader, DecodedAction } from './transaction';
import { deflateRaw, inflateRaw } from 'pako';

export const zlib: ZlibProvider = {
  deflateRaw: (data) => deflateRaw(data),
  inflateRaw: (data) => inflateRaw(data),
};

const SCHEMES = ['esr:', 'esr-anchor:', 'anchor:', 'eosio:'];

export function isSigningRequestUri(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return SCHEMES.some((scheme) => trimmed.startsWith(scheme));
}

export async function encodeTransactionRequest(
  transaction: Transaction,
  chainId: string,
  abis: Record<string, ABI>,
): Promise<string> {
  const request = await SigningRequest.create(
    {
      chainId,
      transaction: Serializer.objectify(transaction) as Parameters<
        typeof SigningRequest.create
      >[0]['transaction'],
    },
    {
      zlib,
      abiProvider: {
        getAbi: async (account) => {
          const abi = abis[String(account)];
          if (!abi) throw new Error(`missing abi for ${String(account)}`);
          return abi;
        },
      },
    },
  );
  return request.encode(true, false);
}

const REQUEST_SCHEMES = ['esr-anchor:', 'anchor:', 'eosio:'];

export function normalizeRequestUri(value: string): string {
  let text = value.trim();
  const lower = text.toLowerCase();
  const alias = REQUEST_SCHEMES.find((scheme) => lower.startsWith(scheme));
  if (alias) text = `esr:${text.slice(alias.length)}`;
  else if (!lower.startsWith('esr:')) text = `esr:${text}`;
  return text.replace(/^esr:\/\//i, 'esr:');
}

export function parseSigningRequest(uri: string): SigningRequest {
  return SigningRequest.from(normalizeRequestUri(uri), { zlib });
}

export function abiProviderFor(reader: ChainReader): AbiProvider {
  return { getAbi: (account) => reader.getAbi(String(account)) };
}

export function abiMapToRecord(map: AbiMap): Record<string, ABI> {
  const record: Record<string, ABI> = {};
  for (const [account, def] of map) record[account] = ABI.from(def);
  return record;
}

export function requestUsesPlaceholders(request: SigningRequest, abis: AbiMap): boolean {
  if (request.isIdentity()) return true;
  const first = request.resolveActions(abis, { actor: 'aaaaaaaaaaaa', permission: 'aaaaaaaaaaaa' });
  const second = request.resolveActions(abis, {
    actor: 'bbbbbbbbbbbb',
    permission: 'bbbbbbbbbbbb',
  });
  return JSON.stringify(first) !== JSON.stringify(second);
}

export function requestedSigner(
  request: SigningRequest,
): { actor: string; permission: string } | null {
  if (request.isIdentity()) return null;
  const action = request
    .getRawActions()
    .find((entry) => String(entry.account) !== FUEL_NOOP_CONTRACT);
  const auth = action?.authorization[0];
  if (!auth || auth.actor.equals(PlaceholderName)) return null;
  return {
    actor: String(auth.actor),
    permission: auth.permission.equals(PlaceholderPermission) ? 'active' : String(auth.permission),
  };
}

const FORBIDDEN_ACTIONS = new Set(['updateauth', 'linkauth', 'unlinkauth', 'deleteauth']);

export function forbiddenActions(actions: DecodedAction[], systemContract: string): string[] {
  return actions
    .filter((action) => action.account === systemContract && FORBIDDEN_ACTIONS.has(action.name))
    .map((action) => `${action.account}::${action.name}`);
}

export interface FuelPresentation {
  provider: boolean;
  fee: string | null;
}

export function fuelPresentation(actions: DecodedAction[]): FuelPresentation {
  const provider = actions.some(
    (action) => action.account === FUEL_NOOP_CONTRACT && action.name === 'noop',
  );
  const feeAction = actions.find(
    (action) =>
      action.account === 'eosio.token' &&
      action.name === 'transfer' &&
      action.data.to === FUEL_FEE_RECEIVER,
  );
  const fee =
    feeAction && typeof feeAction.data.quantity === 'string' ? feeAction.data.quantity : null;
  return { provider, fee };
}
