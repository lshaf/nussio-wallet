import { createProxyService, registerService } from '@webext-core/proxy-service';
import { Resources, type SampleUsage } from '@wharfkit/resources';
import { clientFor } from '@/lib/antelope/client';
import {
  ramBytesForTokens,
  ramCostForBytes,
  ramPricePerByte,
  ramProceedsForBytes,
  type RamMarket,
} from '@/lib/antelope/ram';
import { blockchainsItem } from '@/lib/storage/items';
import type { Blockchain } from '@/lib/storage/schemas';

const SAMPLE_ACCOUNTS = ['greymassfuel', 'eosio.token', 'eosio'];
const STATE_TTL_MS = 15_000;

export interface RamMarketState {
  pricePerByte: number;
  pricePerKb: number;
  symbol: string;
  precision: number;
}

export interface PowerUpInfo {
  days: number;
  minFee: string;
  cpuPricePerMs: number;
  netPricePerKb: number;
}

export interface RexInfo {
  cpuPricePerMs: number;
  netPricePerKb: number;
}

export interface ResourceState {
  chainId: string;
  fetchedAt: number;
  symbol: string;
  precision: number;
  ram: RamMarketState | null;
  powerup: PowerUpInfo | null;
  rex: RexInfo | null;
}

export interface PowerUpQuote {
  cost: number;
  maxPayment: string;
  cpuFrac: string;
  netFrac: string;
  days: number;
}

export interface RexQuote {
  cost: number;
  payment: string;
}

export interface RamQuote {
  bytes: number;
  cost: number;
  quantity: string;
}

export interface ResourcesService {
  getState(chainId: string, sample?: string): Promise<ResourceState>;
  quotePowerUp(chainId: string, ms: number, kb: number, sample?: string): Promise<PowerUpQuote>;
  quoteRex(chainId: string, ms: number, kb: number, sample?: string): Promise<RexQuote>;
  quoteRamBuy(chainId: string, input: { bytes?: number; amount?: number }): Promise<RamQuote>;
  quoteRamSell(chainId: string, bytes: number): Promise<RamQuote>;
}

const SERVICE_KEY = 'ResourcesService';

async function chainFor(chainId: string): Promise<Blockchain> {
  const chain = (await blockchainsItem.getValue()).find((entry) => entry.chainId === chainId);
  if (!chain) throw new Error('unknown_chain');
  return chain;
}

function resourcesFor(chain: Blockchain, sampleAccount: string): Resources {
  return new Resources({
    api: clientFor(chain.node),
    sampleAccount,
    symbol: `${chain.tokenPrecision},${chain.symbol}`,
  });
}

const samples = new Map<string, { usage: SampleUsage; account: string; fetchedAt: number }>();

