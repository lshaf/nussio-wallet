import { createProxyService, registerService } from '@webext-core/proxy-service';
import { Name } from '@wharfkit/antelope';
import { z } from 'zod';
import { clientFor } from '@/lib/antelope/client';
import { blockchainsItem } from '@/lib/storage/items';
import type { Blockchain } from '@/lib/storage/schemas';

const PRODUCER_LIMIT = 200;
const PROXY_LIMIT = 300;

export interface Producer {
  rank: number;
  owner: string;
  url: string;
  totalVotes: number;
  share: number;
  isActive: boolean;
}

export interface ProducerList {
  chainId: string;
  fetchedAt: number;
  totalVoteWeight: number;
  producers: Producer[];
}

export interface Proxy {
  owner: string;
  name: string;
  website: string;
  slogan: string;
  logo: string;
}

export interface ProducerDetail {
  owner: string;
  json: Record<string, unknown> | null;
}

export interface GovernanceService {
  listProducers(chainId: string): Promise<ProducerList>;
  listProxies(chainId: string): Promise<Proxy[]>;
  getProducerDetail(chainId: string, owner: string): Promise<ProducerDetail>;
}

const SERVICE_KEY = 'GovernanceService';

const proxyRowSchema = z.object({
  owner: z.string(),
  name: z.string().default(''),
  website: z.string().default(''),
  slogan: z.string().default(''),
  logo_256: z.string().default(''),
});

const producerJsonRowSchema = z.object({ owner: z.string(), json: z.string() });

const producerRowSchema = z.object({
  owner: z.string(),
  total_votes: z.union([z.string(), z.number()]),
  is_active: z.number(),
  url: z.string().default(''),
});

const globalRowSchema = z.object({
  total_producer_vote_weight: z.union([z.string(), z.number()]).default(0),
});

async function chainFor(chainId: string): Promise<Blockchain> {
  const chain = (await blockchainsItem.getValue()).find((entry) => entry.chainId === chainId);
  if (!chain) throw new Error('unknown_chain');
  return chain;
}

export const governanceService: GovernanceService = {
  async listProducers(chainId) {
    const chain = await chainFor(chainId);
    const client = clientFor(chain.node);
    const [rows, globals] = await Promise.all([
      client.v1.chain.get_table_rows({
        code: chain.systemContract,
        scope: chain.systemContract,
        table: 'producers',
        json: true,
        limit: PRODUCER_LIMIT,
        index_position: 'secondary',
        key_type: 'float64',
      }),
      client.v1.chain.get_table_rows({
        code: chain.systemContract,
        scope: chain.systemContract,
        table: 'global',
        json: true,
        limit: 1,
      }),
    ]);
    const total = Number(globalRowSchema.parse(globals.rows[0] ?? {}).total_producer_vote_weight);
    const producers = z
      .array(producerRowSchema)
      .parse(rows.rows)
      .map((row) => ({
        owner: row.owner,
        url: row.url,
        totalVotes: Number(row.total_votes),
        isActive: row.is_active === 1,
      }))
      .filter((row) => row.isActive)
      .sort((a, b) => b.totalVotes - a.totalVotes)
      .map((row, index) => ({
        ...row,
        rank: index + 1,
        share: total > 0 ? (row.totalVotes / total) * 100 : 0,
      }));
    return { chainId, fetchedAt: Date.now(), totalVoteWeight: total, producers };
  },

  async listProxies(chainId) {
    const chain = await chainFor(chainId);
    if (!chain.features.includes('regproxyinfo')) return [];
    const result = await clientFor(chain.node).v1.chain.get_table_rows({
      code: 'regproxyinfo',
      scope: 'regproxyinfo',
      table: 'proxies',
      json: true,
      limit: PROXY_LIMIT,
    });
    return z
      .array(proxyRowSchema)
      .parse(result.rows)
      .map((row) => ({
        owner: row.owner,
        name: row.name || row.owner,
        website: row.website,
        slogan: row.slogan,
        logo: row.logo_256,
      }))
      .filter((row) => row.name.length > 0);
  },

  async getProducerDetail(chainId, owner) {
    const chain = await chainFor(chainId);
    if (!chain.features.includes('producerinfo')) return { owner, json: null };
    try {
      const result = await clientFor(chain.node).v1.chain.get_table_rows({
        code: 'producerjson',
        scope: 'producerjson',
        table: 'producerjson',
        json: true,
        lower_bound: Name.from(owner),
        upper_bound: Name.from(owner),
        limit: 1,
      });
      const row = z.array(producerJsonRowSchema).parse(result.rows)[0];
      if (!row) return { owner, json: null };
      return { owner, json: JSON.parse(row.json) as Record<string, unknown> };
    } catch {
      return { owner, json: null };
    }
  },
};

export function registerGovernanceService(): void {
  registerService(SERVICE_KEY, governanceService);
}

export function useGovernanceService(): GovernanceService {
  return createProxyService<GovernanceService>(SERVICE_KEY);
}
