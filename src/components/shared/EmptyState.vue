<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <div
    class="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center"
  >
    <slot name="icon" />
    <p class="font-medium">{{ title }}</p>
    <p v-if="description" class="text-muted-foreground max-w-sm text-sm">{{ description }}</p>
    <div v-if="$slots.default" class="mt-1 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
