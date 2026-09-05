import { createProxyService, registerService } from '@webext-core/proxy-service';
import { z } from 'zod';
import { clientFor } from '@/lib/antelope/client';
import { blockchainsItem } from '@/lib/storage/items';
import type { Blockchain } from '@/lib/storage/schemas';

const PRODUCER_LIMIT = 200;
const TIMEOUT_MS = 5000;

export interface ApiEndpoint {
  url: string;
  producer: string;
  location: string;
}

export interface PingResult {
  url: string;
  ok: boolean;
  latencyMs: number | null;
  headBlockNum: number | null;
  error: string | null;
}

export interface PingService {
  listEndpoints(chainId: string): Promise<ApiEndpoint[]>;
  ping(chainId: string, url: string): Promise<PingResult>;
}

const SERVICE_KEY = 'PingService';

const producerJsonRowSchema = z.object({ owner: z.string(), json: z.string() });

const producerJsonSchema = z.object({
  org: z.object({ candidate_name: z.string().optional() }).optional(),
  nodes: z
    .array(
      z.object({
        node_type: z.union([z.string(), z.array(z.string())]).optional(),
        ssl_endpoint: z.string().optional(),
        api_endpoint: z.string().optional(),
        location: z.object({ name: z.string().optional() }).optional(),
      }),
    )
    .default([]),
});

async function chainFor(chainId: string): Promise<Blockchain> {
  const chain = (await blockchainsItem.getValue()).find((entry) => entry.chainId === chainId);
  if (!chain) throw new Error('unknown_chain');
  return chain;
}

export const pingService: PingService = {
  async listEndpoints(chainId) {
    const chain = await chainFor(chainId);
    if (!chain.features.includes('producerinfo')) return [];
    const result = await clientFor(chain.node).v1.chain.get_table_rows({
      code: 'producerjson',
      scope: 'producerjson',
      table: 'producerjson',
      json: true,
      limit: PRODUCER_LIMIT,
    });
    const endpoints: ApiEndpoint[] = [];
    const seen = new Set<string>();
    for (const row of z.array(producerJsonRowSchema).parse(result.rows)) {
      let parsed;
      try {
        parsed = producerJsonSchema.parse(JSON.parse(row.json));
      } catch {
        continue;
      }
      for (const node of parsed.nodes) {
        const url = (node.ssl_endpoint ?? '').trim();
        if (!url.startsWith('https://')) continue;
        const clean = url.replace(/\/$/, '');
        if (seen.has(clean)) continue;
        seen.add(clean);
        endpoints.push({
          url: clean,
          producer: row.owner,
          location: node.location?.name ?? '',
        });
      }
    }
    return endpoints;
  },

  async ping(chainId, url) {
    const chain = await chainFor(chainId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const started = Date.now();
    try {
      const response = await fetch(`${url}/v1/chain/get_info`, {
        method: 'POST',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`http_${response.status}`);
      const info = (await response.json()) as { chain_id?: string; head_block_num?: number };
      if (info.chain_id !== chain.chainId) throw new Error('mismatch_chainid');
      return {
        url,
        ok: true,
        latencyMs: Date.now() - started,
        headBlockNum: info.head_block_num ?? null,
        error: null,
      };
    } catch (error) {
      return {
        url,
        ok: false,
        latencyMs: null,
        headBlockNum: null,
        error: error instanceof Error ? error.message : 'unreachable',
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

export function registerPingService(): void {
  registerService(SERVICE_KEY, pingService);
}

export function usePingService(): PingService {
  return createProxyService<PingService>(SERVICE_KEY);
}
