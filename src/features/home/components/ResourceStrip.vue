<script setup lang="ts">
import { computed } from 'vue';
import ResourceGauge from '@/components/shared/ResourceGauge.vue';
import { formatBytes, formatMicroseconds, percentage } from '@/lib/antelope/format';
import type { AccountData } from '@/services/account.service';

const props = defineProps<{ data: AccountData }>();

const rows = computed(() => {
  const ramFree = Math.max(0, props.data.ram.quota - props.data.ram.used);
  return [
    {
      key: 'cpu',
      label: 'CPU',
      used: props.data.cpu.available,
      max: props.data.cpu.max,
      text: formatMicroseconds(props.data.cpu.available),
    },
    {
      key: 'net',
      label: 'NET',
      used: props.data.net.available,
      max: props.data.net.max,
      text: formatBytes(props.data.net.available),
    },
    {
      key: 'ram',
      label: 'RAM',
      used: ramFree,
      max: props.data.ram.quota,
      text: formatBytes(ramFree),
    },
  ].map((row) => ({ ...row, warn: row.max > 0 && percentage(row.used, row.max) < 10 }));
});
</script>

<template>
  <div class="grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-3 gap-y-2">
    <template v-for="row in rows" :key="row.key">
      <span class="eyebrow">{{ row.label }}</span>
      <ResourceGauge :used="row.used" :max="row.max" :warn="row.warn" :label="row.label" />
      <span class="num text-xs" :class="row.warn ? 'text-warning' : 'text-muted-foreground'">{{
        row.text
      }}</span>
    </template>
  </div>
</template>
