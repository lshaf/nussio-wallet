<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useClipboard } from '@vueuse/core';
import { AlertTriangle, Check, Copy, Loader2, Lock, ShieldAlert, X } from 'lucide-vue-next';
import { browser } from 'wxt/browser';
import AppMark from '@/components/shared/AppMark.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import UnlockDialog from '@/components/dialogs/UnlockDialog.vue';
import { chainLogo } from '@/lib/antelope/logos';
import FuelBanner from '@/features/prompt/components/FuelBanner.vue';
import IdentityStage from '@/features/prompt/components/IdentityStage.vue';
import ReviewStage from '@/features/prompt/components/ReviewStage.vue';
import SuccessStage from '@/features/prompt/components/SuccessStage.vue';
import { usePromptRequest } from '@/features/prompt/composables/usePromptRequest';
import UnsignedExport from '@/features/transactions/components/UnsignedExport.vue';
import type { TransactResult } from '@/services/transaction.service';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();
const requestId = new URLSearchParams(window.location.search).get('id') ?? '';
const prompt = usePromptRequest(requestId);
const { copy, copied } = useClipboard();
const unlockOpen = ref(false);

const title = computed(() => {
  switch (prompt.stage.value) {
    case 'identity':
      return t('prompt_title_identity');
    case 'success':
      return t('prompt_title_done');
    default:
      return t('prompt_title');
  }
});

const signerLabel = computed(() => {
  const signer = prompt.view.value?.signer;
  return signer ? `${signer.account}@${signer.authorization}` : '';
});

const unsignedResult = computed<Extract<TransactResult, { status: 'unsigned' }> | null>(() => {
  const outcome = prompt.outcome.value;
  const view = prompt.view.value;
  if (outcome?.status !== 'unsigned' || !view) return null;
  return {
    status: 'unsigned',
    chainId: view.chainId ?? '',
    transaction: view.transaction ?? {},
    file: outcome.file,
    esr: outcome.esr,
    actions: outcome.actions,
    expiration: outcome.expiration,
  };
});

const primary = computed(() => {
  const view = prompt.view.value;
  const stage = prompt.stage.value;
  if (!view) return null;
  if (stage === 'review' || stage === 'identity') {
    if (prompt.needsUnlock.value) return { key: 'unlock', label: t('action_unlock') };
    if (prompt.signerWallet.value?.mode === 'watch')
      return { key: 'sign', label: t('prompt_action_export') };
    return {
      key: 'sign',
      label:
        stage === 'identity'
          ? t('prompt_action_login', { signer: signerLabel.value })
          : t('prompt_action_sign', { signer: signerLabel.value }),
    };
  }
  if (stage === 'fee' && prompt.outcome.value?.status === 'fee_required')
    return { key: 'fee', label: t('tx_fee_proceed', { fee: prompt.outcome.value.fee }) };
  if (stage === 'no_wallets') return { key: 'import', label: t('action_import_account') };
  return null;
});

function setAutoFee(value: boolean | 'indeterminate'): void {
  void app.updateSettings({ transactionFees: value === true });
}

async function onPrimary(): Promise<void> {
  switch (primary.value?.key) {
    case 'unlock':
      unlockOpen.value = true;
      return;
    case 'sign':
      await prompt.sign();
      return;
    case 'fee':
      await prompt.sign({ acceptFee: true });
      return;
    case 'import':
      await browser.tabs.create({ url: browser.runtime.getURL('/app.html#/setup/import') });
      window.close();
      return;
    default:
      return;
  }
}

function close(): void {
  window.close();
}

watch(
  () => prompt.outcome.value,
  (outcome) => {
    if (outcome?.status !== 'done' || !app.settings.promptCloseOnComplete) return;
    const pending = outcome.callback && !outcome.callback.background && !outcome.callback.sent;
    if (!pending) setTimeout(close, 1500);
  },
);

