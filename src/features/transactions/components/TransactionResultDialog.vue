<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useClipboard } from '@vueuse/core';
import { AlertTriangle, Check, CircleCheck, Copy, ExternalLink, Loader2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import UnlockDialog from '@/components/dialogs/UnlockDialog.vue';
import { transactionUrl } from '@/lib/antelope/explorers';
import type { TransactResult } from '@/services/transaction.service';
import { useAppStore } from '@/stores/app.store';
import ActionList from './ActionList.vue';
import UnsignedExport from './UnsignedExport.vue';

const props = defineProps<{ busy: boolean; result: TransactResult | null }>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ proceed: []; retry: [] }>();

const { t } = useTranslation('ext');
const app = useAppStore();
const { copy, copied } = useClipboard();
const unlockOpen = ref(false);

const explorer = computed(() => {
  if (props.result?.status !== 'success' || !app.currentChain) return null;
  return transactionUrl(app.currentChain, props.result.transactionId, app.settings);
});

const title = computed(() => {
  if (props.busy) return t('tx_busy_title');
  switch (props.result?.status) {
    case 'success':
      return t('tx_success_title');
    case 'unsigned':
      return t('tx_unsigned_title');
    case 'fee_required':
      return t('tx_fee_title');
    case 'error':
      return t(`tx_error_${props.result.error.kind}_title`);
    default:
      return '';
  }
});

function setAutoFee(value: boolean | 'indeterminate'): void {
  void app.updateSettings({ transactionFees: value === true });
}

function onUnlocked(): void {
  emit('retry');
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Loader2 v-if="busy" class="text-muted-foreground size-5 animate-spin" />
          <CircleCheck v-else-if="result?.status === 'success'" class="text-positive size-5" />
          <AlertTriangle
            v-else-if="result?.status === 'error' || result?.status === 'fee_required'"
            class="size-5"
            :class="result.status === 'error' ? 'text-destructive' : 'text-warning'"
          />
          {{ title }}
        </DialogTitle>
        <DialogDescription v-if="busy">{{ t('tx_busy_description') }}</DialogDescription>
      </DialogHeader>

      <template v-if="!busy && result">
        <div v-if="result.status === 'success'" class="flex flex-col gap-4">
          <p class="text-sm">{{ t('tx_success_description') }}</p>
          <div class="bg-muted flex items-center gap-2 rounded-md p-2">
            <code class="min-w-0 flex-1 font-mono text-xs break-all">{{
              result.transactionId
            }}</code>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="t('action_copy')"
              @click="copy(result.transactionId)"
            >
              <Check v-if="copied" />
              <Copy v-else />
            </Button>
          </div>
          <p v-if="result.fuel === 'free'" class="text-positive text-xs">{{ t('tx_fuel_free') }}</p>
          <p v-else-if="result.fuel === 'fee'" class="text-muted-foreground text-xs">
            {{ t('tx_fuel_fee_paid', { fee: result.fee ?? '' }) }}
          </p>
          <p class="text-muted-foreground text-xs">{{ t('tx_irreversible') }}</p>
        </div>

        <UnsignedExport v-else-if="result.status === 'unsigned'" :result="result" />

        <div v-else-if="result.status === 'fee_required'" class="flex flex-col gap-4">
          <p class="text-sm">{{ t('tx_fee_description') }}</p>
          <div class="bg-card rounded-lg border p-3">
            <p class="eyebrow">{{ t('tx_fee_amount') }}</p>
            <p class="num mt-1 text-xl font-semibold">{{ result.fee }}</p>
            <dl
              v-if="Object.keys(result.costs).length > 0"
              class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs"
            >
              <template v-for="(value, key) in result.costs" :key="key">
                <dt class="text-muted-foreground uppercase">{{ key }}</dt>
                <dd class="num text-right">{{ value }}</dd>
              </template>
            </dl>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <Checkbox
              :model-value="app.settings.transactionFees"
              @update:model-value="setAutoFee"
            />
            <span>{{ t('settings_fees') }}</span>
          </label>
        </div>

        <div v-else-if="result.status === 'error'" class="flex flex-col gap-3">
          <p class="text-sm">{{ t(`tx_error_${result.error.kind}`) }}</p>
          <p
            v-if="result.error.kind === 'assert' || result.error.kind === 'unknown'"
            class="bg-muted rounded-md p-2 font-mono text-xs break-all"
          >
            {{ result.error.message }}
          </p>
          <ul
            v-if="result.error.kind === 'authorization'"
            class="text-muted-foreground list-disc pl-5 text-xs"
          >
            <li>{{ t('tx_error_authorization_hint_key') }}</li>
            <li>{{ t('tx_error_authorization_hint_permission') }}</li>
          </ul>
          <details v-if="result.error.details.length > 0" class="text-xs">
            <summary class="text-muted-foreground cursor-pointer">
              {{ t('tx_error_details') }}
            </summary>
            <ul class="mt-1 flex flex-col gap-1 font-mono">
              <li v-for="(detail, index) in result.error.details" :key="index" class="break-all">
                {{ detail }}
              </li>
            </ul>
          </details>
        </div>

        <details
          v-if="result.status !== 'unsigned' && result.actions && result.actions.length > 0"
          class="text-sm"
        >
          <summary class="text-muted-foreground cursor-pointer">
            {{ t('tx_actions_count', { count: result.actions.length }) }}
          </summary>
          <ActionList :actions="result.actions" class="mt-2" />
        </details>
      </template>

      <DialogFooter v-if="!busy" class="gap-2">
        <a
          v-if="explorer"
          :href="explorer"
          target="_blank"
          rel="noopener"
          class="text-primary inline-flex items-center gap-1 self-center text-sm hover:underline"
        >
          <ExternalLink class="size-4" />
          {{ t('tx_view_explorer') }}
        </a>
        <div class="flex-1" />
        <template v-if="result?.status === 'fee_required'">
          <Button variant="ghost" @click="open = false">{{ t('action_cancel') }}</Button>
          <Button @click="emit('proceed')">{{ t('tx_fee_proceed', { fee: result.fee }) }}</Button>
        </template>
        <template v-else-if="result?.status === 'error' && result.error.kind === 'locked'">
          <Button variant="ghost" @click="open = false">{{ t('action_close') }}</Button>
          <Button @click="unlockOpen = true">{{ t('action_unlock') }}</Button>
        </template>
        <Button v-else @click="open = false">{{ t('action_close') }}</Button>
      </DialogFooter>
      <UnlockDialog v-model:open="unlockOpen" @unlocked="onUnlocked" />
    </DialogContent>
  </Dialog>
</template>
