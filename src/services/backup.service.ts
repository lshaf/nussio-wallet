import { createProxyService, registerService } from '@webext-core/proxy-service';
import { samePublicKey } from '@/lib/antelope/keys';
import {
  backupFileSchema,
  chainToNetwork,
  entryToWallet,
  envelopeFromStorage,
  customTokenToString,
  NUSSIO_STORAGE_SCHEMA,
  PENDING_SCHEMA,
  SETTINGS_SCHEMA,
  STORAGE_SCHEMA,
  networkAliases,
  networkToChain,
  settingsFromBackup,
  settingsToBackup,
  walletToEntry,
} from '@/lib/backup/format';
import { decryptKeyring, encryptKeyring, type KeyEntry } from '@/lib/crypto/keyring';
import { decryptLegacyKeyring, encryptLegacyKeyring } from '@/lib/crypto/legacy';
import {
  blockchainsItem,
  contactsItem,
  customTokensItem,
  keyringItem,
  pendingItem,
  publicKeysItem,
  settingsItem,
  unlockedItem,
  unlockedKeysItem,
  walletsItem,
} from '@/lib/storage/items';
import { contactSchema, pendingStateSchema, type Wallet } from '@/lib/storage/schemas';

export type BackupFormat = 'nussio' | 'desktop';

export interface BackupExport {
  filename: string;
  content: string;
  keyCount: number;
}

export interface BackupPreview {
  chains: number;
  wallets: number;
  keys: number;
  contacts: number;
  customTokens: number;
  hasSettings: boolean;
  encrypted: boolean;
}

export interface BackupImportResult {
  chains: number;
  wallets: number;
  keys: number;
  contacts: number;
  customTokens: number;
}

export interface BackupService {
  createExport(password: string, format: BackupFormat): Promise<BackupExport>;
  inspect(content: string): Promise<BackupPreview>;
  restore(
    content: string,
    backupPassword: string,
    walletPassword?: string,
  ): Promise<BackupImportResult>;
}

const SERVICE_KEY = 'BackupService';

function mergeEntries(current: KeyEntry[], incoming: KeyEntry[]): KeyEntry[] {
  const merged = [...current];
  for (const entry of incoming) {
    if (merged.some((known) => samePublicKey(known.pubkey, entry.pubkey))) continue;
    merged.push(entry);
  }
  return merged;
}

function sameWallet(a: Wallet, b: Wallet): boolean {
  return a.chainId === b.chainId && a.account === b.account && a.authorization === b.authorization;
}

async function readBackupKeys(blob: string, password: string): Promise<KeyEntry[]> {
  const envelope = envelopeFromStorage(blob);
  if (envelope) return decryptKeyring(envelope, password);
  return decryptLegacyKeyring(blob, password);
}

