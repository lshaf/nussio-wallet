import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { parseSigningRequest } from '@/lib/antelope/esr';
import { pendingItem } from '@/lib/storage/items';
import { ensureSeededChains } from './chain.service';
import { pendingService } from './pending.service';
import { walletService } from './wallet.service';

const eos = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';

const systemAbi = {
  version: 'eosio::abi/1.1',
  types: [],
  structs: [
    {
      name: 'permission_level',
      base: '',
      fields: [
        { name: 'actor', type: 'name' },
        { name: 'permission', type: 'name' },
      ],
    },
    {
      name: 'key_weight',
      base: '',
      fields: [
        { name: 'key', type: 'public_key' },
        { name: 'weight', type: 'uint16' },
      ],
    },
    {
      name: 'permission_level_weight',
      base: '',
      fields: [
        { name: 'permission', type: 'permission_level' },
        { name: 'weight', type: 'uint16' },
      ],
    },
    {
      name: 'wait_weight',
      base: '',
      fields: [
        { name: 'wait_sec', type: 'uint32' },
        { name: 'weight', type: 'uint16' },
      ],
    },
    {
      name: 'authority',
      base: '',
      fields: [
        { name: 'threshold', type: 'uint32' },
        { name: 'keys', type: 'key_weight[]' },
        { name: 'accounts', type: 'permission_level_weight[]' },
        { name: 'waits', type: 'wait_weight[]' },
      ],
    },
    {
      name: 'newaccount',
      base: '',
      fields: [
        { name: 'creator', type: 'name' },
        { name: 'name', type: 'name' },
        { name: 'owner', type: 'authority' },
        { name: 'active', type: 'authority' },
      ],
    },
    {
      name: 'buyrambytes',
      base: '',
      fields: [
        { name: 'payer', type: 'name' },
        { name: 'receiver', type: 'name' },
        { name: 'bytes', type: 'uint32' },
      ],
    },
  ],
  actions: [
    { name: 'newaccount', type: 'newaccount', ricardian_contract: '' },
    { name: 'buyrambytes', type: 'buyrambytes', ricardian_contract: '' },
  ],
  tables: [],
  ricardian_clauses: [],
  error_messages: [],
  abi_extensions: [],
  variants: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const existing = new Set<string>();

function handle(url: string, init?: RequestInit): Response {
  if (url.endsWith('/v1/chain/get_abi'))
    return jsonResponse({ account_name: 'eosio', abi: systemAbi });
  if (url.endsWith('/v1/chain/get_account')) {
    const body = JSON.parse(String(init?.body ?? '{}')) as { account_name?: string };
    if (body.account_name && existing.has(body.account_name)) {
      return jsonResponse({
        account_name: body.account_name,
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
    }
    return jsonResponse({ code: 500, message: 'unknown key' }, 500);
  }
  throw new Error(`unexpected request ${url}`);
}

describe('pending service', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    existing.clear();
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(handle(String(input), init)),
    );
    await ensureSeededChains();
    await walletService.initialize('pw');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports name availability', async () => {
    expect(await pendingService.checkName(eos, 'freename1234')).toBe('available');
    existing.add('teamgreymass');
    expect(await pendingService.checkName(eos, 'teamgreymass')).toBe('taken');
  });

  it('creates a request that keeps only the active key', async () => {
    const created = await pendingService.create(eos, 'nussiotest11', 'pw');
    expect(created.ownerKey).not.toBe(created.activeKey);

    const keys = await walletService.listPublicKeys();
    expect(keys).toEqual([created.account.active]);
    expect(keys).not.toContain(created.account.owner);

    const stored = (await pendingItem.getValue()).accounts;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ account: 'nussiotest11', chainId: eos });

    const request = parseSigningRequest(created.account.request);
    const actions = request.getRawActions();
    expect(actions.map((action) => String(action.name))).toEqual(['newaccount', 'buyrambytes']);
    expect(String(actions[0]!.authorization[0]!.actor)).toBe('............1');
  });

  it('claims a created account into a wallet', async () => {
    const created = await pendingService.create(eos, 'nussiotest11', 'pw');
    await pendingService.claim(eos, 'nussiotest11');
    expect(await walletService.listWallets()).toEqual([
      {
        account: 'nussiotest11',
        authorization: 'active',
        chainId: eos,
        pubkey: created.account.active,
        mode: 'hot',
      },
    ]);
    expect((await pendingItem.getValue()).accounts).toEqual([]);
  });

  it('refuses a name that already exists', async () => {
    existing.add('teamgreymass');
    await expect(pendingService.create(eos, 'teamgreymass', 'pw')).rejects.toThrow('name_taken');
  });
});
