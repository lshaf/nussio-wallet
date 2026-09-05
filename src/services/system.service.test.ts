import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ensureSeededChains } from './chain.service';
import { systemService } from './system.service';

const wax = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';

const rows = [
  {
    newname: 'winner',
    high_bidder: 'bidderone',
    high_bid: '250000000',
    last_bid_time: '2026-09-01T00:00:00.000',
  },
  {
    newname: 'second',
    high_bidder: 'biddertwo',
    high_bid: '1',
    last_bid_time: '2026-09-02T00:00:00.000',
  },
  {
    newname: 'settled',
    high_bidder: 'oldbidder',
    high_bid: '-500000000',
    last_bid_time: '2024-01-01T00:00:00.000',
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

let lastQuery: Record<string, unknown> = {};

function handle(url: string, init?: RequestInit): Response {
  const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
  if (url.endsWith('/v1/chain/get_account')) {
    if (body.account_name === 'takenname')
      return jsonResponse({
        account_name: 'takenname',
        head_block_num: 1,
        head_block_time: '2026-01-01T00:00:00.000',
        privileged: false,
        last_code_update: '2026-01-01T00:00:00.000',
        created: '2026-01-01T00:00:00.000',
        ram_quota: 1,
        net_weight: 1,
        cpu_weight: 1,
        net_limit: { used: 0, available: 1, max: 1 },
        cpu_limit: { used: 0, available: 1, max: 1 },
        ram_usage: 1,
        permissions: [],
      });
    return jsonResponse({ code: 500, message: 'unknown key' }, 500);
  }
  if (url.endsWith('/v1/chain/get_table_rows')) {
    lastQuery = body;
    if (body.lower_bound !== undefined) {
      const wanted = String(body.lower_bound);
      return jsonResponse({ rows: rows.filter((row) => row.newname === wanted), more: false });
    }
    return jsonResponse({ rows, more: false });
  }
  throw new Error(`unexpected request ${url}`);
}

describe('system service', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    lastQuery = {};
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(handle(String(input), init)),
    );
    await ensureSeededChains();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists only open auctions, highest first', async () => {
    const auctions = await systemService.listOpenNameBids(wax);
    expect(lastQuery).toMatchObject({
      table: 'namebids',
      index_position: 'secondary',
      key_type: 'i64',
      reverse: true,
    });
    expect(auctions.map((bid) => bid.name)).toEqual(['winner', 'second']);
    expect(auctions[0]!.highBid).toBe('2.50000000 WAX');
    expect(auctions.every((bid) => !bid.settled)).toBe(true);
  });

  it('reports a name that is up for auction', async () => {
    const status = await systemService.getNameStatus(wax, 'winner');
    expect(status.state).toBe('bidding');
    expect(status.bid?.highBidder).toBe('bidderone');
  });

  it('reports a settled bid as available and an existing account as taken', async () => {
    expect((await systemService.getNameStatus(wax, 'settled')).state).toBe('available');
    expect((await systemService.getNameStatus(wax, 'takenname')).state).toBe('taken');
  });
});
