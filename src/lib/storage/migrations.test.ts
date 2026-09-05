import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { settingsItem } from './items';
import { settingsService } from '@/services/settings.service';

describe('storage migrations', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('fills fields added after an install was created', async () => {
    await fakeBrowser.storage.local.set({
      settings: {
        lang: 'en-US',
        walletInitialized: true,
        chainId: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
        account: 'teamgreymass',
        authorization: 'active',
        enabledChains: ['aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'],
        idleTimeoutMinutes: 30,
      },
    });

    const settings = await settingsService.get();
    expect(settings.account).toBe('teamgreymass');
    expect(settings.idleTimeoutMinutes).toBe(30);
    expect(settings.recentBids).toEqual({});
    expect(settings.recentContracts).toEqual({});
    expect(settings.historyEndpoints).toEqual({});
    expect(settings.langChosen).toBe(false);
    expect(settings.blockExplorers).toEqual({});
  });

  it('keeps an update from dropping unknown-to-old fields', async () => {
    await fakeBrowser.storage.local.set({ settings: { lang: 'en-US' } });
    const updated = await settingsService.update({ transactionFees: true });
    expect(updated.transactionFees).toBe(true);
    expect(updated.recentBids).toEqual({});
    expect((await settingsItem.getValue()).transactionFees).toBe(true);
  });
});
