<script setup lang="ts">
import { browser } from 'wxt/browser';

withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; wordmark?: boolean }>(), {
  size: 'md',
  wordmark: true,
});

const icon = browser.runtime.getURL('/icon/128.png');
const sizes = { sm: 'size-6', md: 'size-8', lg: 'size-12' } as const;
const text = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' } as const;
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <img :src="icon" :class="sizes[size]" alt="" />
    <span v-if="wordmark" class="font-semibold tracking-tight" :class="text[size]">Anchor</span>
  </span>
</template>
