import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ensureSeededChains } from './chain.service';
import { accountService } from './account.service';

const proton = '384da888112027f0321850a169f737c33e53b388aad48b5adace4bab97f437e0';
const eos = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function account(core: string | undefined) {
  return {
    account_name: 'eosio',
    head_block_num: 1,
    head_block_time: '2026-01-01T00:00:00.000',
    privileged: false,
    last_code_update: '2026-01-01T00:00:00.000',
    created: '2026-01-01T00:00:00.000',
    ram_quota: 10,
    net_weight: 1,
    cpu_weight: 1,
    net_limit: { used: 0, available: 1, max: 1 },
    cpu_limit: { used: 0, available: 1, max: 1 },
    ram_usage: 5,
    permissions: [],
    ...(core === undefined ? {} : { core_liquid_balance: core }),
  };
}

let core: string | undefined = '9997.1471 SYS';
let currencyCalls = 0;

function handle(url: string): Response {
  if (url.endsWith('/v1/chain/get_account')) return jsonResponse(account(core));
  if (url.endsWith('/v1/chain/get_currency_balance')) {
    currencyCalls += 1;
    return jsonResponse(['12.3456 XPR']);
  }
  if (url.endsWith('/v1/chain/get_table_rows')) return jsonResponse({ rows: [], more: false });
  throw new Error(`unexpected request ${url}`);
}

describe('account service balances', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    currencyCalls = 0;
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => Promise.resolve(handle(String(input))));
    await ensureSeededChains();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores a core balance in another symbol and reads the chain token', async () => {
    core = '9997.1471 SYS';
    const data = await accountService.getAccountData(proton, 'eosio');
    expect(data?.balance).toBe('12.3456 XPR');
    expect(currencyCalls).toBe(1);
  });

  it('keeps the core balance when it matches the chain token', async () => {
    core = '100.0000 EOS';
    const data = await accountService.getAccountData(eos, 'eosio');
    expect(data?.balance).toBe('100.0000 EOS');
    expect(currencyCalls).toBe(0);
  });

  it('falls back to the token contract when there is no core balance', async () => {
    core = undefined;
    const data = await accountService.getAccountData(proton, 'eosio');
    expect(data?.balance).toBe('12.3456 XPR');
  });
});
