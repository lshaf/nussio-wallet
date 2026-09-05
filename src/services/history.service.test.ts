import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { settingsItem } from '@/lib/storage/items';
import { ensureSeededChains } from './chain.service';
import { historyService } from './history.service';

const jungle4 = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d';
const waxTestnet = 'f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12';

const actions = [
  {
    timestamp: '2026-09-01T00:00:00.000',
    block_num: 10,
    trx_id: 'aa',
    global_sequence: 1,
    act: {
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{ actor: 'sender', permission: 'active' }],
      data: { from: 'sender', to: 'alice', quantity: '5.0000 EOS', memo: 'hi' },
    },
  },
  {
    timestamp: '2026-09-01T00:00:01.000',
    block_num: 11,
    trx_id: 'bb',
    global_sequence: 2,
    act: {
      account: 'spamtoken',
      name: 'transfer',
      authorization: [{ actor: 'spammer', permission: 'active' }],
      data: { from: 'spammer', to: 'alice', quantity: '0.0001 SPAM', memo: 'claim now' },
    },
  },
  {
    timestamp: '2026-09-01T00:00:02.000',
    block_num: 12,
    trx_id: 'cc',
    global_sequence: 3,
    act: {
      account: 'eosio',
      name: 'voteproducer',
      authorization: [{ actor: 'alice', permission: 'active' }],
      data: { voter: 'alice', proxy: '', producers: ['bp1'] },
    },
  },
];

let requested = '';

function handle(url: string): Response {
  requested = url;
  return new Response(JSON.stringify({ total: { value: 3 }, actions }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('history service', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    requested = '';
    vi.stubGlobal('fetch', (input: RequestInfo | URL) => Promise.resolve(handle(String(input))));
    await ensureSeededChains();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads hyperion actions and summarizes transfers', async () => {
    const page = await historyService.getActions(jungle4, 'alice', { limit: 10 });
    expect(requested).toContain('/v2/history/get_actions?account=alice&limit=10');
    expect(page.endpoint).toBe('https://jungle4.cryptolions.io');
    expect(page.actions).toHaveLength(3);
    expect(page.actions[0]!.summary).toBe('sender → alice 5.0000 EOS');
    expect(page.actions[0]!.transfer?.memo).toBe('hi');
    expect(page.actions[2]!.summary).toBe('eosio::voteproducer');
    expect(page.actions[2]!.transfer).toBeNull();
  });

  it('drops incoming transfers below the spam threshold', async () => {
    const settings = await settingsItem.getValue();
    await settingsItem.setValue({ ...settings, filterSpamTransfersUnder: 0.001 });
    const page = await historyService.getActions(jungle4, 'alice');
    expect(page.actions.map((entry) => entry.transactionId)).toEqual(['aa', 'cc']);
  });

  it('refuses chains without a history endpoint', async () => {
    await expect(historyService.getActions(waxTestnet, 'alice')).rejects.toThrow(
      'history_unavailable',
    );
  });
});