onMounted(async () => {
  await app.ready();
  await prompt.load();
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') void prompt.cancel();
  });
});
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="bg-card flex min-h-14 flex-wrap items-center gap-3 border-b px-4 py-2">
      <AppMark size="sm" :wordmark="false" />
      <h1 class="font-semibold">{{ title }}</h1>
      <span v-if="prompt.view.value?.chain" class="flex items-center gap-1.5 text-sm">
        <img
          v-if="chainLogo(prompt.view.value.chain.id)"
          :src="chainLogo(prompt.view.value.chain.id)"
          class="size-4 rounded-full"
          alt=""
        />
        {{ prompt.view.value.chain.name }}
      </span>
      <div class="flex-1" />
      <Badge
        v-if="prompt.view.value?.callback"
        variant="outline"
        class="max-w-56 truncate font-mono"
        >{{ prompt.view.value.callback.origin }}</Badge
      >
      <Badge
        v-if="prompt.view.value && prompt.view.value.kind === 'transaction'"
        variant="secondary"
        >{{ t('tx_actions_count', { count: prompt.view.value.actions.length }) }}</Badge
      >
    </header>

    <main class="relative flex-1 overflow-auto p-4 md:p-5">
      <div
        v-if="prompt.busy.value && prompt.view.value"
        class="bg-background/70 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm"
      >
        <div class="flex items-center gap-2 text-sm">
          <Loader2 class="size-5 animate-spin" />
          {{ t('tx_busy_description') }}
        </div>
      </div>

      <div v-if="prompt.stage.value === 'loading'" class="flex h-full items-center justify-center">
        <Loader2 class="text-muted-foreground size-6 animate-spin" />
      </div>

      <div
        v-else-if="prompt.stage.value === 'error' || prompt.stage.value === 'unknown_chain'"
        class="mx-auto flex max-w-md flex-col items-center gap-3 text-center"
      >
        <AlertTriangle class="text-destructive size-10" />
        <h2 class="text-lg font-semibold">
          {{
            prompt.stage.value === 'unknown_chain'
              ? t('prompt_unknown_chain_title')
              : t('prompt_invalid_title')
          }}
        </h2>
        <p class="text-muted-foreground text-sm">
          {{
            prompt.stage.value === 'unknown_chain'
              ? t('prompt_unknown_chain_body')
              : t('prompt_invalid_body')
          }}
        </p>
        <code
          v-if="prompt.view.value?.errorMessage || prompt.loadError.value"
          class="bg-muted rounded-md p-2 font-mono text-xs break-all"
          >{{ prompt.view.value?.errorMessage || prompt.loadError.value }}</code
        >
        <code
          v-if="prompt.stage.value === 'unknown_chain'"
          class="bg-muted rounded-md p-2 font-mono text-xs break-all"
          >{{ prompt.view.value?.chainIds.join(', ') }}</code
        >
      </div>

      <div
        v-else-if="prompt.stage.value === 'no_wallets'"
        class="mx-auto flex max-w-md flex-col items-center gap-3 text-center"
      >
        <AlertTriangle class="text-warning size-10" />
        <h2 class="text-lg font-semibold">{{ t('prompt_no_wallets_title') }}</h2>
        <p class="text-muted-foreground text-sm">
          {{ t('prompt_no_wallets_body', { chain: prompt.view.value?.chain?.name ?? '' }) }}
        </p>
      </div>

      <div
        v-else-if="prompt.stage.value === 'forbidden'"
        class="mx-auto flex max-w-md flex-col items-center gap-3 text-center"
      >
        <ShieldAlert class="text-destructive size-10" />
        <h2 class="text-lg font-semibold">{{ t('prompt_forbidden_title') }}</h2>
        <p class="text-muted-foreground text-sm">{{ t('prompt_forbidden_body') }}</p>
        <code class="bg-muted rounded-md p-2 font-mono text-xs">{{
          prompt.view.value?.forbidden.join(', ')
        }}</code>
      </div>

      <div
        v-else-if="prompt.stage.value === 'cancelled'"
        class="text-muted-foreground flex h-full items-center justify-center text-sm"
      >
        {{ t('prompt_cancelled') }}
      </div>

      <template v-else-if="prompt.view.value">
        <div
          v-if="prompt.signError.value"
          class="border-destructive/40 bg-destructive/10 mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <Lock v-if="prompt.signError.value.kind === 'locked'" class="mt-0.5 size-4 shrink-0" />
          <AlertTriangle v-else class="text-destructive mt-0.5 size-4 shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="font-medium">{{ t(`tx_error_${prompt.signError.value.kind}_title`) }}</p>
            <p class="text-muted-foreground text-xs">
              {{ t(`tx_error_${prompt.signError.value.kind}`) }}
            </p>
            <p
              v-if="
                prompt.signError.value.kind === 'assert' ||
                prompt.signError.value.kind === 'unknown'
              "
              class="mt-1 font-mono text-xs break-all"
            >
              {{ prompt.signError.value.message }}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            :aria-label="t('action_close')"
            @click="prompt.clearError"
          >
            <X />
          </Button>
        </div>

        <SuccessStage
          v-if="prompt.stage.value === 'success' && prompt.outcome.value?.status === 'done'"
          :view="prompt.view.value"
          :outcome="prompt.outcome.value"
          @callback="prompt.openCallback"
        />
        <UnsignedExport
          v-else-if="prompt.stage.value === 'unsigned' && unsignedResult"
          :result="unsignedResult"
        />
        <div
          v-else-if="
            prompt.stage.value === 'fee' && prompt.outcome.value?.status === 'fee_required'
          "
          class="mx-auto flex w-full max-w-md flex-col gap-4"
        >
          <FuelBanner :fee="prompt.outcome.value.fee" :costs="prompt.outcome.value.costs" />
          <p class="text-muted-foreground text-sm">{{ t('tx_fee_description') }}</p>
          <label class="flex items-center gap-2 text-sm">
            <Checkbox
              :model-value="app.settings.transactionFees"
              @update:model-value="setAutoFee"
            />
            <span>{{ t('settings_fees') }}</span>
          </label>
        </div>
        <IdentityStage
          v-else-if="prompt.stage.value === 'identity'"
          :view="prompt.view.value"
          @signer="(signer) => prompt.load(signer)"
        />
        <ReviewStage
          v-else
          :view="prompt.view.value"
          @signer="(signer) => prompt.load(signer)"
          @expired="() => prompt.load()"
        />
      </template>
    </main>

    <footer class="bg-card flex flex-wrap items-center gap-2 border-t px-4 py-3">
      <Button
        v-if="prompt.stage.value !== 'success' && prompt.stage.value !== 'cancelled'"
        variant="ghost"
        :disabled="prompt.busy.value"
        @click="prompt.cancel"
      >
        <X />
        {{ t('action_cancel') }}
      </Button>
      <Button
        v-if="prompt.view.value"
        variant="ghost"
        size="sm"
        :aria-label="t('prompt_copy_request')"
        @click="copy(prompt.view.value.uri)"
      >
        <Check v-if="copied" />
        <Copy v-else />
        <span class="hidden sm:inline">{{
          copied ? t('action_copied') : t('prompt_copy_request')
        }}</span>
      </Button>
      <div class="flex-1" />
      <Button
        v-if="
          prompt.stage.value === 'success' ||
          prompt.stage.value === 'cancelled' ||
          prompt.stage.value === 'unsigned' ||
          prompt.stage.value === 'forbidden' ||
          prompt.stage.value === 'error' ||
          prompt.stage.value === 'unknown_chain'
        "
        @click="close"
      >
        {{ t('action_close') }}
      </Button>
      <Button v-if="primary" :disabled="prompt.busy.value" @click="onPrimary">
        <Lock v-if="primary.key === 'unlock'" />
        {{ primary.label }}
      </Button>
    </footer>
    <UnlockDialog v-model:open="unlockOpen" @unlocked="prompt.sign()" />
  </div>
</template>
