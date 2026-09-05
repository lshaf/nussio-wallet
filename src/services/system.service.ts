import { createProxyService, registerService } from '@webext-core/proxy-service';
import { Asset, Name } from '@wharfkit/antelope';
import { z } from 'zod';
import { clientFor } from '@/lib/antelope/client';
import { blockchainsItem } from '@/lib/storage/items';
import type { Blockchain } from '@/lib/storage/schemas';

export interface NameBid {
  name: string;
  highBidder: string;
  highBid: string;
  settled: boolean;
  lastBidTime: string;
}

export type NameState = 'available' | 'taken' | 'bidding';

export interface NameStatus {
  name: string;
  state: NameState;
  bid: NameBid | null;
}

export interface SystemService {
  getNameStatus(chainId: string, name: string): Promise<NameStatus>;
  getNameBids(chainId: string, names: string[]): Promise<NameBid[]>;
  listOpenNameBids(chainId: string, limit?: number): Promise<NameBid[]>;
}

const SERVICE_KEY = 'SystemService';

const nameBidRowSchema = z.object({
  newname: z.string(),
  high_bidder: z.string(),
  high_bid: z.union([z.number(), z.string()]),
  last_bid_time: z.string(),
});

async function chainFor(chainId: string): Promise<Blockchain> {
  const chain = (await blockchainsItem.getValue()).find((entry) => entry.chainId === chainId);
  if (!chain) throw new Error('unknown_chain');
  return chain;
}

function bidAmount(chain: Blockchain, units: number): string {
  return String(Asset.fromUnits(Math.abs(units), `${chain.tokenPrecision},${chain.symbol}`));
}

async function fetchBid(chain: Blockchain, name: string): Promise<NameBid | null> {
  try {
    const result = await clientFor(chain.node).v1.chain.get_table_rows({
      code: chain.systemContract,
      scope: chain.systemContract,
      table: 'namebids',
      json: true,
      lower_bound: Name.from(name),
      upper_bound: Name.from(name),
      limit: 1,
    });
    const row = z.array(nameBidRowSchema).parse(result.rows)[0];
    if (!row || row.newname !== name) return null;
    const units = Number(row.high_bid);
    return {
      name: row.newname,
      highBidder: row.high_bidder,
      highBid: bidAmount(chain, units),
      settled: units <= 0,
      lastBidTime: row.last_bid_time,
    };
  } catch {
    return null;
  }
}

export const systemService: SystemService = {
  async getNameStatus(chainId, name) {
    const chain = await chainFor(chainId);
    let exists: boolean;
    try {
      await clientFor(chain.node).v1.chain.get_account(name);
      exists = true;
    } catch {
      exists = false;
    }
    const bid = await fetchBid(chain, name);
    if (exists) return { name, state: 'taken', bid };
    return { name, state: bid && !bid.settled ? 'bidding' : 'available', bid };
  },

  async listOpenNameBids(chainId, limit = 25) {
    const chain = await chainFor(chainId);
    const result = await clientFor(chain.node).v1.chain.get_table_rows({
      code: chain.systemContract,
      scope: chain.systemContract,
      table: 'namebids',
      json: true,
      limit,
      index_position: 'secondary',
      key_type: 'i64',
      reverse: true,
    });
    return z
      .array(nameBidRowSchema)
      .parse(result.rows)
      .filter((row) => Number(row.high_bid) > 0)
      .map((row) => ({
        name: row.newname,
        highBidder: row.high_bidder,
        highBid: bidAmount(chain, Number(row.high_bid)),
        settled: false,
        lastBidTime: row.last_bid_time,
      }));
  },

  async getNameBids(chainId, names) {
    const chain = await chainFor(chainId);
    const bids = await Promise.all(names.map((name) => fetchBid(chain, name)));
    return bids.filter((bid): bid is NameBid => bid !== null);
  },
};

export function registerSystemService(): void {
  registerService(SERVICE_KEY, systemService);
}

export function useSystemService(): SystemService {
  return createProxyService<SystemService>(SERVICE_KEY);
}
