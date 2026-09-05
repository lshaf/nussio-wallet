import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { encryptLegacyKeyring } from '@/lib/crypto/legacy';
import { parsePrivateKey } from '@/lib/antelope/keys';
import {
  blockchainsItem,
  contactsItem,
  customTokensItem,
  settingsItem,
  walletsItem,
} from '@/lib/storage/items';
import { ensureSeededChains } from './chain.service';
import { backupService } from './backup.service';
import { walletService } from './wallet.service';

const wif = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';
const otherWif = '5KAjAp4xtdtvvg36hknJzvqX1XP6UrzQnUR1yTsuQT6mCphMXFt';
const eos = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';

async function desktopBackup(password: string): Promise<string> {
  const parsed = parsePrivateKey(wif);
  const blob = await encryptLegacyKeyring(
    [{ pubkey: parsed.publicKey, key: parsed.wif }],
    password,
  );
  return JSON.stringify({
    networks: [
      {
        schema: 'anchor.v2.network',
        data: {
          _id: 'eos-mainnet',
          chainId: eos,
          name: 'EOS',
          node: 'https://eos.greymass.com',
          symbol: 'EOS',
          keyPrefix: 'EOS',
          supportedContracts: ['bidname', 'greymassfuel', 'rex', 'unknowncontract'],
        },
      },
    ],
    pending: { schema: 'anchor.v1.pending', data: { accounts: [] } },
    settings: {
      schema: 'anchor.v2.settings',
      data: {
        account: 'teamgreymass',
        authorization: 'active',
        chainId: eos,
        blockchains: [eos],
        contacts: [{ accountName: 'greymassfuel', label: 'Fuel', defaultMemo: '' }],
        customTokens: ['eos-mainnet:tethertether:USDT'],
        refreshRate: 60,
        skipLinkModal: true,
        lastBackupDate: 1700000000000,
      },
    },
    storage: {
      schema: 'anchor.v2.storage',
      data: { data: blob, keys: [parsed.publicKey], paths: {} },
    },
    wallets: [
      {
        schema: 'anchor.v2.wallet',
        data: {
          account: 'teamgreymass',
          authority: 'active',
          chainId: eos,
          mode: 'hot',
          pubkey: parsed.publicKey,
          type: 'key',
        },
      },
    ],
  });
}

describe('backup service', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await ensureSeededChains();
  });

  it('exports a backup that restores into a fresh wallet', async () => {
    await walletService.initialize('pw');
    const { publicKey } = await walletService.importKey(wif, 'pw');
    await walletService.addWallets([
      {
        account: 'teamgreymass',
        authorization: 'active',
        chainId: eos,
        pubkey: publicKey,
        mode: 'hot',
      },
    ]);
    await contactsItem.setValue([
      { accountName: 'greymassfuel', label: 'Fuel', defaultMemo: 'hello' },
    ]);
    await customTokensItem.setValue([{ chainId: eos, contract: 'tethertether', symbol: 'USDT' }]);

    const exported = await backupService.createExport('pw', 'nussio');
    expect(exported.keyCount).toBe(1);
    expect(exported.filename).toMatch(/^nussio-wallet-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect((await settingsItem.getValue()).lastBackupAt).toBeGreaterThan(0);
    expect(exported.content).not.toContain(wif);

    fakeBrowser.reset();
    await ensureSeededChains();
    const preview = await backupService.inspect(exported.content);
    expect(preview).toMatchObject({
      wallets: 1,
      keys: 1,
      contacts: 1,
      customTokens: 1,
      encrypted: true,
    });

    const result = await backupService.restore(exported.content, 'pw');
    expect(result.wallets).toBe(1);
    expect(result.keys).toBe(1);
    expect(await walletService.listPublicKeys()).toEqual([publicKey]);
    expect(await contactsItem.getValue()).toHaveLength(1);
    expect(await customTokensItem.getValue()).toHaveLength(1);
    await walletService.unlock('pw');
    expect(await walletService.unlockedPublicKeys()).toEqual([publicKey]);
  });

  it('imports a desktop backup and migrates the legacy keyring', async () => {
    const content = await desktopBackup('desktop pw');
    const result = await backupService.restore(content, 'desktop pw');
    expect(result.wallets).toBe(1);
    expect(result.keys).toBe(1);

    const settings = await settingsItem.getValue();
    expect(settings.walletInitialized).toBe(true);
    expect(settings.chainId).toBe(eos);
    expect(settings.account).toBe('teamgreymass');
    expect(settings.refreshRateSeconds).toBe(60);
    expect(settings.skipLinkModal).toBe(true);
    expect(settings.enabledChains).toContain(eos);

    const chain = (await blockchainsItem.getValue()).find((entry) => entry.chainId === eos);
    expect(chain?.features).toEqual(['bidname', 'greymassfuel', 'rex']);

    expect(await walletsItem.getValue()).toEqual([
      expect.objectContaining({ account: 'teamgreymass', authorization: 'active', mode: 'hot' }),
    ]);
    expect(await contactsItem.getValue()).toEqual([
      { accountName: 'greymassfuel', label: 'Fuel', defaultMemo: '' },
    ]);
    expect(await customTokensItem.getValue()).toEqual([
      { chainId: eos, contract: 'tethertether', symbol: 'USDT' },
    ]);

    await walletService.unlock('desktop pw');
    expect(await walletService.unlockedPublicKeys()).toHaveLength(1);
  });

  it('merges into an existing wallet and rejects a wrong password', async () => {
    await walletService.initialize('local pw');
    await walletService.importKey(otherWif, 'local pw');
    const content = await desktopBackup('desktop pw');

    await expect(backupService.restore(content, 'wrong', 'local pw')).rejects.toThrow();
    await expect(backupService.restore(content, 'desktop pw', 'wrong')).rejects.toThrow();

    const result = await backupService.restore(content, 'desktop pw', 'local pw');
    expect(result.keys).toBe(1);
    expect(await walletService.listPublicKeys()).toHaveLength(2);
    await walletService.unlock('local pw');
    expect(await walletService.unlockedPublicKeys()).toHaveLength(2);
  });

  it('writes a desktop compatible keyring blob', async () => {
    await walletService.initialize('pw');
    await walletService.importKey(wif, 'pw');
    const exported = await backupService.createExport('pw', 'desktop');
    const file = JSON.parse(exported.content);
    expect(file.storage.schema).toBe('anchor.v2.storage');
    expect(file.storage.data.data).toMatch(/^[0-9a-f]{64}/);
    expect(file.networks[0].schema).toBe('anchor.v2.network');
    expect(file.networks[0].data._id).toBe('eos');
    expect(file.wallets).toEqual([]);
  });
});
