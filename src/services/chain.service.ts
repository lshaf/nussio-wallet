import { createProxyService, registerService } from '@webext-core/proxy-service';
import { APIClient } from '@wharfkit/antelope';
import { builtinChains } from '@/lib/antelope/chains';
import { blockchainsItem } from '@/lib/storage/items';
import { blockchainSchema, type Blockchain } from '@/lib/storage/schemas';

export interface NodeValidation {
  ok: boolean;
  chainId?: string;
  headBlockNum?: number;
  error?: 'unreachable' | 'mismatch_chainid' | 'not_synced';
}

export interface ChainService {
  list(): Promise<Blockchain[]>;
  ensureSeeded(): Promise<Blockchain[]>;
  upsert(chain: Blockchain): Promise<Blockchain[]>;
  validateNode(node: string, expectedChainId?: string): Promise<NodeValidation>;
}

const SERVICE_KEY = 'ChainService';

export async function ensureSeededChains(): Promise<Blockchain[]> {
  const existing = await blockchainsItem.getValue();
  const known = new Set(existing.map((chain) => chain.chainId));
  const missing = builtinChains.filter((chain) => !known.has(chain.chainId));
  if (missing.length === 0) return existing;
  const merged = [...existing, ...missing];
  await blockchainsItem.setValue(merged);
  return merged;
}

export const chainService: ChainService = {
  list: () => blockchainsItem.getValue(),

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

  async validateNode(node, expectedChainId) {
    try {
      const client = new APIClient({ url: node });
      const info = await client.v1.chain.get_info();
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
