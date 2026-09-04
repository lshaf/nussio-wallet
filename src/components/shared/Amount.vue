<script setup lang="ts">
import { computed } from 'vue';
import { formatNumber, parseAsset } from '@/lib/antelope/format';

const props = withDefaults(
  defineProps<{
    value: string | number;
    symbol?: string;
    precision?: number;
    size?: 'hero' | 'lg' | 'md' | 'sm';
  }>(),
  { symbol: undefined, precision: undefined, size: 'md' },
);

const parsed = computed(() => {
  if (typeof props.value === 'number') {
    return { amount: props.value, symbol: props.symbol ?? '', precision: props.precision ?? 4 };
  }
  const asset = parseAsset(props.value);
  return {
    amount: asset.amount,
    symbol: props.symbol ?? asset.symbol,
    precision: props.precision ?? asset.precision,
  };
});

const parts = computed(() => {
  const [whole = '0', fraction] = formatNumber(parsed.value.amount, parsed.value.precision).split(
    '.',
  );
  return { whole, fraction };
});

const classes = {
  hero: {
    wrap: 'display-num text-3xl font-semibold leading-none md:text-4xl',
    fraction: 'text-xl md:text-2xl',
    symbol: 'text-sm md:text-base',
  },
  lg: {
    wrap: 'display-num text-2xl font-semibold leading-none',
    fraction: 'text-lg',
    symbol: 'text-sm',
  },
  md: { wrap: 'num text-base font-medium', fraction: 'text-base', symbol: 'text-xs' },
  sm: { wrap: 'num text-sm', fraction: 'text-sm', symbol: 'text-[11px]' },
} as const;
</script>

<template>
  <span class="inline-flex max-w-full flex-wrap items-baseline gap-x-1" :class="classes[size].wrap">
    <span>{{ parts.whole }}</span>
    <span class="inline-flex items-baseline gap-x-1">
      <span
        v-if="parts.fraction"
        class="text-muted-foreground font-normal"
        :class="classes[size].fraction"
        >.{{ parts.fraction }}</span
      >
      <span v-if="parsed.symbol" class="eyebrow" :class="classes[size].symbol">{{
        parsed.symbol
      }}</span>
    </span>
  </span>
</template>
