import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import fixtures from './__fixtures__/jungle4-resources.json';
import { ensureSeededChains } from './chain.service';
import { resourcesService } from './resources.service';

const jungle4 = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d';
const wax = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function handle(url: string, init?: RequestInit): Response {
  if (url.endsWith('/v1/chain/get_account')) return jsonResponse(fixtures.account);
  if (url.endsWith('/v1/chain/get_table_rows')) {
    const body = JSON.parse(String(init?.body ?? '{}')) as { table?: string };
    if (body.table === 'rammarket') return jsonResponse(fixtures.rammarket);
    if (body.table === 'powup.state') return jsonResponse(fixtures.powup);
    if (body.table === 'rexpool') return jsonResponse(fixtures.rexpool);
  }
  throw new Error(`unexpected request ${url}`);
}

describe('resources service', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(handle(String(input), init)),
    );
    await ensureSeededChains();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads ram, powerup and rex state for a chain that has all three', async () => {
    const state = await resourcesService.getState(jungle4);
    expect(state.ram?.symbol).toBe('EOS');
    expect(state.ram?.pricePerByte).toBeGreaterThan(0);
    expect(state.powerup?.days).toBe(1);
    expect(state.powerup?.cpuPricePerMs).toBeGreaterThan(0);
    expect(state.rex?.cpuPricePerMs).toBeGreaterThan(0);
  });

  it('omits rex on a chain without the feature', async () => {
    const state = await resourcesService.getState(wax);
    expect(state.rex).toBeNull();
    expect(state.symbol).toBe('WAX');
    expect(state.precision).toBe(8);
  });

  it('quotes powerup with fracs and a padded max payment', async () => {
    const quote = await resourcesService.quotePowerUp(jungle4, 10, 2);
    expect(quote.days).toBe(1);
    expect(Number(quote.cpuFrac)).toBeGreaterThan(0);
    expect(Number(quote.netFrac)).toBeGreaterThan(0);
    expect(quote.maxPayment).toMatch(/^\d+\.\d{4} EOS$/);
    expect(Number(quote.maxPayment.split(' ')[0])).toBeGreaterThanOrEqual(quote.cost);
  });

  it('quotes rex rentals and ram both ways', async () => {
    const rex = await resourcesService.quoteRex(jungle4, 10, 0);
    expect(rex.cost).toBeGreaterThan(0);
    expect(rex.payment).toMatch(/ EOS$/);

    const byBytes = await resourcesService.quoteRamBuy(jungle4, { bytes: 4096 });
    expect(byBytes.bytes).toBe(4096);
    expect(byBytes.cost).toBeGreaterThan(0);

    const byAmount = await resourcesService.quoteRamBuy(jungle4, { amount: 1 });
    expect(byAmount.bytes).toBeGreaterThan(0);
    expect(byAmount.quantity).toBe('1.0000 EOS');

    const sell = await resourcesService.quoteRamSell(jungle4, byBytes.bytes);
    expect(sell.cost).toBeLessThan(byBytes.cost);
  });
});
