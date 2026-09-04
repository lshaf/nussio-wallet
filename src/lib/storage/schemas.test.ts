import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { blockchainSchema, settingsSchema, walletSchema } from './schemas';
import { settingsItem, walletsItem } from './items';

describe('schemas', () => {
  it('fills settings defaults', () => {
    const settings = settingsSchema.parse({});
    expect(settings.lang).toBe('en-US');
    expect(settings.idleTimeoutMinutes).toBe(15);
    expect(settings.enabledChains).toEqual([]);
  });

  it('applies blockchain defaults and validates chain ids', () => {
    const chain = blockchainSchema.parse({
      id: 'eos',
      chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
      name: 'EOS',
      node: 'https://eos.greymass.com',
      symbol: 'EOS',
    });
    expect(chain.keyPrefix).toBe('EOS');
    expect(chain.tokenContract).toBe('eosio.token');
    expect(() => blockchainSchema.parse({ ...chain, chainId: 'nope' })).toThrow();
  });

  it('rejects invalid account names in wallets', () => {
    const wallet = {
      account: 'teamgreymass',
      authorization: 'active',
      chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
      pubkey: 'PUB_K1_x',
      mode: 'hot',
    };
    expect(walletSchema.safeParse(wallet).success).toBe(true);
    expect(walletSchema.safeParse({ ...wallet, account: 'UPPER' }).success).toBe(false);
    expect(walletSchema.safeParse({ ...wallet, pubkey: '' }).success).toBe(false);
    expect(walletSchema.safeParse({ ...wallet, pubkey: '', mode: 'watch' }).success).toBe(true);
  });
});

describe('storage items', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns fallbacks and round-trips values', async () => {
    expect(await settingsItem.getValue()).toEqual(settingsSchema.parse({}));
    expect(await walletsItem.getValue()).toEqual([]);
    const wallet = walletSchema.parse({
      account: 'teamgreymass',
      authorization: 'active',
      chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
      pubkey: 'PUB_K1_x',
      mode: 'watch',
    });
    await walletsItem.setValue([wallet]);
    expect(await walletsItem.getValue()).toEqual([wallet]);
  });
});