export const backupService: BackupService = {
  async createExport(password, format) {
    const envelope = await keyringItem.getValue();
    if (envelope === null) throw new Error('not_initialized');
    const entries = await decryptKeyring(envelope, password);
    const [chains, wallets, settings, pending, contacts, tokens] = await Promise.all([
      blockchainsItem.getValue(),
      walletsItem.getValue(),
      settingsItem.getValue(),
      pendingItem.getValue(),
      contactsItem.getValue(),
      customTokensItem.getValue(),
    ]);
    const data =
      format === 'desktop'
        ? await encryptLegacyKeyring(entries, password)
        : JSON.stringify(await encryptKeyring(entries, password));
    const backupSettings = settingsToBackup(settings) as Record<string, unknown>;
    backupSettings.contacts = contacts;
    backupSettings.customTokens = tokens.map((token) => customTokenToString(token, chains));
    const file = {
      networks: chains.map(chainToNetwork),
      pending: { schema: PENDING_SCHEMA, data: pending },
      settings: { schema: SETTINGS_SCHEMA, data: backupSettings },
      storage: {
        schema: format === 'desktop' ? STORAGE_SCHEMA : NUSSIO_STORAGE_SCHEMA,
        data: { data, keys: entries.map((entry) => entry.pubkey), paths: {} },
      },
      wallets: wallets.map(walletToEntry),
    };
    const stamp = new Date().toISOString().slice(0, 10);
    await settingsItem.setValue({ ...settings, lastBackupAt: Date.now() });
    return {
      filename: `nussio-wallet-backup-${stamp}.json`,
      content: JSON.stringify(file, null, 2),
      keyCount: entries.length,
    };
  },

  async inspect(content) {
    const file = backupFileSchema.parse(JSON.parse(content));
    const chains = await blockchainsItem.getValue();
    const imported = settingsFromBackup(file.settings?.data, chains, networkAliases(file.networks));
    const walletEntries = file.wallets.flatMap((entry) => {
      const wallet = entryToWallet(entry.data);
      return wallet ? [wallet] : [];
    });
    return {
      chains: file.networks.length,
      wallets: walletEntries.length,
      keys:
        file.storage?.data.keys.length ??
        walletEntries.filter((entry) => entry.legacyData !== undefined).length,
      contacts: imported.contacts.length,
      customTokens: imported.customTokens.length,
      hasSettings: file.settings !== undefined,
      encrypted: Boolean(file.storage?.data.data) || walletEntries.some((e) => e.legacyData),
    };
  },

  async restore(content, backupPassword, walletPassword) {
    const file = backupFileSchema.parse(JSON.parse(content));
    const existingEnvelope = await keyringItem.getValue();
    const password = existingEnvelope === null ? backupPassword : (walletPassword ?? '');
    const current =
      existingEnvelope === null ? [] : await decryptKeyring(existingEnvelope, password);

    let incoming: KeyEntry[] = [];
    if (file.storage?.data.data) {
      incoming = await readBackupKeys(file.storage.data.data, backupPassword);
    }

    const knownChains = await blockchainsItem.getValue();
    const restoredChains = file.networks.flatMap((entry) => {
      const chain = networkToChain(entry.data, knownChains);
      return chain ? [chain] : [];
    });
    const chains = [...knownChains];
    for (const chain of restoredChains) {
      const index = chains.findIndex((entry) => entry.chainId === chain.chainId);
      if (index === -1) chains.push(chain);
      else chains[index] = chain;
    }

    const wallets = [...(await walletsItem.getValue())];
    let restoredWallets = 0;
    for (const entry of file.wallets) {
      const parsed = entryToWallet(entry.data);
      if (!parsed) continue;
      if (parsed.legacyData) {
        try {
          incoming = mergeEntries(
            incoming,
            await decryptLegacyKeyring(parsed.legacyData, backupPassword),
          );
        } catch {
          continue;
        }
      }
      const index = wallets.findIndex((known) => sameWallet(known, parsed.wallet));
      if (index === -1) wallets.push(parsed.wallet);
      else wallets[index] = parsed.wallet;
      restoredWallets += 1;
    }

    const entries = mergeEntries(current, incoming);
    const imported = settingsFromBackup(file.settings?.data, chains, networkAliases(file.networks));

    const contacts = [...(await contactsItem.getValue())];
    for (const contact of imported.contacts) {
      const parsed = contactSchema.safeParse(contact);
      if (!parsed.success) continue;
      const index = contacts.findIndex((known) => known.accountName === parsed.data.accountName);
      if (index === -1) contacts.push(parsed.data);
      else contacts[index] = parsed.data;
    }

    const tokens = [...(await customTokensItem.getValue())];
    for (const token of imported.customTokens) {
      const known = tokens.some(
        (entry) =>
          entry.chainId === token.chainId &&
          entry.contract === token.contract &&
          entry.symbol === token.symbol,
      );
      if (!known) tokens.push(token);
    }

    const settings = await settingsItem.getValue();
    const enabledChains = new Set([
      ...settings.enabledChains,
      ...(imported.patch.enabledChains ?? []),
      ...wallets.map((wallet) => wallet.chainId),
    ]);

    await keyringItem.setValue(await encryptKeyring(entries, password));
    await publicKeysItem.setValue(entries.map((entry) => entry.pubkey));
    if (await unlockedItem.getValue()) await unlockedKeysItem.setValue(entries);
    await blockchainsItem.setValue(chains);
    await walletsItem.setValue(wallets);
    await contactsItem.setValue(contacts);
    await customTokensItem.setValue(tokens);
    if (file.pending?.data) {
      const pending = pendingStateSchema.safeParse(file.pending.data);
      if (pending.success) await pendingItem.setValue(pending.data);
    }
    await settingsItem.setValue({
      ...settings,
      ...imported.patch,
      enabledChains: [...enabledChains].filter((chainId) =>
        chains.some((chain) => chain.chainId === chainId),
      ),
      walletInitialized: true,
    });

    return {
      chains: restoredChains.length,
      wallets: restoredWallets,
      keys: entries.length - current.length,
      contacts: imported.contacts.length,
      customTokens: imported.customTokens.length,
    };
  },
};

export function registerBackupService(): void {
  registerService(SERVICE_KEY, backupService);
}

export function useBackupService(): BackupService {
  return createProxyService<BackupService>(SERVICE_KEY);
}
