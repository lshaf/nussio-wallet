import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { settingsItem } from '@/lib/storage/items';
import { signingKeyFor, walletService } from './wallet.service';

const wif = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';
const chainId = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';

describe('wallet service', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('initializes, imports a key, locks and unlocks', async () => {
    expect(await walletService.status()).toEqual({ initialized: false, unlocked: false });
    await walletService.initialize('pw');
    expect(await walletService.status()).toEqual({ initialized: true, unlocked: true });
    expect((await settingsItem.getValue()).walletInitialized).toBe(true);

    const { publicKey } = await walletService.importKey(wif, 'pw');
    expect(await walletService.listPublicKeys()).toEqual([publicKey]);
    expect(await signingKeyFor(publicKey)).toBe(wif);

    await walletService.lock();
    expect(await walletService.status()).toEqual({ initialized: true, unlocked: false });
    expect(await signingKeyFor(publicKey)).toBeUndefined();

    await expect(walletService.unlock('bad')).rejects.toThrow();
    await walletService.unlock('pw');
    expect(await walletService.unlockedPublicKeys()).toEqual([publicKey]);
    expect(await walletService.confirmPassword('pw')).toBe(true);
    expect(await walletService.confirmPassword('bad')).toBe(false);

    await walletService.removeKey(publicKey, 'pw');
    expect(await walletService.listPublicKeys()).toEqual([]);
  });

  it('changes the password and keeps keys usable', async () => {
    await walletService.initialize('old password');
    const { publicKey } = await walletService.importKey(wif, 'old password');

    await expect(walletService.changePassword('wrong', 'new password')).rejects.toThrow();
    await walletService.changePassword('old password', 'new password');

    expect(await walletService.confirmPassword('new password')).toBe(true);
    expect(await walletService.confirmPassword('old password')).toBe(false);
    expect(await walletService.listPublicKeys()).toEqual([publicKey]);
    expect(await signingKeyFor(publicKey)).toBe(wif);

    await walletService.lock();
    await expect(walletService.unlock('old password')).rejects.toThrow();
    await walletService.unlock('new password');
    expect(await walletService.unlockedPublicKeys()).toEqual([publicKey]);
  });

  it('manages wallets and the selected wallet', async () => {
    await walletService.initialize('pw');
    const wallet = {
      chainId,
      account: 'teamgreymass',
      authorization: 'active',
      pubkey: 'PUB_K1_x',
      mode: 'watch' as const,
    };
    await walletService.addWallets([wallet, wallet]);
    expect(await walletService.listWallets()).toHaveLength(1);

    await walletService.selectWallet(wallet);
    let settings = await settingsItem.getValue();
    expect(settings.account).toBe('teamgreymass');
    expect(settings.recentWallets[chainId]?.authorization).toBe('active');

    await walletService.removeWallet(wallet);
    expect(await walletService.listWallets()).toEqual([]);
    settings = await settingsItem.getValue();
    expect(settings.account).toBeNull();
  });
});
