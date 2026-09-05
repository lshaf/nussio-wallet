import { createProxyService, registerService } from '@webext-core/proxy-service';
import { Asset, Name } from '@wharfkit/antelope';
import { z } from 'zod';
import { clientFor } from '@/lib/antelope/client';
import { blockchainsItem, customTokensItem } from '@/lib/storage/items';
import { customTokenSchema, type Blockchain, type CustomToken } from '@/lib/storage/schemas';

export interface ScannedToken {
  contract: string;
  symbol: string;
  amount: string;
  tracked: boolean;
}

export interface TokensService {
  list(chainId: string): Promise<CustomToken[]>;
  add(chainId: string, contract: string, symbol: string): Promise<CustomToken[]>;
  remove(chainId: string, contract: string, symbol: string): Promise<CustomToken[]>;
  scan(chainId: string, account: string): Promise<ScannedToken[]>;
}

const SERVICE_KEY = 'TokensService';

const scanResponseSchema = z.object({
  tokens: z.array(
    z.object({
      symbol: z.string(),
      precision: z.number().optional(),
      amount: z.union([z.number(), z.string()]).optional(),
      contract: z.string(),
    }),
  ),
});

async function chainFor(chainId: string): Promise<Blockchain> {
  const chain = (await blockchainsItem.getValue()).find((entry) => entry.chainId === chainId);
  if (!chain) throw new Error('unknown_chain');
  return chain;
}

function sameToken(a: CustomToken, contract: string, symbol: string): boolean {
  return a.contract === contract && a.symbol === symbol;
}

export const tokensService: TokensService = {
  async list(chainId) {
    return (await customTokensItem.getValue()).filter((token) => token.chainId === chainId);
  },

  async add(chainId, contract, symbol) {
    const chain = await chainFor(chainId);
    const token = customTokenSchema.parse({ chainId, contract, symbol });
    const client = clientFor(chain.node);
    const stats = await client.v1.chain.get_currency_stats(Name.from(token.contract), token.symbol);
    const row = stats[token.symbol];
    if (!row) throw new Error('unknown_token');
    token.precision = Asset.from(String(row.supply)).symbol.precision;
    const tokens = [...(await customTokensItem.getValue())];
    if (
      !tokens.some(
        (entry) => entry.chainId === chainId && sameToken(entry, token.contract, token.symbol),
      )
    ) {
      tokens.push(token);
      await customTokensItem.setValue(tokens);
    }
    return tokens.filter((entry) => entry.chainId === chainId);
  },

  async remove(chainId, contract, symbol) {
    const tokens = (await customTokensItem.getValue()).filter(
      (entry) => !(entry.chainId === chainId && sameToken(entry, contract, symbol)),
    );
    await customTokensItem.setValue(tokens);
    return tokens.filter((entry) => entry.chainId === chainId);
  },

  async scan(chainId, account) {
    const chain = await chainFor(chainId);
    const tracked = (await customTokensItem.getValue()).filter(
      (token) => token.chainId === chainId,
    );
    const url = `${chain.node.replace(/\/$/, '')}/v2/state/get_tokens?account=${encodeURIComponent(account)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('scan_unsupported');
    const parsed = scanResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('scan_unsupported');
    return parsed.data.tokens
      .filter((token) => token.contract !== chain.tokenContract || token.symbol !== chain.symbol)
      .map((token) => ({
        contract: token.contract,
        symbol: token.symbol,
        amount: `${token.amount ?? 0} ${token.symbol}`,
        tracked: tracked.some((entry) => sameToken(entry, token.contract, token.symbol)),
      }));
  },
};

export function registerTokensService(): void {
  registerService(SERVICE_KEY, tokensService);
}

export function useTokensService(): TokensService {
  return createProxyService<TokensService>(SERVICE_KEY);
}
