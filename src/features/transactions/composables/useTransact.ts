import { computed, ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useLedger } from '@/composables/useLedger';
import { useTransactionService } from '@/composables/useServices';
import type { ActionInput } from '@/lib/antelope/transaction';
import type { TransactResult } from '@/services/transaction.service';
import { useAppStore } from '@/stores/app.store';

export function useTransact() {
  const app = useAppStore();
  const service = useTransactionService();
  const ledger = useLedger();
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
    return Boolean(
      wallet && wallet.mode !== 'watch' && wallet.mode !== 'ledger' && !app.status.unlocked,
    );
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
    if (result.value.status === 'ledger') result.value = await signOnDevice(result.value);
    busy.value = false;
    if (result.value.status === 'success') {
      void queryClient.invalidateQueries({ queryKey: ['account', chainId] });
      void queryClient.invalidateQueries({ queryKey: ['balances', chainId] });
    }
  }

  async function signOnDevice(
    pending: Extract<TransactResult, { status: 'ledger' }>,
  ): Promise<TransactResult> {
    const signature = await ledger.sign({
      path: pending.path,
      legacy: pending.legacy,
      chunks: pending.chunks,
    });
    if (!signature) {
      return {
        status: 'error',
        chainId: pending.chainId,
        error: {
          kind: 'ledger',
          name: ledger.error.value ?? 'ledger_failed',
          message: ledger.error.value ?? 'ledger_failed',
          details: [],
        },
        actions: pending.actions,
      };
    }
    const broadcast = await service.completeLedger({
      chainId: pending.chainId,
      transaction: pending.transaction,
      cosignatures: pending.cosignatures,
      signature,
    });
    return broadcast.status === 'success'
      ? { ...broadcast, fuel: pending.fuel, fee: pending.fee, actions: pending.actions }
      : broadcast;
  }

  function proceedWithFee(): Promise<void> {
    return run(last, { acceptFee: true });
  }

  function close(): void {
    open.value = false;
    result.value = null;
  }

  return {
    open,
    busy,
    result,
    signer,
    needsUnlock,
    canSign,
    ledgerWaiting: ledger.waiting,
    run,
    proceedWithFee,
    close,
  };
}
