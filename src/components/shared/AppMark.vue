<script setup lang="ts">
import { browser } from 'wxt/browser';
import { useTranslation } from 'i18next-vue';

withDefaults(defineProps<{ size?: 'sm' | 'control' | 'md' | 'lg'; wordmark?: boolean }>(), {
  size: 'md',
  wordmark: true,
});

const { t } = useTranslation('ext');
const icon = browser.runtime.getURL('/icon/icon.svg');
const sizes = { sm: 'size-6', control: 'size-9', md: 'size-8', lg: 'size-12' } as const;
const text = { sm: 'text-sm', control: 'text-base', md: 'text-base', lg: 'text-xl' } as const;
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <img :src="icon" :class="sizes[size]" alt="" />
    <span v-if="wordmark" class="font-semibold tracking-tight" :class="text[size]">{{
      t('app_name')
    }}</span>
  </span>
</template>
