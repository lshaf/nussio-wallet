<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useQuery } from '@tanstack/vue-query';
import { Undo2 } from 'lucide-vue-next';
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
import { useAccountService, type Delegation } from '@/composables/useServices';
import { formatAsset, parseAsset } from '@/lib/antelope/format';
import type { ActionInput } from '@/lib/antelope/transaction';
import type { Blockchain } from '@/lib/storage/schemas';

const props = defineProps<{
  chain: Blockchain;
  account: string;
  canSign: boolean;
  signer?: { actor: string; permission: string };
}>();
const emit = defineEmits<{ confirm: [actions: ActionInput[]] }>();

const { t } = useTranslation('ext');
const service = useAccountService();
const confirming = ref<Delegation>();

const query = useQuery(
  computed(() => ({
    queryKey: ['delegations', props.chain.chainId, props.account],
    queryFn: () => service.getDelegations(props.chain.chainId, props.account),
    enabled: Boolean(props.account),
    retry: 1,
  })),
);

const rows = computed(() => query.data.value ?? []);

function pretty(quantity: string): string {
  const asset = parseAsset(quantity);
  return formatAsset(asset.amount, asset.symbol, asset.precision);
}

watch(
  () => props.account,
  () => (confirming.value = undefined),
);

function reclaim(): void {
  const row = confirming.value;
  if (!row || !props.signer) return;
  emit('confirm', [
    {
      account: props.chain.systemContract,
      name: 'undelegatebw',
      authorization: [props.signer],
      data: {
        from: props.signer.actor,
        receiver: row.to,
        unstake_net_quantity: row.net,
        unstake_cpu_quantity: row.cpu,
      },
    },
  ]);
  confirming.value = undefined;
}
</script>

<template>
  <section v-if="rows.length > 0" class="bg-card flex flex-col gap-4 rounded-xl border p-4 md:p-5">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="eyebrow text-foreground">{{ t('delegations_title') }}</h2>
      <span class="text-muted-foreground text-xs">{{
        t('delegations_count', { count: rows.length })
      }}</span>
    </div>
    <div class="divide-y">
      <div v-for="row in rows" :key="row.to" class="flex flex-wrap items-center gap-3 py-2.5">
        <span class="min-w-0 flex-1 font-mono text-sm">{{ row.to }}</span>
        <DataList
          size="sm"
          class="w-40"
          :items="[
            { label: 'CPU', value: pretty(row.cpu) },
            { label: 'NET', value: pretty(row.net) },
          ]"
        />
        <Button variant="outline" size="sm" :disabled="!canSign" @click="confirming = row">
          <Undo2 />
          {{ t('delegations_reclaim') }}
        </Button>
      </div>
    </div>

    <Dialog
      :open="confirming !== undefined"
      @update:open="(open) => !open && (confirming = undefined)"
    >
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ t('delegations_reclaim_title') }}</DialogTitle>
          <DialogDescription>{{
            t('delegations_reclaim_description', { account: confirming?.to ?? '' })
          }}</DialogDescription>
        </DialogHeader>
        <DataList
          v-if="confirming"
          :items="[
            { label: 'CPU', value: pretty(confirming.cpu) },
            { label: 'NET', value: pretty(confirming.net) },
          ]"
        />
        <DialogFooter>
          <Button variant="ghost" @click="confirming = undefined">{{ t('action_cancel') }}</Button>
          <Button @click="reclaim">{{ t('delegations_reclaim') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
