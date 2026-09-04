import { ABI, Name, Serializer, Transaction } from '@wharfkit/antelope';
import { z } from 'zod';
import type { Blockchain } from '@/lib/storage/schemas';

export const FUEL_NOOP_CONTRACT = 'greymassnoop';
export const FUEL_NOOP_ACTION = 'noop';
export const FUEL_COSIGNER = 'greymassfuel';
export const FUEL_COSIGN_PERMISSION = 'cosign';
export const FUEL_FEE_RECEIVER = 'fuel.gm';

const endpoints: Record<string, string> = {
  aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906: 'https://eos.greymass.com',
  '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d':
    'https://jungle4.greymass.com',
  '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11': 'https://telos.greymass.com',
  '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4': 'https://wax.greymass.com',
};

export function fuelEndpointFor(chain: Blockchain): string | null {
  if (!chain.features.includes('greymassfuel')) return null;
  const known = endpoints[chain.chainId];
  if (known) return known;
  try {
    const url = new URL(chain.node);
    if (url.hostname.endsWith('.greymass.com')) return url.origin;
  } catch {
    return null;
  }
  return null;
}

const transferAbi = ABI.from({
  version: 'eosio::abi/1.1',
  types: [],
  variants: [],
  tables: [],
  ricardian_clauses: [],
  structs: [
    {
      name: 'transfer',
      base: '',
      fields: [
        { name: 'from', type: 'name' },
        { name: 'to', type: 'name' },
        { name: 'quantity', type: 'asset' },
        { name: 'memo', type: 'string' },
      ],
    },
  ],
  actions: [{ name: 'transfer', type: 'transfer', ricardian_contract: '' }],
});

export class FuelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FuelValidationError';
  }
}

export interface FuelSigner {
  actor: string;
  permission: string;
}

const responseSchema = z.object({
  code: z.number(),
  message: z.string().optional(),
  data: z
    .object({
      request: z.tuple([z.string(), z.unknown()]).optional(),
      signatures: z.array(z.string()).default([]),
      fee: z.string().optional(),
      costs: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export type FuelQuote =
  | { kind: 'free'; transaction: Transaction; signatures: string[] }
  | {
      kind: 'fee';
      transaction: Transaction;
      signatures: string[];
      fee: string;
      costs: Record<string, string>;
    }
  | { kind: 'unavailable'; reason: string };

export async function requestFuel(
  endpoint: string,
  request: string,
  signer: FuelSigner,
  fetchFn: typeof fetch = (input, init) => globalThis.fetch(input, init),
): Promise<FuelQuote> {
  let body: unknown;
  try {
    const response = await fetchFn(`${endpoint}/v1/resource_provider/request_transaction`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ request, signer }),
    });
    body = await response.json();
  } catch (error) {
    return { kind: 'unavailable', reason: error instanceof Error ? error.message : 'network' };
  }
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) return { kind: 'unavailable', reason: 'invalid_response' };
  const { code, data, message } = parsed.data;
  const raw = data?.request?.[1];
  if (!raw || data?.request?.[0] !== 'transaction') {
    return { kind: 'unavailable', reason: message ?? `code_${code}` };
  }
  let transaction: Transaction;
  try {
    transaction = Transaction.from(raw as Parameters<typeof Transaction.from>[0]);
  } catch {
    return { kind: 'unavailable', reason: 'invalid_transaction' };
  }
  if (code === 200) return { kind: 'free', transaction, signatures: data.signatures };
  if (code === 402) {
    return {
      kind: 'fee',
      transaction,
      signatures: data.signatures,
      fee: data.fee ?? Object.values(data.costs ?? {})[0] ?? '',
      costs: data.costs ?? {},
    };
  }
  return { kind: 'unavailable', reason: message ?? `code_${code}` };
}

function isFuelBuyRam(action: Transaction['actions'][number]): boolean {
  return (
    String(action.account) === 'eosio' &&
    String(action.name) === 'buyram' &&
    action.authorization.length === 1 &&
    String(action.authorization[0]!.actor) === FUEL_COSIGNER
  );
}

export function expectedFuelActions(modified: Transaction, withFee: boolean): number {
  let expected = 1;
  if (modified.actions.some(isFuelBuyRam)) expected += 1;
  if (withFee) expected += 1;
  return expected;
}

function assertNoop(modified: Transaction): void {
  const first = modified.actions[0];
  const auth = first?.authorization[0];
  if (
    !first ||
    !auth ||
    String(first.account) !== FUEL_NOOP_CONTRACT ||
    String(first.name) !== FUEL_NOOP_ACTION ||
    String(auth.actor) !== FUEL_COSIGNER ||
    String(auth.permission) !== FUEL_COSIGN_PERMISSION ||
    first.data.length !== 0
  ) {
    throw new FuelValidationError('noop_missing');
  }
}

function assertFee(modified: Transaction, expected: number, signer: FuelSigner): void {
  const fee = modified.actions
    .slice(0, expected)
    .find(
      (action) => String(action.account) === 'eosio.token' && String(action.name) === 'transfer',
    );
  if (!fee) throw new FuelValidationError('fee_missing');
  const decoded = Serializer.decode({ data: fee.data, type: 'transfer', abi: transferAbi }) as {
    from: Name;
    to: Name;
  };
  if (!decoded.to.equals(Name.from(FUEL_FEE_RECEIVER)))
    throw new FuelValidationError('fee_receiver');
  if (!decoded.from.equals(Name.from(signer.actor))) throw new FuelValidationError('fee_payer');
}

export function validateFuelTransaction(
  original: Transaction,
  modified: Transaction,
  signer: FuelSigner,
  withFee = false,
): void {
  assertNoop(modified);
  const expected = expectedFuelActions(modified, withFee);
  if (modified.actions.length !== original.actions.length + expected) {
    throw new FuelValidationError('action_count');
  }
  modified.actions.forEach((action, index) => {
    if (index < expected) return;
    const source = original.actions[index - expected];
    const sourceAuth = source?.authorization[0];
    const auth = action.authorization[0];
    if (
      !source ||
      !sourceAuth ||
      !auth ||
      !action.account.equals(source.account) ||
      !action.name.equals(source.name) ||
      action.authorization.length !== source.authorization.length ||
      !auth.actor.equals(sourceAuth.actor) ||
      !auth.permission.equals(sourceAuth.permission) ||
      !action.data.equals(source.data)
    ) {
      throw new FuelValidationError(`action_mismatch_${index}`);
    }
  });
  if (withFee) assertFee(modified, expected, signer);
}
