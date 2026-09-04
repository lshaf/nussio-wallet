<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
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
import { formatAsset, parseAsset } from '@/lib/antelope/format';
import type { ActionInput } from '@/lib/antelope/transaction';
import type { Blockchain } from '@/lib/storage/schemas';
import type { AccountData } from '@/services/account.service';

const props = defineProps<{
  chain: Blockchain;
  data: AccountData;
  kind: 'cpu' | 'net';
  mode: 'stake' | 'unstake';
  signer: { actor: string; permission: string };
}>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ confirm: [actions: ActionInput[]] }>();

const { t } = useTranslation('ext');
const amount = ref('');

const liquid = computed(() => parseAsset(props.data.balance));
const staked = computed(() =>
  props.data.selfDelegated ? parseAsset(props.data.selfDelegated[props.kind]) : undefined,
);
const max = computed(() =>
  props.mode === 'stake' ? liquid.value.amount : (staked.value?.amount ?? 0),
);
const value = computed(() => Number(amount.value.replace(/,/g, '')));
const error = computed(() => {
  if (amount.value.length === 0) return '';
  if (!(value.value > 0)) return t('stake_error_amount');
  if (value.value > max.value) return t('stake_error_max');
  return '';
});
const valid = computed(() => value.value > 0 && value.value <= max.value);

watch(open, (isOpen) => {
  if (!isOpen) amount.value = '';
});

function quantity(number: number): string {
  return `${number.toFixed(props.chain.tokenPrecision)} ${props.chain.symbol}`;
}

function submit(): void {
  if (!valid.value) return;
  const zero = quantity(0);
  const leg = quantity(value.value);
  const cpu = props.kind === 'cpu' ? leg : zero;
  const net = props.kind === 'net' ? leg : zero;
  const action: ActionInput =
    props.mode === 'stake'
      ? {
          account: props.chain.systemContract,
          name: 'delegatebw',
          authorization: [props.signer],
          data: {
            from: props.signer.actor,
            receiver: props.signer.actor,
            stake_net_quantity: net,
            stake_cpu_quantity: cpu,
            transfer: false,
          },
        }
      : {
          account: props.chain.systemContract,
          name: 'undelegatebw',
          authorization: [props.signer],
          data: {
            from: props.signer.actor,
            receiver: props.signer.actor,
            unstake_net_quantity: net,
            unstake_cpu_quantity: cpu,
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
          <DialogTitle>{{ t(`${mode}_title_${kind}`) }}</DialogTitle>
          <DialogDescription>{{ t(`${mode}_description`) }}</DialogDescription>
        </DialogHeader>
        <DataList
          :items="[
            {
              label: t('stake_available'),
              value: formatAsset(liquid.amount, liquid.symbol, liquid.precision),
            },
            {
              label: t('stake_staked'),
              value: staked ? formatAsset(staked.amount, staked.symbol, staked.precision) : '—',
            },
          ]"
        />
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label for="stake-amount">{{ t('stake_amount') }}</Label>
            <button
              type="button"
              class="text-primary text-xs font-medium hover:underline"
              @click="amount = max.toFixed(chain.tokenPrecision)"
            >
              {{ t('send_max') }}
            </button>
          </div>
          <Input id="stake-amount" v-model="amount" class="num" inputmode="decimal" autofocus />
          <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" @click="open = false">{{
            t('action_cancel')
          }}</Button>
          <Button type="submit" :disabled="!valid">{{ t(`resources_action_${mode}`) }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
