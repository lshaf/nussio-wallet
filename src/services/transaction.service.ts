import { createProxyService, registerService } from '@webext-core/proxy-service';
import { ABI, Bytes, KeyType, Signature, SignedTransaction } from '@wharfkit/antelope';
import { clientFor } from '@/lib/antelope/client';
import { legacyPublicKey } from '@/lib/antelope/keys';
import { encodeTransactionRequest, isSigningRequestUri } from '@/lib/antelope/esr';
import {
  FUEL_NOOP_CONTRACT,
  fuelEndpointFor,
  requestFuel,
  validateFuelTransaction,
} from '@/lib/antelope/fuel';
import {
  EXPIRE_EXPORT_SECONDS,
  EXPIRE_LEDGER_SECONDS,
  EXPIRE_SIGN_SECONDS,
  buildTransaction,
  decodeActions,
  loadAbis,
  normalizeChainError,
  parseTransactionInput,
  signTransaction,
  transactionToJson,
  unsignedExport,
  type ActionInput,
  type ChainReader,
  type DecodedAction,
  type TxError,
} from '@/lib/antelope/transaction';
import { DEFAULT_PATH } from '@/lib/ledger/paths';
import { ledgerChunks } from '@/lib/ledger/serialize';
import { fromHex, toHex } from '@/lib/ledger/session';
import { abiCacheItem, blockchainsItem, settingsItem, walletsItem } from '@/lib/storage/items';
import type { Blockchain } from '@/lib/storage/schemas';
import { signingKeyFor, type WalletRef } from './wallet.service';

export type FuelState = 'none' | 'free' | 'fee';

export interface TransactRequest {
  chainId: string;
  wallet: WalletRef;
  actions: ActionInput[];
  acceptFee?: boolean;
}

export type TransactResult =
  | {
      status: 'success';
      chainId: string;
      transactionId: string;
      blockNum?: number;
      fuel: FuelState;
      fee?: string;
      actions: DecodedAction[];
    }
  | {
      status: 'unsigned';
      chainId: string;
      transaction: Record<string, unknown>;
      file: Record<string, unknown>;
      esr: string;
      actions: DecodedAction[];
      expiration: string;
    }
  | {
      status: 'ledger';
      chainId: string;
      transaction: Record<string, unknown>;
      cosignatures: string[];
      path: string;
      legacy: string;
      chunks: string[];
      fuel: FuelState;
      fee?: string;
      actions: DecodedAction[];
      expiration: string;
    }
  | {
      status: 'fee_required';
      chainId: string;
      fee: string;
      costs: Record<string, string>;
      actions: DecodedAction[];
    }
  | { status: 'error'; chainId: string; error: TxError; actions?: DecodedAction[] };

export type InspectResult =
  | { kind: 'esr'; uri: string }
  | {
      kind: 'transaction';
      signed: boolean;
      signatures: string[];
      transaction: Record<string, unknown>;
      actions: DecodedAction[];
      expiration: string;
      expired: boolean;
    }
  | { kind: 'invalid'; error: string };

export interface LedgerCompletion {
  chainId: string;
  transaction: Record<string, unknown>;
  cosignatures: string[];
  signature: string;
}

export interface TransactionService {
  transact(request: TransactRequest): Promise<TransactResult>;
  completeLedger(request: LedgerCompletion): Promise<TransactResult>;
  inspect(chainId: string, input: string): Promise<InspectResult>;
  broadcast(chainId: string, input: string): Promise<TransactResult>;
  hasContract(chainId: string, account: string): Promise<boolean>;
}

const SERVICE_KEY = 'TransactionService';
const ABI_TTL_MS = 15 * 60 * 1000;
const EMPTY_HASH = /^0+$/;

async function chainFor(chainId: string): Promise<Blockchain> {
  const chain = (await blockchainsItem.getValue()).find((entry) => entry.chainId === chainId);
  if (!chain) throw new Error('unknown_chain');
  return chain;
}

export function readerFor(chain: Blockchain): ChainReader {
  const client = clientFor(chain.node);
  return {
    getInfo: () => client.v1.chain.get_info(),
    async getAbi(account) {
      const key = `${chain.chainId}:${account}`;
      const cache = await abiCacheItem.getValue();
      const hit = cache[key];
      if (hit && Date.now() - hit.fetchedAt < ABI_TTL_MS) return ABI.from(hit.abi as ABI.Def);
      const result = await client.v1.chain.get_abi(account);
      if (!result.abi) throw new Error('missing_abi');
      const latest = await abiCacheItem.getValue();
      await abiCacheItem.setValue({ ...latest, [key]: { abi: result.abi, fetchedAt: Date.now() } });
      return ABI.from(result.abi);
    },
  };
}

function failure(chainId: string, error: unknown, actions?: DecodedAction[]): TransactResult {
  return { status: 'error', chainId, error: normalizeChainError(error), actions };
}

