<script setup lang="ts">
import type { DecodedAction } from '@/lib/antelope/transaction';

defineProps<{ actions: DecodedAction[] }>();

function display(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
</script>

<template>
  <ol class="flex flex-col gap-2">
    <li
      v-for="(action, index) in actions"
      :key="`${index}-${action.account}-${action.name}`"
      class="bg-card rounded-lg border p-3"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="font-mono text-sm font-medium">{{ action.account }}::{{ action.name }}</span>
        <span class="flex flex-wrap gap-1">
          <span
            v-for="auth in action.authorization"
            :key="`${auth.actor}@${auth.permission}`"
            class="bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-mono text-[11px]"
            >{{ auth.actor }}@{{ auth.permission }}</span
          >
        </span>
      </div>
      <dl
        v-if="Object.keys(action.data).length > 0"
        class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs"
      >
        <template v-for="(value, key) in action.data" :key="key">
          <dt class="text-muted-foreground font-mono">{{ key }}</dt>
          <dd class="font-mono break-all">{{ display(value) }}</dd>
        </template>
      </dl>
      <p v-else class="text-muted-foreground mt-2 font-mono text-xs break-all">{{ action.hex }}</p>
    </li>
  </ol>
</template>
