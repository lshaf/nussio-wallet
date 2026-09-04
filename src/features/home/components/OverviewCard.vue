<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { useTimeAgo } from '@vueuse/core';
import { ChevronRight, RefreshCw } from 'lucide-vue-next';
import DataList, { type DataListItem } from '@/components/shared/DataList.vue';
import { Button } from '@/components/ui/button';
import { formatBytes, formatMicroseconds, formatNumber } from '@/lib/antelope/format';
import type { Blockchain } from '@/lib/storage/schemas';
import { useAccountOverview } from '../composables/useAccountOverview';

const props = defineProps<{
  chain: Blockchain;
  account: string;
  tab: 'systemtokens' | 'balances' | 'resources' | 'governance';
  usd?: number;
}>();

const { t } = useTranslation('ext');
const overview = useAccountOverview(
  () => props.chain,
  () => props.account,
);
const { query, data } = overview;
const ago = useTimeAgo(computed(() => data.value?.fetchedAt ?? 0));

const items = computed<DataListItem[]>(() => {
  const value = data.value;
  if (!value) return [];
  switch (props.tab) {
    case 'systemtokens': {
      const list: DataListItem[] = [
        { label: t('overview_col_total'), value: overview.money(overview.total.value) },
        { label: t('overview_col_available'), value: overview.money(overview.liquid.value) },
      ];
      if (props.usd !== undefined)
        list.push({
          label: t('overview_col_usd'),
          value: `$${formatNumber(overview.total.value * props.usd, 2)}`,
        });
      if (props.chain.stakedResources) {
        list.push({
          label: t('overview_col_staked'),
          value: overview.money(overview.staked.value),
        });
        if (props.chain.features.includes('rex'))
          list.push({ label: t('overview_col_rex'), value: overview.money(overview.rex.value) });
        list.push(
          { label: t('overview_col_delegated'), value: overview.money(overview.delegated.value) },
          { label: t('overview_col_refunding'), value: overview.money(overview.refunding.value) },
        );
      }
      return list;
    }
    case 'balances':
      return overview.nonZeroBalances.value.map((balance) => ({
        label: balance.contract,
        value: balance.amount,
        mono: true,
      }));
    case 'resources':
      return [
        { label: t('overview_col_cpu'), value: formatMicroseconds(value.cpu.available) },
        { label: t('overview_col_net'), value: formatBytes(value.net.available) },
        {
          label: t('overview_col_ram'),
          value: formatBytes(Math.max(0, value.ram.quota - value.ram.used)),
        },
      ];
    default:
      return [
        {
          label: t('overview_col_vote_weight'),
          value: formatNumber(overview.voteValue.value, props.chain.tokenPrecision),
        },
        {
          label: t('overview_col_effectiveness'),
          value:
            overview.effectiveness.value === undefined
              ? '—'
              : `${formatNumber(overview.effectiveness.value, 2)} %`,
        },
        { label: t('overview_col_votes'), value: value.voter?.producers.length ?? 0 },
        { label: t('overview_col_proxy'), value: value.voter?.proxy || '—', mono: true },
      ];
  }
});
</script>

<template>
  <article class="bg-card rounded-lg border p-4">
    <div class="flex items-center justify-between gap-2">
      <RouterLink
        :to="`/account/${account}`"
        class="flex min-w-0 items-center gap-1 font-mono font-medium"
      >
        <span class="truncate">{{ account }}</span>
        <ChevronRight class="text-muted-foreground size-4 shrink-0" />
      </RouterLink>
      <Button
        variant="ghost"
        size="icon-sm"
        :title="data ? t('overview_updated', { ago }) : t('overview_loading')"
        :aria-label="t('overview_refresh')"
        :disabled="query.isFetching.value"
        @click="query.refetch()"
      >
        <RefreshCw class="size-4" :class="query.isFetching.value ? 'animate-spin' : ''" />
      </Button>
    </div>
    <p
      v-if="query.isError.value || (query.isSuccess.value && !data)"
      class="text-destructive mt-2 text-sm"
    >
      {{ query.isError.value ? t('overview_error') : t('overview_not_found') }}
      <span v-if="query.error.value" class="text-muted-foreground block font-mono text-xs">{{
        query.error.value.message
      }}</span>
    </p>
    <p v-else-if="!data" class="text-muted-foreground mt-2 text-sm">{{ t('overview_loading') }}</p>
    <p v-else-if="items.length === 0" class="text-muted-foreground mt-2 text-sm">
      {{ t('overview_no_balances') }}
    </p>
    <DataList v-else :items="items" class="mt-3" />
  </article>
</template>
