<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useDebounceFn } from '@vueuse/core';
import { Loader2 } from 'lucide-vue-next';
import DataList from '@/components/shared/DataList.vue';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useResourcesService } from '@/composables/useServices';
import { formatAsset, parseAsset } from '@/lib/antelope/format';
import type { ActionInput } from '@/lib/antelope/transaction';
import type { Blockchain } from '@/lib/storage/schemas';
import type { AccountData } from '@/services/account.service';

const TINY_MS = 0.1;
const TINY_KB = 0.1;

const props = defineProps<{
  chain: Blockchain;
  data: AccountData;
  kind: 'cpu' | 'net';
  mode: 'powerup' | 'rex';
  signer: { actor: string; permission: string };
}>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ confirm: [actions: ActionInput[]] }>();

const { t } = useTranslation('ext');
const service = useResourcesService();

const amount = ref('');
const includeOther = ref(true);
const cost = ref<number>();
const quoting = ref(false);
const error = ref('');
let quoteToken = 0;

const liquid = computed(() => parseAsset(props.data.balance));
const value = computed(() => Number(amount.value.replace(/,/g, '')));
const unit = computed(() => (props.kind === 'cpu' ? t('rent_unit_ms') : t('rent_unit_kb')));
const affordable = computed(() => cost.value !== undefined && cost.value <= liquid.value.amount);
const valid = computed(() => value.value > 0 && cost.value !== undefined && affordable.value);

function legs(): { ms: number; kb: number } {
  const other = props.mode === 'powerup' && includeOther.value;
  return props.kind === 'cpu'
    ? { ms: value.value, kb: other ? TINY_KB : 0 }
    : { ms: other ? TINY_MS : 0, kb: value.value };
}

const quote = useDebounceFn(async () => {
  const token = ++quoteToken;
  cost.value = undefined;
  error.value = '';
  if (!(value.value > 0)) return;
  quoting.value = true;
  const { ms, kb } = legs();
  try {
    const result =
      props.mode === 'powerup'
        ? await service.quotePowerUp(props.chain.chainId, ms, kb, props.signer.actor)
        : await service.quoteRex(props.chain.chainId, ms, kb, props.signer.actor);
    if (token !== quoteToken) return;
    cost.value = result.cost;
  } catch (failure) {
    if (token !== quoteToken) return;
    error.value =
      failure instanceof Error && failure.message.includes('amount_too_small')
        ? t('rent_error_small')
        : t('rent_error_quote');
  } finally {
    if (token === quoteToken) quoting.value = false;
  }
}, 400);

watch([amount, includeOther], () => void quote());
watch(open, (isOpen) => {
  if (isOpen) return;
  amount.value = '';
  cost.value = undefined;
  error.value = '';
});

function quantity(number: number): string {
  return `${number.toFixed(props.chain.tokenPrecision)} ${props.chain.symbol}`;
}

async function submit(): Promise<void> {
  if (!valid.value) return;
  const { ms, kb } = legs();
  const authorization = [props.signer];
  if (props.mode === 'powerup') {
    const result = await service.quotePowerUp(props.chain.chainId, ms, kb, props.signer.actor);
    emit('confirm', [
      {
        account: props.chain.systemContract,
        name: 'powerup',
        authorization,
        data: {
          payer: props.signer.actor,
          receiver: props.signer.actor,
          days: result.days,
          net_frac: result.netFrac,
          cpu_frac: result.cpuFrac,
          max_payment: result.maxPayment,
        },
      },
    ]);
  } else {
    const result = await service.quoteRex(props.chain.chainId, ms, kb, props.signer.actor);
    emit('confirm', [
      {
        account: props.chain.systemContract,
        name: 'deposit',
        authorization,
        data: { owner: props.signer.actor, amount: result.payment },
      },
      {
        account: props.chain.systemContract,
        name: props.kind === 'cpu' ? 'rentcpu' : 'rentnet',
        authorization,
        data: {
          from: props.signer.actor,
          receiver: props.signer.actor,
          loan_payment: result.payment,
          loan_fund: quantity(0),
        },
      },
    ]);
  }
  open.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-sm">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ t(`rent_${mode}_title_${kind}`) }}</DialogTitle>
          <DialogDescription>{{ t(`rent_${mode}_description`) }}</DialogDescription>
        </DialogHeader>

        <DataList
          :items="[
            {
              label: t('stake_available'),
              value: formatAsset(liquid.amount, liquid.symbol, liquid.precision),
            },
          ]"
        />

        <div class="flex flex-col gap-2">
          <Label for="rent-amount">{{ t('rent_amount', { unit }) }}</Label>
          <Input id="rent-amount" v-model="amount" class="num" inputmode="decimal" autofocus />
        </div>

        <label
          v-if="mode === 'powerup'"
          class="flex cursor-pointer items-center gap-2 text-xs"
          for="rent-include-other"
        >
          <Checkbox
            id="rent-include-other"
            :model-value="includeOther"
            @update:model-value="(next) => (includeOther = next === true)"
          />
          <span>{{ t('rent_include_other') }}</span>
        </label>

        <p v-if="quoting" class="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 class="size-4 animate-spin" />
          {{ t('rent_quoting') }}
        </p>
        <p v-else-if="error" class="text-destructive text-sm">{{ error }}</p>
        <p v-else-if="cost !== undefined" class="text-sm">
          {{ t('rent_estimate', { amount: value, unit, cost: quantity(cost) }) }}
        </p>
        <p v-if="cost !== undefined && !affordable" class="text-destructive text-sm">
          {{ t('send_error_insufficient') }}
        </p>

        <DialogFooter>
          <Button type="button" variant="ghost" @click="open = false">{{
            t('action_cancel')
          }}</Button>
          <Button type="submit" :disabled="!valid || quoting">{{ t('rent_action') }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