export const transactionService: TransactionService = {
  async transact({ chainId, wallet: ref, actions, acceptFee }) {
    let decoded: DecodedAction[] | undefined;
    try {
      const chain = await chainFor(chainId);
      const wallet = (await walletsItem.getValue()).find(
        (entry) =>
          entry.chainId === ref.chainId &&
          entry.account === ref.account &&
          entry.authorization === ref.authorization,
      );
      if (!wallet) throw new Error('invalid');
      const reader = readerFor(chain);

      if (wallet.mode === 'watch' || wallet.mode === 'cold') {
        const { transaction, abis } = await buildTransaction(
          reader,
          actions,
          EXPIRE_EXPORT_SECONDS,
        );
        return {
          status: 'unsigned',
          chainId,
          transaction: transactionToJson(transaction),
          file: unsignedExport(transaction, abis),
          esr: await encodeTransactionRequest(transaction, chainId, abis),
          actions: decodeActions(transaction, abis),
          expiration: String(transaction.expiration),
        };
      }

      const ledger = wallet.mode === 'ledger';
      const key = ledger ? undefined : await signingKeyFor(wallet.pubkey);
      if (!ledger && !key) throw new Error('locked');

      const { transaction, abis } = await buildTransaction(
        reader,
        actions,
        ledger ? EXPIRE_LEDGER_SECONDS : EXPIRE_SIGN_SECONDS,
      );
      decoded = decodeActions(transaction, abis);
      let final = transaction;
      let cosignatures: string[] = [];
      let fuel: FuelState = 'none';
      let fee: string | undefined;

      const endpoint = fuelEndpointFor(chain);
      if (endpoint && String(transaction.actions[0]?.account) !== FUEL_NOOP_CONTRACT) {
        const signer = { actor: wallet.account, permission: wallet.authorization };
        const esr = await encodeTransactionRequest(transaction, chainId, abis);
        const quote = await requestFuel(endpoint, esr, signer);
        if (quote.kind === 'free') {
          validateFuelTransaction(transaction, quote.transaction, signer);
          final = quote.transaction;
          cosignatures = quote.signatures;
          fuel = 'free';
        } else if (quote.kind === 'fee') {
          const settings = await settingsItem.getValue();
          if (!(acceptFee || settings.transactionFees)) {
            return {
              status: 'fee_required',
              chainId,
              fee: quote.fee,
              costs: quote.costs,
              actions: decoded,
            };
          }
          validateFuelTransaction(transaction, quote.transaction, signer, true);
          final = quote.transaction;
          cosignatures = quote.signatures;
          fuel = 'fee';
          fee = quote.fee;
        }
      }

      if (ledger) {
        return {
          status: 'ledger',
          chainId,
          transaction: transactionToJson(final),
          cosignatures,
          path: wallet.path ?? DEFAULT_PATH,
          legacy: legacyPublicKey(wallet.pubkey),
          chunks: ledgerChunks(chainId, final).map(toHex),
          fuel,
          fee,
          actions: decoded,
          expiration: String(final.expiration),
        };
      }

      const signed = signTransaction(final, key as string, chainId, cosignatures);
      const response = await clientFor(chain.node).v1.chain.send_transaction(signed);
      const blockNum = Number(response.processed?.block_num ?? 0);
      return {
        status: 'success',
        chainId,
        transactionId: String(response.transaction_id),
        blockNum: blockNum > 0 ? blockNum : undefined,
        fuel,
        fee,
        actions: decoded,
      };
    } catch (error) {
      return failure(chainId, error, decoded);
    }
  },

  async completeLedger({ chainId, transaction, cosignatures, signature }) {
    try {
      const parsed = String(new Signature(KeyType.K1, Bytes.from(fromHex(signature))));
      return await transactionService.broadcast(
        chainId,
        JSON.stringify({ ...transaction, signatures: [...cosignatures, parsed] }),
      );
    } catch (error) {
      return failure(chainId, error);
    }
  },

  async inspect(chainId, input) {
    const text = input.trim();
    if (isSigningRequestUri(text)) return { kind: 'esr', uri: text };
    try {
      const { transaction, signatures } = parseTransactionInput(text);
      let actions: DecodedAction[] = [];
      try {
        const chain = await chainFor(chainId);
        const abis = await loadAbis(
          readerFor(chain),
          transaction.actions.map((action) => String(action.account)),
        );
        actions = decodeActions(transaction, abis);
      } catch {
        actions = decodeActions(transaction, {});
      }
      const expiration = String(transaction.expiration);
      return {
        kind: 'transaction',
        signed: signatures.length > 0,
        signatures,
        transaction: transactionToJson(transaction),
        actions,
        expiration,
        expired: Date.parse(`${expiration}Z`) < Date.now(),
      };
    } catch (error) {
      return { kind: 'invalid', error: error instanceof Error ? error.message : 'invalid' };
    }
  },

  async broadcast(chainId, input) {
    let decoded: DecodedAction[] | undefined;
    try {
      const chain = await chainFor(chainId);
      const { transaction, signatures } = parseTransactionInput(input);
      if (signatures.length === 0) throw new Error('invalid');
      decoded = decodeActions(transaction, {});
      const signed = SignedTransaction.from({ ...transaction, signatures });
      const response = await clientFor(chain.node).v1.chain.send_transaction(signed);
      const blockNum = Number(response.processed?.block_num ?? 0);
      return {
        status: 'success',
        chainId,
        transactionId: String(response.transaction_id),
        blockNum: blockNum > 0 ? blockNum : undefined,
        fuel: 'none',
        actions: decoded,
      };
    } catch (error) {
      return failure(chainId, error, decoded);
    }
  },

  async hasContract(chainId, account) {
    try {
      const chain = await chainFor(chainId);
      const result = (await clientFor(chain.node).call({
        path: '/v1/chain/get_code_hash',
        params: { account_name: account },
      })) as { code_hash?: string };
      return Boolean(result.code_hash) && !EMPTY_HASH.test(result.code_hash ?? '');
    } catch {
      return false;
    }
  },
};

export function registerTransactionService(): void {
  registerService(SERVICE_KEY, transactionService);
}

export function useTransactionService(): TransactionService {
  return createProxyService<TransactionService>(SERVICE_KEY);
}
