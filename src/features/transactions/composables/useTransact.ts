import { computed, ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useTransactionService } from '@/composables/useServices';
import type { ActionInput } from '@/lib/antelope/transaction';
import type { TransactResult } from '@/services/transaction.service';
import { useAppStore } from '@/stores/app.store';

export function useTransact() {
  const app = useAppStore();
  const service = useTransactionService();
  const queryClient = useQueryClient();

  const open = ref(false);
  const busy = ref(false);
  const result = ref<TransactResult | null>(null);
  let last: ActionInput[] = [];

  const signer = computed(() => {
    const wallet = app.currentWallet;
    return wallet ? { actor: wallet.account, permission: wallet.authorization } : undefined;
  });
  const needsUnlock = computed(() => {
    const wallet = app.currentWallet;
    return Boolean(wallet && wallet.mode !== 'watch' && !app.status.unlocked);
  });
  const canSign = computed(() => Boolean(app.currentWallet) && !needsUnlock.value);

  async function run(actions: ActionInput[], options: { acceptFee?: boolean } = {}): Promise<void> {
    const wallet = app.currentWallet;
    const chainId = app.settings.chainId;
    if (!wallet || !chainId) return;
    last = actions;
    open.value = true;
    busy.value = true;
    result.value = null;
    result.value = await service.transact({
      chainId,
      wallet: { chainId, account: wallet.account, authorization: wallet.authorization },
      actions,
      acceptFee: options.acceptFee ?? app.settings.transactionFees,
    });
    busy.value = false;
    if (result.value.status === 'success') {
      void queryClient.invalidateQueries({ queryKey: ['account', chainId] });
      void queryClient.invalidateQueries({ queryKey: ['balances', chainId] });
    }
  }

  function proceedWithFee(): Promise<void> {
    return run(last, { acceptFee: true });
  }

  function close(): void {
    open.value = false;
    result.value = null;
  }

  return { open, busy, result, signer, needsUnlock, canSign, run, proceedWithFee, close };
}
