import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useWalletService } from '@/composables/useServices';
import type { WalletStatus } from '@/services/wallet.service';

export const useAppStore = defineStore('app', () => {
  const walletService = useWalletService();
  const status = ref<WalletStatus>({ initialized: false, unlocked: false });
  const loading = ref(false);

  async function refresh(): Promise<void> {
    loading.value = true;
    try {
      status.value = await walletService.status();
    } finally {
      loading.value = false;
    }
  }

  async function lock(): Promise<void> {
    await walletService.lock();
    await refresh();
  }

  return { status, loading, refresh, lock };
});
