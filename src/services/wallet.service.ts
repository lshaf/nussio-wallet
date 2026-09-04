import { createProxyService, registerService } from '@webext-core/proxy-service';
import { decryptKeyring, encryptKeyring } from '@/lib/crypto/keyring';
import { keyringItem, unlockedItem, unlockedKeysItem } from '@/lib/storage/items';

export interface WalletStatus {
  initialized: boolean;
  unlocked: boolean;
}

export interface WalletService {
  status(): Promise<WalletStatus>;
  initialize(password: string): Promise<void>;
  unlock(password: string): Promise<void>;
  lock(): Promise<void>;
}

const SERVICE_KEY = 'WalletService';

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
    await unlockedKeysItem.setValue([]);
    await unlockedItem.setValue(true);
  },

  async unlock(password) {
    const envelope = await keyringItem.getValue();
    if (envelope === null) throw new Error('not_initialized');
    const entries = await decryptKeyring(envelope, password);
    await unlockedKeysItem.setValue(entries);
    await unlockedItem.setValue(true);
  },

  async lock() {
    await unlockedKeysItem.removeValue();
    await unlockedItem.setValue(false);
  },
};

export function registerWalletService(): void {
  registerService(SERVICE_KEY, walletService);
}

export function useWalletService(): WalletService {
  return createProxyService<WalletService>(SERVICE_KEY);
}
