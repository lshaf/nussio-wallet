import { computed, ref } from 'vue';
import { useLedger } from '@/composables/useLedger';
import { useRequestService } from '@/composables/useServices';
import type { RequestSigner } from '@/lib/storage/schemas';
import type { RequestOutcome, RequestView } from '@/services/request.service';
import { useAppStore } from '@/stores/app.store';

export type PromptStage =
  | 'loading'
  | 'error'
  | 'unknown_chain'
  | 'no_wallets'
  | 'forbidden'
  | 'identity'
  | 'review'
  | 'fee'
  | 'unsigned'
  | 'success'
  | 'cancelled';

export function usePromptRequest(id: string) {
  const service = useRequestService();
  const app = useAppStore();
  const ledger = useLedger();

  const view = ref<RequestView | null>(null);
  const outcome = ref<RequestOutcome | null>(null);
  const busy = ref(false);
  const loadError = ref('');

  const stage = computed<PromptStage>(() => {
    const current = view.value;
    if (!current) return loadError.value ? 'error' : 'loading';
    if (current.status === 'cancelled') return 'cancelled';
    const result = outcome.value;
    if (result?.status === 'done') return 'success';
    if (result?.status === 'unsigned') return 'unsigned';
    if (result?.status === 'fee_required') return 'fee';
    if (current.error === 'unknown_chain') return 'unknown_chain';
    if (current.error === 'no_wallets') return 'no_wallets';
    if (current.error) return 'error';
    if (current.forbidden.length > 0 && !current.dangerousAllowed) return 'forbidden';
    if (current.kind === 'identity') return 'identity';
    return 'review';
  });

  const signerWallet = computed(() => {
    const current = view.value;
    if (!current?.signer) return undefined;
    return current.wallets.find(
      (wallet) =>
        wallet.account === current.signer!.account &&
        wallet.authorization === current.signer!.authorization,
    );
  });
  const needsUnlock = computed(() => {
    const wallet = signerWallet.value;
    return Boolean(
      wallet &&
      wallet.mode !== 'watch' &&
      wallet.mode !== 'cold' &&
      wallet.mode !== 'ledger' &&
      !app.status.unlocked,
    );
  });
  const signError = computed(() =>
    outcome.value?.status === 'error' ? outcome.value.error : null,
  );

  async function load(signer?: RequestSigner): Promise<void> {
    busy.value = true;
    loadError.value = '';
    try {
      const record = await service.get(id);
      if (!record) throw new Error('unknown_request');
      const stored = record.outcome as RequestOutcome | undefined;
      if (stored?.status === 'done') outcome.value = stored;
      view.value = await service.resolve(id, signer);
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'unknown';
    } finally {
      busy.value = false;
    }
  }

  async function sign(options: { acceptFee?: boolean } = {}): Promise<void> {
    const current = view.value;
    if (!current?.signer || busy.value) return;
    busy.value = true;
    try {
      outcome.value = await service.sign(id, current.signer, options);
      if (outcome.value.status === 'ledger') {
        outcome.value = await signOnDevice(current.signer, outcome.value, options);
      }
      if (outcome.value.status === 'done') {
        const record = await service.get(id);
        if (record) view.value = { ...current, status: record.status };
      }
    } finally {
      busy.value = false;
    }
  }

  async function signOnDevice(
    signer: RequestSigner,
    pending: Extract<RequestOutcome, { status: 'ledger' }>,
    options: { acceptFee?: boolean },
  ): Promise<RequestOutcome> {
    const signature = await ledger.sign({
      path: pending.path,
      legacy: pending.legacy,
      chunks: pending.chunks,
    });
    if (!signature) {
      const message = ledger.error.value ?? 'ledger_failed';
      return { status: 'error', error: { kind: 'ledger', name: message, message, details: [] } };
    }
    return service.sign(id, signer, { ...options, ledgerSignature: signature });
  }

  async function cancel(): Promise<void> {
    try {
      await service.cancel(id);
    } finally {
      window.close();
    }
  }

  async function openCallback(): Promise<void> {
    await service.openCallback(id);
    if (outcome.value?.status === 'done' && outcome.value.callback) {
      outcome.value = {
        ...outcome.value,
        callback: { ...outcome.value.callback, sent: true },
      };
    }
  }

  function clearError(): void {
    if (outcome.value?.status === 'error') outcome.value = null;
  }

  return {
    view,
    outcome,
    busy,
    loadError,
    stage,
    signerWallet,
    needsUnlock,
    signError,
    ledgerWaiting: ledger.waiting,
    load,
    sign,
    cancel,
    openCallback,
    clearError,
  };
}
