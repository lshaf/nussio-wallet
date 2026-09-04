<script setup lang="ts">
import { computed } from 'vue';
import { percentage } from '@/lib/antelope/format';

const props = withDefaults(
  defineProps<{ used: number; max: number; warn?: boolean; label?: string }>(),
  { warn: false, label: undefined },
);
const percent = computed(() => Math.round(percentage(props.used, props.max)));
</script>

<template>
  <div
    class="gauge"
    :class="{ 'gauge-warn': warn }"
    role="meter"
    :aria-label="label"
    :aria-valuenow="percent"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div class="gauge-fill" :style="{ width: `${percent}%` }" />
    <div class="gauge-ticks" />
  </div>
</template>
