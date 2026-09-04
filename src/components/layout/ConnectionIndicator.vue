<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useChainInfo } from '@/composables/useChainData';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();
const info = useChainInfo(() => app.settings.chainId);

const state = computed<'ok' | 'error' | 'pending'>(() => {
  if (info.isError.value) return 'error';
  if (info.data.value) return 'ok';
  return 'pending';
});
const title = computed(() => {
  if (state.value === 'error') return t('connection_error');
  if (state.value === 'ok')
    return t('connection_ok', { block: info.data.value?.headBlockNum ?? '' });
  return t('connection_checking');
});
</script>

<template>
  <span
    v-if="app.settings.chainId"
    class="inline-flex size-8 shrink-0 items-center justify-center"
    :title="title"
    :aria-label="title"
    role="status"
  >
    <span
      class="size-2.5 rounded-full"
      :class="{
        'bg-positive': state === 'ok',
        'bg-destructive': state === 'error',
        'bg-muted-foreground animate-pulse': state === 'pending',
      }"
    />
  </span>
</template>
