import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useChainService, useSettingsService, useWalletService } from '@/composables/useServices';
import { setLanguage } from '@/lib/i18n';
import { blockchainsItem, settingsItem, unlockedItem, walletsItem } from '@/lib/storage/items';
import { settingsSchema, type Blockchain, type Settings, type Wallet } from '@/lib/storage/schemas';
import type { WalletRef, WalletStatus } from '@/services/wallet.service';

export const useAppStore = defineStore('app', () => {
  const walletService = useWalletService();
  const chainService = useChainService();
  const settingsService = useSettingsService();

  const status = ref<WalletStatus>({ initialized: false, unlocked: false });
  const settings = ref<Settings>(settingsSchema.parse({}));
  const chains = ref<Blockchain[]>([]);
  const wallets = ref<Wallet[]>([]);
  const loaded = ref(false);
  let loading: Promise<void> | undefined;
  let watching = false;

  const enabledChains = computed(() =>
    chains.value.filter((chain) => settings.value.enabledChains.includes(chain.chainId)),
  );
  const visibleChains = computed(() =>
    chains.value.filter((chain) => settings.value.displayTestNetworks || !chain.testnet),
  );
  const currentChain = computed(() =>
    chains.value.find((chain) => chain.chainId === settings.value.chainId),
  );
  const walletsForChain = computed(() =>
    wallets.value.filter((wallet) => wallet.chainId === settings.value.chainId),
  );
  const currentWallet = computed(() =>
    walletsForChain.value.find(
      (wallet) =>
        wallet.account === settings.value.account &&
        wallet.authorization === settings.value.authorization,
    ),
  );
  const setupRoute = computed<string | null>(() => {
    if (!status.value.initialized) return '/setup';
    if (enabledChains.value.length === 0) return '/setup/chains';
    if (walletsForChain.value.length === 0) return '/setup/import';
    return null;
  });

  async function refreshStatus(): Promise<void> {
    status.value = await walletService.status();
  }

  async function load(): Promise<void> {
    const [nextStatus, nextSettings, nextChains, nextWallets] = await Promise.all([
      walletService.status(),
      settingsService.get(),
      chainService.ensureSeeded(),
      walletService.listWallets(),
    ]);
    status.value = nextStatus;
    settings.value = nextSettings;
    chains.value = nextChains;
    wallets.value = nextWallets;
    loaded.value = true;
    if (!watching) {
      watching = true;
      settingsItem.watch((value) => {
        settings.value = value;
        void setLanguage(value.lang);
      });
      blockchainsItem.watch((value) => {
        chains.value = value;
      });
      walletsItem.watch((value) => {
        wallets.value = value;
      });
      unlockedItem.watch(() => {
        void refreshStatus();
      });
    }
  }

  function ready(): Promise<void> {
    if (loaded.value) return Promise.resolve();
    loading ??= load();
    return loading;
  }

  async function lock(): Promise<void> {
    await walletService.lock();
    await refreshStatus();
  }

  async function unlock(password: string): Promise<boolean> {
    try {
      await walletService.unlock(password);
      await refreshStatus();
      return true;
    } catch {
      return false;
    }
  }

  async function selectWallet(ref: WalletRef): Promise<void> {
    await walletService.selectWallet(ref);
    settings.value = await settingsService.get();
  }

  async function selectChain(chainId: string): Promise<void> {
    const recent = settings.value.recentWallets[chainId];
    const fallback = wallets.value.find((wallet) => wallet.chainId === chainId);
    const target = recent ?? fallback;
    settings.value = await settingsService.update({
      chainId,
      account: target?.account ?? null,
      authorization: target?.authorization ?? null,
    });
  }

  async function updateSettings(patch: Partial<Settings>): Promise<void> {
    settings.value = await settingsService.update(patch);
    if (patch.lang) await setLanguage(settings.value.lang);
  }

  return {
    status,
    settings,
    chains,
    wallets,
    loaded,
    enabledChains,
    visibleChains,
    currentChain,
    walletsForChain,
    currentWallet,
    setupRoute,
    ready,
    load,
    refreshStatus,
    lock,
    unlock,
    selectWallet,
    selectChain,
    updateSettings,
  };
});
