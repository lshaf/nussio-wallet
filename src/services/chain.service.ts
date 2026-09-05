import { createProxyService, registerService } from '@webext-core/proxy-service';
import { builtinChains } from '@/lib/antelope/chains';
import { clientFor } from '@/lib/antelope/client';
import { blockchainsItem, settingsItem } from '@/lib/storage/items';
import { blockchainSchema, type Blockchain } from '@/lib/storage/schemas';
import { z } from 'zod';

export interface NodeValidation {
  ok: boolean;
  chainId?: string;
  headBlockNum?: number;
  error?: 'unreachable' | 'mismatch_chainid' | 'not_synced';
}

export interface ChainInfo {
  chainId: string;
  headBlockNum: number;
  headBlockTime: string;
  lastIrreversibleBlockNum: number;
}

export interface RamPrice {
  pricePerByte: number;
  symbol: string;
  precision: number;
}

export interface PriceFeed {
  pair: string;
  usd: number;
}

const WAX_CHAIN_ID = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';

const ramMarketRowSchema = z.object({
  base: z.object({ balance: z.string() }),
  quote: z.object({ balance: z.string() }),
});

const datapointRowSchema = z.object({ median: z.union([z.number(), z.string()]) });

async function chainFor(chainId: string): Promise<Blockchain> {
  const chain = (await blockchainsItem.getValue()).find((entry) => entry.chainId === chainId);
  if (!chain) throw new Error('unknown_chain');
  return chain;
}

export interface ChainService {
  list(): Promise<Blockchain[]>;
  getInfo(chainId: string): Promise<ChainInfo>;
  getRamPrice(chainId: string): Promise<RamPrice | null>;
  getPriceFeed(chainId: string): Promise<PriceFeed | null>;
  ensureSeeded(): Promise<Blockchain[]>;
  upsert(chain: Blockchain): Promise<Blockchain[]>;
  remove(chainId: string): Promise<Blockchain[]>;
  setNode(chainId: string, node: string): Promise<Blockchain[]>;
  setEnabled(chainIds: string[]): Promise<void>;
  validateNode(node: string, expectedChainId?: string): Promise<NodeValidation>;
}

const SERVICE_KEY = 'ChainService';

export async function ensureSeededChains(): Promise<Blockchain[]> {
  const existing = await blockchainsItem.getValue();
  const known = new Set(existing.map((chain) => chain.chainId));
  const repaired = existing.flatMap((stored) => {
    const builtin = builtinChains.find((chain) => chain.chainId === stored.chainId);
    const parsed = blockchainSchema.safeParse(
      builtin ? { ...builtin, ...stored, features: builtin.features } : stored,
    );
    return parsed.success ? [parsed.data] : [];
  });
  const missing = builtinChains.filter((chain) => !known.has(chain.chainId));
  const merged = [...repaired, ...missing];
  if (JSON.stringify(merged) !== JSON.stringify(existing)) await blockchainsItem.setValue(merged);
  return merged;
}

export const chainService: ChainService = {
  list: () => blockchainsItem.getValue(),

  async getInfo(chainId) {
    const chain = await chainFor(chainId);
    const info = await clientFor(chain.node).v1.chain.get_info();
    return {
      chainId: String(info.chain_id),
      headBlockNum: Number(info.head_block_num),
      headBlockTime: String(info.head_block_time),
      lastIrreversibleBlockNum: Number(info.last_irreversible_block_num),
    };
  },

  async getRamPrice(chainId) {
    const chain = await chainFor(chainId);
    if (!chain.stakedResources) return null;
    try {
      const result = await clientFor(chain.node).v1.chain.get_table_rows({
        code: chain.systemContract,
        scope: chain.systemContract,
        table: 'rammarket',
        json: true,
        limit: 1,
      });
      const row = z.array(ramMarketRowSchema).parse(result.rows)[0];
      if (!row) return null;
      const [baseAmount] = row.base.balance.split(' ');
      const [quoteAmount, quoteSymbol = chain.symbol] = row.quote.balance.split(' ');
      const bytes = Number(baseAmount);
      const tokens = Number(quoteAmount);
      if (!bytes || !tokens) return null;
      const [, decimals = ''] = (quoteAmount ?? '').split('.');
      return { pricePerByte: tokens / bytes, symbol: quoteSymbol, precision: decimals.length };
    } catch {
      return null;
    }
  },

  async getPriceFeed(chainId) {
    const chain = await chainFor(chainId);
    if (!chain.features.includes('delphioracle')) return null;
    const pair = chainId === WAX_CHAIN_ID ? 'waxpusd' : 'eosusd';
    try {
      const result = await clientFor(chain.node).v1.chain.get_table_rows({
        code: 'delphioracle',
        scope: pair,
        table: 'datapoints',
        json: true,
        limit: 1,
        reverse: true,
      });
      const row = z.array(datapointRowSchema).parse(result.rows)[0];
      if (!row) return null;
      return { pair, usd: Number(row.median) / 10_000 };
    } catch {
      return null;
    }
  },

  ensureSeeded: ensureSeededChains,

  async upsert(input) {
    const chain = blockchainSchema.parse(input);
    const chains = await blockchainsItem.getValue();
    const index = chains.findIndex((entry) => entry.chainId === chain.chainId);
    if (index === -1) chains.push(chain);
    else chains[index] = chain;
    await blockchainsItem.setValue(chains);
    return chains;
  },

  async remove(chainId) {
    const chains = (await blockchainsItem.getValue()).filter(
      (entry) => entry.chainId !== chainId || !entry.custom,
    );
    await blockchainsItem.setValue(chains);
    const settings = await settingsItem.getValue();
    await settingsItem.setValue({
      ...settings,
      enabledChains: settings.enabledChains.filter((id) => id !== chainId),
      pinnedChains: settings.pinnedChains.filter((id) => id !== chainId),
    });
    return chains;
  },

  async setNode(chainId, node) {
    const chains = await blockchainsItem.getValue();
    const chain = chains.find((entry) => entry.chainId === chainId);
    if (!chain) throw new Error('unknown_chain');
    chain.node = blockchainSchema.shape.node.parse(node);
    await blockchainsItem.setValue(chains);
    return chains;
  },

  async setEnabled(chainIds) {
    const settings = await settingsItem.getValue();
    const chainId =
      settings.chainId && chainIds.includes(settings.chainId)
        ? settings.chainId
        : (chainIds[0] ?? null);
    await settingsItem.setValue({ ...settings, enabledChains: chainIds, chainId });
  },

  async validateNode(node, expectedChainId) {
    try {
      const info = await clientFor(node).v1.chain.get_info();
      const chainId = String(info.chain_id);
      const headBlockNum = Number(info.head_block_num);
      if (headBlockNum <= 1) return { ok: false, chainId, headBlockNum, error: 'not_synced' };
      if (expectedChainId && expectedChainId !== chainId) {
        return { ok: false, chainId, headBlockNum, error: 'mismatch_chainid' };
      }
      return { ok: true, chainId, headBlockNum };
    } catch {
      return { ok: false, error: 'unreachable' };
    }
  },
};

export function registerChainService(): void {
  registerService(SERVICE_KEY, chainService);
}

export function useChainService(): ChainService {
  return createProxyService<ChainService>(SERVICE_KEY);
}