async function sampleFor(
  chain: Blockchain,
  preferred?: string,
): Promise<{ usage: SampleUsage; resources: Resources }> {
  const cached = samples.get(chain.chainId);
  if (cached && Date.now() - cached.fetchedAt < STATE_TTL_MS) {
    return { usage: cached.usage, resources: resourcesFor(chain, cached.account) };
  }
  let lastError: unknown;
  const candidates = preferred ? [preferred, ...SAMPLE_ACCOUNTS] : SAMPLE_ACCOUNTS;
  for (const account of candidates) {
    const resources = resourcesFor(chain, account);
    try {
      const usage = await resources.getSampledUsage();
      samples.set(chain.chainId, { usage, account, fetchedAt: Date.now() });
      return { usage, resources };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('no_sample_account');
}

async function ramMarketFor(chain: Blockchain, sample?: string): Promise<RamMarket | null> {
  const { resources } = await sampleFor(chain, sample);
  const state = await resources.v1.ram.get_state();
  if (!state) return null;
  return {
    baseBytes: Number(state.base.balance.units),
    quoteUnits: Number(state.quote.balance.units),
    symbol: state.quote.balance.symbol.name,
    precision: state.quote.balance.symbol.precision,
  };
}

function unitPrice(price: (amount: number) => number, unit: number): number | null {
  for (const factor of [1, 10, 100, 1000, 10_000]) {
    try {
      return price(unit * factor) / factor;
    } catch {
      continue;
    }
  }
  return null;
}

function quoted(price: () => number): number {
  try {
    return price();
  } catch {
    throw new Error('amount_too_small');
  }
}

function quantityFor(chain: Blockchain, amount: number): string {
  return `${amount.toFixed(chain.tokenPrecision)} ${chain.symbol}`;
}

export const resourcesService: ResourcesService = {
  async getState(chainId, sample) {
    const chain = await chainFor(chainId);
    const { usage, resources } = await sampleFor(chain, sample);

    const market = await ramMarketFor(chain, sample).catch(() => null);
    const ram: RamMarketState | null = market
      ? {
          pricePerByte: ramPricePerByte(market),
          pricePerKb: ramCostForBytes(market, 1024),
          symbol: market.symbol,
          precision: market.precision,
        }
      : null;

    let powerup: PowerUpInfo | null = null;
    if (chain.features.includes('powerup')) {
      try {
        const state = await resources.v1.powerup.get_state();
        const cpu = state ? unitPrice((ms) => state.cpu.price_per_ms(usage, ms), 1) : null;
        const net = state ? unitPrice((kb) => state.net.price_per_kb(usage, kb), 1) : null;
        if (state && cpu !== null && net !== null) {
          powerup = {
            days: Number(state.powerup_days),
            minFee: String(state.min_powerup_fee),
            cpuPricePerMs: cpu,
            netPricePerKb: net,
          };
        }
      } catch {
        powerup = null;
      }
    }

    let rex: RexInfo | null = null;
    if (chain.features.includes('rex')) {
      try {
        const state = await resources.v1.rex.get_state();
        const cpu = state ? unitPrice((ms) => state.cpu_price_per_ms(usage, ms), 1) : null;
        const net = state ? unitPrice((kb) => state.net_price_per_kb(usage, kb), 1) : null;
        if (state && cpu !== null && net !== null) {
          rex = { cpuPricePerMs: cpu, netPricePerKb: net };
        }
      } catch {
        rex = null;
      }
    }

    return {
      chainId,
      fetchedAt: Date.now(),
      symbol: chain.symbol,
      precision: chain.tokenPrecision,
      ram,
      powerup,
      rex,
    };
  },

  async quotePowerUp(chainId, ms, kb, sample) {
    const chain = await chainFor(chainId);
    const { usage, resources } = await sampleFor(chain, sample);
    const state = await resources.v1.powerup.get_state();
    if (!state) throw new Error('powerup_unavailable');
    const cpuCost = ms > 0 ? quoted(() => state.cpu.price_per_ms(usage, ms)) : 0;
    const netCost = kb > 0 ? quoted(() => state.net.price_per_kb(usage, kb)) : 0;
    const minFee = Number(String(state.min_powerup_fee).split(' ')[0] ?? 0);
    const cost = Math.max(cpuCost + netCost, minFee);
    return {
      cost,
      maxPayment: quantityFor(chain, cost * 1.005),
      cpuFrac: String(ms > 0 ? state.cpu.frac_by_ms(usage, ms) : 0),
      netFrac: String(kb > 0 ? state.net.frac_by_kb(usage, kb) : 0),
      days: Number(state.powerup_days),
    };
  },

  async quoteRex(chainId, ms, kb, sample) {
    const chain = await chainFor(chainId);
    const { usage, resources } = await sampleFor(chain, sample);
    const state = await resources.v1.rex.get_state();
    if (!state) throw new Error('rex_unavailable');
    const cost =
      (ms > 0 ? quoted(() => state.cpu_price_per_ms(usage, ms)) : 0) +
      (kb > 0 ? quoted(() => state.net_price_per_kb(usage, kb)) : 0);
    return { cost, payment: quantityFor(chain, cost) };
  },

  async quoteRamBuy(chainId, input) {
    const chain = await chainFor(chainId);
    const market = await ramMarketFor(chain);
    if (!market) throw new Error('ram_unavailable');
    if (input.bytes !== undefined) {
      const cost = ramCostForBytes(market, Math.floor(input.bytes));
      return { bytes: Math.floor(input.bytes), cost, quantity: quantityFor(chain, cost) };
    }
    const amount = input.amount ?? 0;
    return {
      bytes: ramBytesForTokens(market, amount),
      cost: amount,
      quantity: quantityFor(chain, amount),
    };
  },

  async quoteRamSell(chainId, bytes) {
    const chain = await chainFor(chainId);
    const market = await ramMarketFor(chain);
    if (!market) throw new Error('ram_unavailable');
    const proceeds = ramProceedsForBytes(market, Math.floor(bytes));
    return {
      bytes: Math.floor(bytes),
      cost: proceeds,
      quantity: quantityFor(chain, proceeds),
    };
  },
};

export function registerResourcesService(): void {
  registerService(SERVICE_KEY, resourcesService);
}

export function useResourcesService(): ResourcesService {
  return createProxyService<ResourcesService>(SERVICE_KEY);
}
