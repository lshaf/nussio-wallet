<script setup lang="ts">
defineProps<{ title: string; eyebrow?: string }>();
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
    <div class="flex min-w-0 flex-col gap-1">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>
        <slot name="meta" />
      </div>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
