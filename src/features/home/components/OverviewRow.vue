<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { useTimeAgo } from '@vueuse/core';
import { RefreshCw } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
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
const { query, data, liquid, staked, delegated, refunding, rex, total, effectiveness, voteValue } =
  overview;
const ago = useTimeAgo(computed(() => data.value?.fetchedAt ?? 0));
</script>

<template>
  <TableRow>
    <TableCell>
      <div class="flex items-center gap-2">
        <RouterLink :to="`/account/${account}`" class="font-mono font-medium hover:underline">{{
          account
        }}</RouterLink>
        <Button
          variant="ghost"
          size="icon-xs"
          :title="data ? t('overview_updated', { ago }) : t('overview_loading')"
          :aria-label="t('overview_refresh')"
          :disabled="query.isFetching.value"
          @click="query.refetch()"
        >
          <RefreshCw :class="query.isFetching.value ? 'animate-spin' : ''" />
        </Button>
      </div>
    </TableCell>

    <template v-if="query.isError.value || (query.isSuccess.value && !data)">
      <TableCell :colspan="8" class="text-destructive text-sm">
        {{ query.isError.value ? t('overview_error') : t('overview_not_found') }}
        <span v-if="query.error.value" class="text-muted-foreground ml-2 font-mono text-xs">{{
          query.error.value.message
        }}</span>
      </TableCell>
    </template>
    <template v-else-if="!data">
      <TableCell :colspan="8" class="text-muted-foreground text-sm">{{
        t('overview_loading')
      }}</TableCell>
    </template>

    <template v-else-if="tab === 'systemtokens'">
      <TableCell class="num text-right">{{ overview.money(total) }}</TableCell>
      <TableCell class="num text-right">{{ overview.money(liquid) }}</TableCell>
      <TableCell v-if="usd !== undefined" class="num text-right"
        >${{ formatNumber(total * usd, 2) }}</TableCell
      >
      <template v-if="chain.stakedResources">
        <TableCell class="num text-right">{{ overview.money(staked) }}</TableCell>
        <TableCell v-if="chain.features.includes('rex')" class="num text-right">{{
          overview.money(rex)
        }}</TableCell>
        <TableCell class="num text-right">{{ overview.money(delegated) }}</TableCell>
        <TableCell class="num text-right">{{ overview.money(refunding) }}</TableCell>
      </template>
    </template>

    <template v-else-if="tab === 'balances'">
      <TableCell>
        <div
          v-if="overview.nonZeroBalances.value.length > 0"
          class="num flex flex-wrap gap-x-4 gap-y-1 text-sm"
        >
          <span
            v-for="balance in overview.nonZeroBalances.value"
            :key="`${balance.contract}:${balance.symbol}`"
            >{{ balance.amount }}</span
          >
        </div>
        <span v-else class="text-muted-foreground text-sm">{{ t('overview_no_balances') }}</span>
      </TableCell>
    </template>

    <template v-else-if="tab === 'resources'">
      <TableCell class="num text-right">{{ formatMicroseconds(data.cpu.available) }}</TableCell>
      <TableCell class="num text-right">{{ formatBytes(data.net.available) }}</TableCell>
      <TableCell class="num text-right">{{
        formatBytes(Math.max(0, data.ram.quota - data.ram.used))
      }}</TableCell>
    </template>

    <template v-else>
      <TableCell class="num text-right">{{
        formatNumber(voteValue, chain.tokenPrecision)
      }}</TableCell>
      <TableCell class="num text-right">{{
        effectiveness === undefined ? '—' : `${formatNumber(effectiveness, 2)} %`
      }}</TableCell>
      <TableCell class="num text-right" :title="data.voter?.producers.join(', ')">{{
        data.voter?.producers.length ?? 0
      }}</TableCell>
      <TableCell class="font-mono">{{ data.voter?.proxy || '—' }}</TableCell>
    </template>
  </TableRow>
</template>
