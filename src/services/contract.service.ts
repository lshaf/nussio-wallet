import { createProxyService, registerService } from '@webext-core/proxy-service';
import type { ABI } from '@wharfkit/antelope';
import { Name, Serializer, UInt64 } from '@wharfkit/antelope';
import { clientFor } from '@/lib/antelope/client';
import { abiCacheItem, blockchainsItem } from '@/lib/storage/items';
import type { Blockchain } from '@/lib/storage/schemas';
import { readerFor } from './transaction.service';

export interface AbiField {
  name: string;
  type: string;
}

export interface AbiAction {
  name: string;
  type: string;
  fields: AbiField[];
}

export interface AbiTable {
  name: string;
  type: string;
  indexType: string;
  keyNames: string[];
}

export interface ContractInfo {
  chainId: string;
  contract: string;
  actions: AbiAction[];
  tables: AbiTable[];
  abi: unknown;
}

export interface TableQuery {
  contract: string;
  table: string;
  scope?: string;
  limit?: number;
  lowerBound?: string;
  reverse?: boolean;
}

export interface TablePage {
  rows: unknown[];
  more: boolean;
  nextKey: string;
}

export interface AbiCacheEntryInfo {
  key: string;
  chainId: string;
  chainName: string;
  contract: string;
  fetchedAt: number;
}

export interface ContractService {
  getContract(chainId: string, contract: string): Promise<ContractInfo>;
  getTableRows(chainId: string, query: TableQuery): Promise<TablePage>;
  listAbiCache(): Promise<AbiCacheEntryInfo[]>;
  clearAbiCache(): Promise<void>;
}

const SERVICE_KEY = 'ContractService';

async function chainFor(chainId: string): Promise<Blockchain> {
  const chain = (await blockchainsItem.getValue()).find((entry) => entry.chainId === chainId);
  if (!chain) throw new Error('unknown_chain');
  return chain;
}

function fieldsFor(abi: ABI, structName: string, seen = new Set<string>()): AbiField[] {
  if (seen.has(structName)) return [];
  seen.add(structName);
  const struct = abi.structs.find((entry) => String(entry.name) === structName);
  if (!struct) return [];
  const inherited = struct.base ? fieldsFor(abi, String(struct.base), seen) : [];
  return [
    ...inherited,
    ...struct.fields.map((field) => ({ name: String(field.name), type: String(field.type) })),
  ];
}

function boundFor(value: string): Name | UInt64 {
  if (/^\d+$/.test(value)) return UInt64.from(value);
  return Name.from(value);
}

export const contractService: ContractService = {
  async getContract(chainId, contract) {
    const chain = await chainFor(chainId);
    const abi = await readerFor(chain).getAbi(contract);
    return {
      chainId,
      contract,
      actions: abi.actions.map((action) => ({
        name: String(action.name),
        type: String(action.type),
        fields: fieldsFor(abi, String(action.type)),
      })),
      tables: abi.tables.map((table) => ({
        name: String(table.name),
        type: String(table.type),
        indexType: String(table.index_type),
        keyNames: table.key_names.map((key) => String(key)),
      })),
      abi: Serializer.objectify(abi),
    };
  },

  async getTableRows(chainId, query) {
    const chain = await chainFor(chainId);
    const client = clientFor(chain.node);
    const params = {
      code: query.contract,
      scope: query.scope && query.scope.length > 0 ? query.scope : query.contract,
      table: query.table,
      json: true as const,
      limit: query.limit ?? 25,
      reverse: query.reverse ?? false,
    };
    const bound = query.lowerBound?.trim();
    const result = bound
      ? await client.v1.chain.get_table_rows({ ...params, lower_bound: boundFor(bound) })
      : await client.v1.chain.get_table_rows(params);
    return {
      rows: result.rows as unknown[],
      more: Boolean(result.more),
      nextKey: String(result.next_key ?? ''),
    };
  },

  async listAbiCache() {
    const [cache, chains] = await Promise.all([
      abiCacheItem.getValue(),
      blockchainsItem.getValue(),
    ]);
    return Object.entries(cache).map(([key, entry]) => {
      const [chainId = '', contract = ''] = key.split(':');
      return {
        key,
        chainId,
        chainName: chains.find((chain) => chain.chainId === chainId)?.name ?? chainId.slice(0, 8),
        contract,
        fetchedAt: entry.fetchedAt,
      };
    });
  },

  async clearAbiCache() {
    await abiCacheItem.setValue({});
  },
};

export function registerContractService(): void {
  registerService(SERVICE_KEY, contractService);
}

export function useContractService(): ContractService {
  return createProxyService<ContractService>(SERVICE_KEY);
}
