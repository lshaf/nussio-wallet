import { createProxyService, registerService } from '@webext-core/proxy-service';
import { parsePrivateKey, samePublicKey } from '@/lib/antelope/keys';
import { decryptKeyring, encryptKeyring, type KeyEntry } from '@/lib/crypto/keyring';
import {
  keyringItem,
  publicKeysItem,
  settingsItem,
  unlockedItem,
  unlockedKeysItem,
  walletsItem,
} from '@/lib/storage/items';
import { walletSchema, type Wallet } from '@/lib/storage/schemas';

export interface WalletStatus {
  initialized: boolean;
  unlocked: boolean;
}

export interface WalletRef {
  chainId: string;
  account: string;
  authorization: string;
}

export interface WalletService {
  status(): Promise<WalletStatus>;
  initialize(password: string): Promise<void>;
  unlock(password: string): Promise<void>;
  lock(): Promise<void>;
  confirmPassword(password: string): Promise<boolean>;
  listPublicKeys(): Promise<string[]>;
  unlockedPublicKeys(): Promise<string[]>;
  importKey(wif: string, password: string): Promise<{ publicKey: string }>;
  removeKey(publicKey: string, password: string): Promise<void>;
  listWallets(): Promise<Wallet[]>;
  addWallets(wallets: Wallet[]): Promise<Wallet[]>;
  removeWallet(ref: WalletRef): Promise<Wallet[]>;
  selectWallet(ref: WalletRef | null): Promise<void>;
}

const SERVICE_KEY = 'WalletService';

function sameWallet(a: WalletRef, b: WalletRef): boolean {
  return a.chainId === b.chainId && a.account === b.account && a.authorization === b.authorization;
}

async function readEntries(password: string): Promise<KeyEntry[]> {
  const envelope = await keyringItem.getValue();
  if (envelope === null) throw new Error('not_initialized');
  return decryptKeyring(envelope, password);
}

async function writeEntries(entries: KeyEntry[], password: string): Promise<void> {
  await keyringItem.setValue(await encryptKeyring(entries, password));
  await publicKeysItem.setValue(entries.map((entry) => entry.pubkey));
  if (await unlockedItem.getValue()) await unlockedKeysItem.setValue(entries);
}

export async function signingKeyFor(publicKey: string): Promise<string | undefined> {
  const entries = await unlockedKeysItem.getValue();
  return entries.find((entry) => samePublicKey(entry.pubkey, publicKey))?.key;
}

export const walletService: WalletService = {
  async status() {
    const [envelope, unlocked] = await Promise.all([
      keyringItem.getValue(),
      unlockedItem.getValue(),
    ]);
    return { initialized: envelope !== null, unlocked };
  },

  async initialize(password) {
    if ((await keyringItem.getValue()) !== null) throw new Error('already_initialized');
    await keyringItem.setValue(await encryptKeyring([], password));
    await publicKeysItem.setValue([]);
    await unlockedKeysItem.setValue([]);
    await unlockedItem.setValue(true);
    const settings = await settingsItem.getValue();
    await settingsItem.setValue({ ...settings, walletInitialized: true });
  },

  async unlock(password) {
    const entries = await readEntries(password);
    await unlockedKeysItem.setValue(entries);
    await unlockedItem.setValue(true);
  },

  async lock() {
    await unlockedKeysItem.removeValue();
    await unlockedItem.setValue(false);
  },

  async confirmPassword(password) {
    try {
      await readEntries(password);
      return true;
    } catch {
      return false;
    }
  },

  listPublicKeys: () => publicKeysItem.getValue(),

  async unlockedPublicKeys() {
    return (await unlockedKeysItem.getValue()).map((entry) => entry.pubkey);
  },

  async importKey(wif, password) {
    const parsed = parsePrivateKey(wif);
    const entries = await readEntries(password);
    if (!entries.some((entry) => samePublicKey(entry.pubkey, parsed.publicKey))) {
      entries.push({ pubkey: parsed.publicKey, key: parsed.wif });
      await writeEntries(entries, password);
    }
    return { publicKey: parsed.publicKey };
  },

  async removeKey(publicKey, password) {
    const entries = await readEntries(password);
    await writeEntries(
      entries.filter((entry) => !samePublicKey(entry.pubkey, publicKey)),
      password,
    );
  },

  listWallets: () => walletsItem.getValue(),

  async addWallets(input) {
    const wallets = await walletsItem.getValue();
    for (const candidate of input) {
      const wallet = walletSchema.parse(candidate);
      const index = wallets.findIndex((entry) => sameWallet(entry, wallet));
      if (index === -1) wallets.push(wallet);
      else wallets[index] = wallet;
    }
    await walletsItem.setValue(wallets);
    return wallets;
  },

  async removeWallet(ref) {
    const wallets = (await walletsItem.getValue()).filter((entry) => !sameWallet(entry, ref));
    await walletsItem.setValue(wallets);
    const settings = await settingsItem.getValue();
    if (
      settings.chainId === ref.chainId &&
      settings.account === ref.account &&
      settings.authorization === ref.authorization
    ) {
      const next = wallets.find((entry) => entry.chainId === ref.chainId) ?? null;
      await walletService.selectWallet(next);
    }
    return wallets;
  },

  async selectWallet(ref) {
    const settings = await settingsItem.getValue();
    if (ref === null) {
      await settingsItem.setValue({ ...settings, account: null, authorization: null });
      return;
    }
    await settingsItem.setValue({
      ...settings,
      chainId: ref.chainId,
      account: ref.account,
      authorization: ref.authorization,
      recentWallets: {
        ...settings.recentWallets,
        [ref.chainId]: { account: ref.account, authorization: ref.authorization },
      },
    });
  },
};

export function registerWalletService(): void {
  registerService(SERVICE_KEY, walletService);
}

export function useWalletService(): WalletService {
  return createProxyService<WalletService>(SERVICE_KEY);
}
