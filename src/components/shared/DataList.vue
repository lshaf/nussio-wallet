<script setup lang="ts">
export interface DataListItem {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  tone?: 'default' | 'muted' | 'warning' | 'positive';
}

withDefaults(defineProps<{ items: DataListItem[]; size?: 'sm' | 'md' }>(), { size: 'md' });

const tones = {
  default: '',
  muted: 'text-muted-foreground',
  warning: 'text-warning',
  positive: 'text-positive',
} as const;
</script>

<template>
  <dl
    class="grid grid-cols-[auto_1fr] gap-x-4"
    :class="size === 'sm' ? 'gap-y-1 text-xs' : 'gap-y-1.5 text-sm'"
  >
    <template v-for="item in items" :key="item.label">
      <dt class="text-muted-foreground">{{ item.label }}</dt>
      <dd
        class="num text-right"
        :class="[item.mono ? 'font-mono' : '', tones[item.tone ?? 'default']]"
      >
        {{ item.value ?? '—' }}
      </dd>
    </template>
  </dl>
</template>
