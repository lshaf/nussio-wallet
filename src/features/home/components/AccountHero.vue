<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import { RefreshCw } from 'lucide-vue-next';
import { useTimeAgo } from '@vueuse/core';
import Amount from '@/components/shared/Amount.vue';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/antelope/format';
import type { Blockchain } from '@/lib/storage/schemas';
import { useAccountOverview } from '../composables/useAccountOverview';
import ResourceStrip from './ResourceStrip.vue';

const props = withDefaults(
  defineProps<{ chain?: Blockchain; account?: string; usd?: number; compact?: boolean }>(),
  { chain: undefined, account: undefined, usd: undefined, compact: false },
);

const { t } = useTranslation('ext');
const overview = useAccountOverview(
  () => props.chain,
  () => props.account,
);
const data = overview.data;
const ago = useTimeAgo(computed(() => data.value?.fetchedAt ?? 0));

const chips = computed(() => {
  if (!props.chain) return [];
  const list: { key: string; label: string; value: string }[] = [
    { key: 'total', label: t('hero_total'), value: overview.money(overview.total.value) },
  ];
  if (props.usd !== undefined)
    list.push({
      key: 'usd',
      label: 'USD',
      value: `$${formatNumber(overview.total.value * props.usd, 2)}`,
    });
  if (props.chain.stakedResources)
    list.push({
      key: 'staked',
      label: t('hero_staked'),
      value: overview.money(overview.staked.value),
    });
  if (props.chain.features.includes('rex') && overview.rex.value > 0)
    list.push({ key: 'rex', label: 'REX', value: overview.money(overview.rex.value) });
  return list;
});
</script>

<template>
  <section
    class="bg-card relative overflow-hidden rounded-xl border"
    :class="compact ? 'p-4' : 'p-5 md:p-6'"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="eyebrow">{{ t('hero_available') }}</p>
        <div v-if="data" class="rise-in mt-1.5">
          <Amount :value="data.balance" :size="compact ? 'lg' : 'hero'" />
        </div>
        <div
          v-else-if="overview.query.isError.value || overview.query.isSuccess.value"
          class="text-destructive mt-2 text-sm"
        >
          {{ overview.query.isError.value ? t('overview_error') : t('overview_not_found') }}
          <span
            v-if="overview.query.error.value"
            class="text-muted-foreground block font-mono text-xs"
            >{{ overview.query.error.value.message }}</span
          >
        </div>
        <div v-else class="bg-muted mt-2 h-9 w-48 animate-pulse rounded" />
      </div>
      <Button
        v-if="data"
        variant="ghost"
        size="icon-sm"
        :title="t('overview_updated', { ago })"
        :aria-label="t('overview_refresh')"
        :disabled="overview.query.isFetching.value"
        @click="overview.query.refetch()"
      >
        <RefreshCw class="size-4" :class="overview.query.isFetching.value ? 'animate-spin' : ''" />
      </Button>
    </div>

    <dl v-if="data && chips.length > 0" class="mt-4 flex flex-wrap gap-x-5 gap-y-2">
      <div v-for="chip in chips" :key="chip.key" class="flex flex-col">
        <dt class="eyebrow">{{ chip.label }}</dt>
        <dd class="num text-sm font-medium">{{ chip.value }}</dd>
      </div>
    </dl>

    <div v-if="data && chain?.stakedResources" class="mt-5 border-t pt-4">
      <ResourceStrip :data="data" />
    </div>
  </section>
</template>
