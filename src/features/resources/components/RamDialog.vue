<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useDebounceFn } from '@vueuse/core';
import { Loader2 } from 'lucide-vue-next';
import DataList from '@/components/shared/DataList.vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useResourcesService } from '@/composables/useServices';
import { formatAsset, formatBytes, parseAsset } from '@/lib/antelope/format';
import type { ActionInput } from '@/lib/antelope/transaction';
import type { Blockchain } from '@/lib/storage/schemas';
import type { AccountData } from '@/services/account.service';

const MIN_BYTES = 64;

const props = defineProps<{
  chain: Blockchain;
  data: AccountData;
  mode: 'buy' | 'sell';
  signer: { actor: string; permission: string };
}>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ confirm: [actions: ActionInput[]] }>();

const { t } = useTranslation('ext');
const service = useResourcesService();

const by = ref<'bytes' | 'tokens'>('bytes');
const amount = ref('');
const bytes = ref<number>();
const cost = ref<number>();
const quoting = ref(false);
const error = ref('');
let quoteToken = 0;

const liquid = computed(() => parseAsset(props.data.balance));
const free = computed(() => Math.max(0, props.data.ram.quota - props.data.ram.used));
const value = computed(() => Number(amount.value.replace(/,/g, '')));
const bytesOnly = computed(() => props.mode === 'sell' || props.chain.ramSymbol === 'UTXRAM');

const problem = computed(() => {
  if (bytes.value === undefined || cost.value === undefined) return '';
  if (props.mode === 'buy' && bytes.value < MIN_BYTES) return t('ram_error_min');
  if (props.mode === 'buy' && cost.value > liquid.value.amount) return t('send_error_insufficient');
  if (props.mode === 'sell' && bytes.value > free.value) return t('ram_error_usage');
  return '';
});
const valid = computed(
  () => value.value > 0 && bytes.value !== undefined && problem.value.length === 0,
);

const quote = useDebounceFn(async () => {
  const token = ++quoteToken;
  bytes.value = undefined;
  cost.value = undefined;
  error.value = '';
  if (!(value.value > 0)) return;
  quoting.value = true;
  try {
    const result =
      props.mode === 'sell'
        ? await service.quoteRamSell(props.chain.chainId, value.value)
        : await service.quoteRamBuy(
            props.chain.chainId,
            by.value === 'bytes' ? { bytes: value.value } : { amount: value.value },
          );
    if (token !== quoteToken) return;
    bytes.value = result.bytes;
    cost.value = result.cost;
  } catch {
    if (token === quoteToken) error.value = t('ram_error_quote');
  } finally {
    if (token === quoteToken) quoting.value = false;
  }
}, 400);

watch([amount, by], () => void quote());
watch(open, (isOpen) => {
  if (isOpen) {
    by.value = bytesOnly.value ? 'bytes' : 'bytes';
    return;
  }
  amount.value = '';
  bytes.value = undefined;
  cost.value = undefined;
  error.value = '';
});

function quantity(number: number): string {
  return `${number.toFixed(props.chain.tokenPrecision)} ${props.chain.symbol}`;
}

function submit(): void {
  if (!valid.value || bytes.value === undefined || cost.value === undefined) return;
  const authorization = [props.signer];
  const action: ActionInput =
    props.mode === 'sell'
      ? {
          account: props.chain.systemContract,
          name: 'sellram',
          authorization,
          data: { account: props.signer.actor, bytes: bytes.value },
        }
      : by.value === 'bytes'
        ? {
            account: props.chain.systemContract,
            name: 'buyrambytes',
            authorization,
            data: {
              payer: props.signer.actor,
              receiver: props.signer.actor,
              bytes: bytes.value,
            },
          }
        : {
            account: props.chain.systemContract,
            name: 'buyram',
            authorization,
            data: {
              payer: props.signer.actor,
              receiver: props.signer.actor,
              quant: quantity(value.value),
            },
          };
  emit('confirm', [action]);
  open.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-sm">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ t(`ram_${mode}_title`) }}</DialogTitle>
          <DialogDescription>{{ t(`ram_${mode}_description`) }}</DialogDescription>
        </DialogHeader>

        <DataList
          :items="[
            {
              label: t('stake_available'),
              value: formatAsset(liquid.amount, liquid.symbol, liquid.precision),
            },
            { label: t('resources_ram_free'), value: formatBytes(free) },
          ]"
        />

        <Tabs v-if="!bytesOnly" v-model="by">
          <TabsList class="w-full">
            <TabsTrigger value="bytes" class="flex-1">{{ t('ram_by_bytes') }}</TabsTrigger>
            <TabsTrigger value="tokens" class="flex-1">{{
              t('ram_by_tokens', { symbol: chain.symbol })
            }}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div class="flex flex-col gap-2">
          <Label for="ram-amount">{{
            by === 'bytes'
              ? t('ram_amount_bytes')
              : t('ram_amount_tokens', { symbol: chain.symbol })
          }}</Label>
          <Input id="ram-amount" v-model="amount" class="num" inputmode="decimal" autofocus />
        </div>

        <p v-if="quoting" class="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 class="size-4 animate-spin" />
          {{ t('rent_quoting') }}
        </p>
        <p v-else-if="error" class="text-destructive text-sm">{{ error }}</p>
        <p v-else-if="bytes !== undefined && cost !== undefined" class="text-sm">
          {{
            mode === 'buy'
              ? t('ram_estimate_buy', { bytes: formatBytes(bytes), cost: quantity(cost) })
              : t('ram_estimate_sell', { bytes: formatBytes(bytes), cost: quantity(cost) })
          }}
        </p>
        <p v-if="problem" class="text-destructive text-sm">{{ problem }}</p>

        <DialogFooter>
          <Button type="button" variant="ghost" @click="open = false">{{
            t('action_cancel')
          }}</Button>
          <Button type="submit" :disabled="!valid || quoting">{{
            t(`resources_action_${mode}`)
          }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
