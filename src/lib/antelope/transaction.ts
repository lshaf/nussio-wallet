import {
  type ABI,
  APIError,
  Action,
  Checksum256,
  PrivateKey,
  Serializer,
  SignedTransaction,
  Transaction,
  type API,
} from '@wharfkit/antelope';

export interface ActionInput {
  account: string;
  name: string;
  authorization: { actor: string; permission: string }[];
  data: Record<string, unknown>;
}

export interface DecodedAction {
  account: string;
  name: string;
  authorization: { actor: string; permission: string }[];
  data: Record<string, unknown>;
  hex: string;
}

export interface ChainReader {
  getInfo(): Promise<API.v1.GetInfoResponse>;
  getAbi(account: string): Promise<ABI>;
}

export type TxErrorKind =
  | 'authorization'
  | 'cpu'
  | 'net'
  | 'ram'
  | 'expired'
  | 'duplicate'
  | 'assert'
  | 'locked'
  | 'fee_required'
  | 'fuel_invalid'
  | 'network'
  | 'invalid'
  | 'unknown';

export interface TxError {
  kind: TxErrorKind;
  name: string;
  message: string;
  details: string[];
}

export const EXPIRE_SIGN_SECONDS = 120;
export const EXPIRE_EXPORT_SECONDS = 3600;

export async function loadAbis(
  reader: ChainReader,
  accounts: string[],
): Promise<Record<string, ABI>> {
  const unique = [...new Set(accounts)];
  const entries = await Promise.all(
    unique.map(async (account) => [account, await reader.getAbi(account)] as const),
  );
  return Object.fromEntries(entries);
}

export async function buildTransaction(
  reader: ChainReader,
  inputs: ActionInput[],
  expireSeconds: number,
): Promise<{ transaction: Transaction; abis: Record<string, ABI> }> {
  const abis = await loadAbis(
    reader,
    inputs.map((input) => input.account),
  );
  const actions = inputs.map((input) => Action.from(input, abis[input.account]!));
  const info = await reader.getInfo();
  const header = info.getTransactionHeader(expireSeconds);
  const transaction = Transaction.from({ ...header, actions });
  return { transaction, abis };
}

export function signTransaction(
  transaction: Transaction,
  wif: string,
  chainId: string,
  extraSignatures: string[] = [],
): SignedTransaction {
  const digest = transaction.signingDigest(Checksum256.from(chainId));
  const signature = PrivateKey.from(wif).signDigest(digest);
  return SignedTransaction.from({
    ...transaction,
    signatures: [...extraSignatures, String(signature)],
  });
}

export function decodeAction(action: Action, abi: ABI | undefined): DecodedAction {
  let data: Record<string, unknown> = {};
  if (abi) {
    try {
      data = Serializer.objectify(action.decodeData(abi)) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }
  return {
    account: String(action.account),
    name: String(action.name),
    authorization: action.authorization.map((level) => ({
      actor: String(level.actor),
      permission: String(level.permission),
    })),
    data,
    hex: String(action.data),
  };
}

export function decodeActions(
  transaction: Transaction,
  abis: Record<string, ABI>,
): DecodedAction[] {
  return transaction.actions.map((action) => decodeAction(action, abis[String(action.account)]));
}

export function transactionToJson(
  transaction: Transaction | SignedTransaction,
): Record<string, unknown> {
  return Serializer.objectify(transaction) as Record<string, unknown>;
}

export function unsignedExport(
  transaction: Transaction,
  abis: Record<string, ABI>,
  signatures: string[] = [],
): Record<string, unknown> {
  return {
    contracts: Object.entries(abis).map(([contract, abi]) => ({
      contract,
      abi: Serializer.objectify(abi),
    })),
    transaction: {
      broadcast: false,
      transaction_id: String(transaction.id),
      transaction: {
        compression: 'none',
        signatures,
        transaction: transactionToJson(transaction),
      },
    },
  };
}

export interface ParsedTransactionInput {
  transaction: Transaction;
  signatures: string[];
}

export function parseTransactionInput(text: string): ParsedTransactionInput {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('invalid_json');
  }
  return parseTransactionObject(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseTransactionObject(value: unknown): ParsedTransactionInput {
  if (!isRecord(value)) throw new Error('invalid_transaction');
  const signatures = Array.isArray(value.signatures)
    ? value.signatures.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (isRecord(value.transaction)) {
    const nested = value.transaction;
    if (isRecord(nested.transaction) || 'signatures' in nested) {
      const inner = parseTransactionObject(nested);
      return { transaction: inner.transaction, signatures: [...signatures, ...inner.signatures] };
    }
    if (Array.isArray(nested.actions)) {
      return { transaction: Transaction.from(nested as never), signatures };
    }
  }
  if (Array.isArray(value.actions)) {
    return { transaction: Transaction.from(value as never), signatures };
  }
  throw new Error('invalid_transaction');
}

const ASSERT_PREFIX = 'assertion failure with message: ';

export function normalizeChainError(error: unknown): TxError {
  if (error instanceof APIError) {
    const name = error.name;
    const details = error.details.map((detail) => detail.message);
    const text = [error.error?.what ?? '', ...details].join(' ');
    const assert = details.find((detail) => detail.startsWith(ASSERT_PREFIX));
    return {
      kind: classify(name, text),
      name,
      message: assert ? assert.slice(ASSERT_PREFIX.length) : (error.error?.what ?? error.message),
      details,
    };
  }
  if (error instanceof Error) {
    const known: TxErrorKind[] = ['locked', 'fee_required', 'fuel_invalid', 'network', 'invalid'];
    const kind = known.find((entry) => entry === error.message);
    if (kind) return { kind, name: error.message, message: error.message, details: [] };
    if (error.name === 'FuelValidationError') {
      return { kind: 'fuel_invalid', name: error.name, message: error.message, details: [] };
    }
    if (/fetch|network|Failed to fetch|unreachable/i.test(error.message)) {
      return { kind: 'network', name: error.name, message: error.message, details: [] };
    }
    return { kind: 'unknown', name: error.name, message: error.message, details: [] };
  }
  return { kind: 'unknown', name: 'unknown', message: String(error), details: [] };
}

function classify(name: string, text: string): TxErrorKind {
  switch (name) {
    case 'unsatisfied_authorization':
    case 'missing_auth_exception':
    case 'irrelevant_auth_exception':
    case 'invalid_permission':
      return 'authorization';
    case 'tx_cpu_usage_exceeded':
    case 'leeway_deadline_exception':
    case 'deadline_exception':
      return 'cpu';
    case 'tx_net_usage_exceeded':
      return 'net';
    case 'ram_usage_exceeded':
      return 'ram';
    case 'expired_tx_exception':
      return 'expired';
    case 'tx_duplicate':
      return 'duplicate';
    case 'eosio_assert_message_exception':
    case 'eosio_assert_code_exception':
      return 'assert';
    default:
      if (/greymassfuel|cpu/i.test(text)) return 'cpu';
      return 'unknown';
  }
}
