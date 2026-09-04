<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import DataList from '@/components/shared/DataList.vue';
import ResourceGauge from '@/components/shared/ResourceGauge.vue';
import { Button } from '@/components/ui/button';
import { useRamPrice } from '@/composables/useChainData';
import { formatBytes, formatNumber, percentage } from '@/lib/antelope/format';
import type { AccountData } from '@/services/account.service';
import { useAppStore } from '@/stores/app.store';

const props = defineProps<{ data: AccountData }>();
const { t } = useTranslation('ext');
const app = useAppStore();
const price = useRamPrice(() => app.settings.chainId);

const free = computed(() => Math.max(0, props.data.ram.quota - props.data.ram.used));
const showAvailable = computed(() => app.settings.displayResourcesAvailable);
const low = computed(
  () => props.data.ram.quota > 0 && percentage(free.value, props.data.ram.quota) < 10,
);
const value = computed(() => {
  const feed = price.data.value;
  if (!feed) return null;
  return `${formatNumber(props.data.ram.quota * feed.pricePerByte, feed.precision)} ${feed.symbol}`;
});
const perKb = computed(() => {
  const feed = price.data.value;
  if (!feed) return null;
  return `${formatNumber(feed.pricePerByte * 1024, Math.max(feed.precision, 6))} ${feed.symbol}`;
});
</script>

<template>
  <section class="bg-card flex flex-col gap-4 rounded-xl border p-4 md:p-5">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="eyebrow text-foreground">RAM</h2>
      <span v-if="low" class="text-warning text-xs font-medium">{{
        t('resources_status_ram_low')
      }}</span>
    </div>
    <div class="grid gap-5 md:grid-cols-2">
      <div>
        <p class="eyebrow">{{ showAvailable ? t('resources_available') : t('resources_used') }}</p>
        <p class="display-num mt-1 text-3xl font-semibold leading-none">
          {{ formatBytes(showAvailable ? free : data.ram.used) }}
        </p>
        <ResourceGauge
          :used="showAvailable ? free : data.ram.used"
          :max="data.ram.quota"
          :warn="low"
          class="mt-3"
          label="RAM"
        />
        <DataList
          class="mt-2"
          size="sm"
          :items="[
            { label: t('resources_used'), value: formatBytes(data.ram.used) },
            { label: t('resources_ram_quota'), value: formatBytes(data.ram.quota) },
          ]"
        />
      </div>
      <div class="flex flex-col justify-between gap-4">
        <DataList
          :items="[
            { label: t('resources_ram_value'), value },
            { label: t('resources_ram_price'), value: perKb },
          ]"
        />
        <div class="flex gap-2">
          <Button size="sm" variant="outline" disabled>{{ t('resources_action_buy') }}</Button>
          <Button size="sm" variant="outline" disabled>{{ t('resources_action_sell') }}</Button>
        </div>
      </div>
    </div>
  </section>
</template>
