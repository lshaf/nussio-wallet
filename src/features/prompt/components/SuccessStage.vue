<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useClipboard } from '@vueuse/core';
import { Check, CircleCheck, Copy, ExternalLink } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { transactionUrl } from '@/lib/antelope/explorers';
import type { RequestOutcome, RequestView } from '@/services/request.service';
import { useAppStore } from '@/stores/app.store';

const props = defineProps<{
  view: RequestView;
  outcome: Extract<RequestOutcome, { status: 'done' }>;
}>();
const emit = defineEmits<{ callback: [] }>();
const { t } = useTranslation('ext');
const app = useAppStore();
const { copy, copied } = useClipboard();

const explorer = computed(() =>
  props.view.chain && props.outcome.transactionId && props.view.broadcast
    ? transactionUrl(props.view.chain, props.outcome.transactionId, app.settings)
    : null,
);
const pendingCallback = computed(
  () =>
    props.outcome.callback && !props.outcome.callback.background && !props.outcome.callback.sent,
);
</script>

<template>
  <div class="mx-auto flex w-full max-w-md flex-col items-center gap-3 pt-2 text-center">
    <CircleCheck class="text-positive size-10" />
    <h2 class="font-semibold tracking-tight">
      {{ outcome.identity ? t('prompt_success_identity') : t('prompt_success_title') }}
    </h2>
    <p class="text-muted-foreground text-xs">
      {{
        outcome.identity
          ? t('prompt_success_identity_body', { app: view.appName ?? view.callback?.origin ?? '' })
          : view.broadcast
            ? t('prompt_success_broadcast_body')
            : t('prompt_success_signed_body')
      }}
    </p>
    <div
      v-if="outcome.transactionId && !outcome.identity"
      class="bg-card flex w-full items-center gap-2 rounded-md border p-2"
    >
      <code class="min-w-0 flex-1 font-mono text-xs break-all">{{ outcome.transactionId }}</code>
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="t('action_copy')"
        @click="copy(outcome.transactionId)"
      >
        <Check v-if="copied" />
        <Copy v-else />
      </Button>
    </div>
    <p v-if="outcome.fuel === 'free'" class="text-positive text-xs">{{ t('tx_fuel_free') }}</p>
    <p v-else-if="outcome.fuel === 'fee'" class="text-muted-foreground text-xs">
      {{ t('tx_fuel_fee_paid', { fee: outcome.fee ?? '' }) }}
    </p>
    <template v-if="outcome.callback">
      <p
        v-if="outcome.callback.background && outcome.callback.sent"
        class="text-muted-foreground text-xs"
      >
        {{ t('prompt_callback_sent', { origin: view.callback?.origin ?? '' }) }}
      </p>
      <p v-else-if="outcome.callback.background" class="text-warning text-xs">
        {{ t('prompt_callback_failed', { origin: view.callback?.origin ?? '' }) }}
      </p>
      <Button v-else-if="pendingCallback" @click="emit('callback')">
        <ExternalLink />
        {{ t('prompt_callback_open', { origin: view.callback?.origin ?? '' }) }}
      </Button>
    </template>
    <a
      v-if="explorer"
      :href="explorer"
      target="_blank"
      rel="noopener"
      class="text-primary inline-flex items-center gap-1 text-sm hover:underline"
    >
      <ExternalLink class="size-4" />
      {{ t('tx_view_explorer') }}
    </a>
  </div>
</template>
