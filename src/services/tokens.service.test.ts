import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { customTokensItem } from '@/lib/storage/items';
import { ensureSeededChains } from './chain.service';
import { tokensService } from './tokens.service';

const eos = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let scanSupported = true;

function handle(url: string): Response {
  if (url.endsWith('/v1/chain/get_currency_stats')) {
    return jsonResponse({
      USDT: { supply: '1000.0000 USDT', max_supply: '2000.0000 USDT', issuer: 'tethertether' },
    });
  }
  if (url.includes('/v2/state/get_tokens')) {
    if (!scanSupported) return jsonResponse({ error: 'not found' }, 404);
    return jsonResponse({
      tokens: [
        { symbol: 'EOS', precision: 4, amount: 10, contract: 'eosio.token' },
        { symbol: 'USDT', precision: 4, amount: 5, contract: 'tethertether' },
      ],
    });
  }
  throw new Error(`unexpected request ${url}`);
}

describe('tokens service', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    scanSupported = true;
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => Promise.resolve(handle(String(input))));
    await ensureSeededChains();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds a token with its precision and removes it again', async () => {
    const added = await tokensService.add(eos, 'tethertether', 'USDT');
    expect(added).toEqual([
      { chainId: eos, contract: 'tethertether', symbol: 'USDT', precision: 4 },
    ]);

    await tokensService.add(eos, 'tethertether', 'USDT');
    expect(await tokensService.list(eos)).toHaveLength(1);

    expect(await tokensService.remove(eos, 'tethertether', 'USDT')).toEqual([]);
    expect(await customTokensItem.getValue()).toEqual([]);
  });

  it('scans an account and skips the system token', async () => {
    await tokensService.add(eos, 'tethertether', 'USDT');
    const scanned = await tokensService.scan(eos, 'teamgreymass');
    expect(scanned).toEqual([
      { contract: 'tethertether', symbol: 'USDT', amount: '5 USDT', tracked: true },
    ]);
  });

  it('reports nodes without a token index', async () => {
    scanSupported = false;
    await expect(tokensService.scan(eos, 'teamgreymass')).rejects.toThrow('scan_unsupported');
  });
});
