<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Play, Square, Wifi } from 'lucide-vue-next';
import EmptyState from '@/components/shared/EmptyState.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useChainService, usePingService, type PingResult } from '@/composables/useServices';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();
const service = usePingService();
const chainService = useChainService();

const results = ref<PingResult[]>([]);
const running = ref(false);
const progress = ref({ done: 0, total: 0 });
const error = ref('');
let cancelled = false;

const ranked = computed(() =>
  [...results.value].sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    return (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity);
  }),
);

async function start(): Promise<void> {
  const chainId = app.settings.chainId;
  if (!chainId) return;
  cancelled = false;
  running.value = true;
  error.value = '';
  results.value = [];
  try {
    const endpoints = await service.listEndpoints(chainId);
    progress.value = { done: 0, total: endpoints.length };
    if (endpoints.length === 0) {
      error.value = t('ping_none');
      return;
    }
    for (const endpoint of endpoints) {
      if (cancelled) break;
      const result = await service.ping(chainId, endpoint.url);
      results.value = [...results.value, result];
      progress.value = { ...progress.value, done: progress.value.done + 1 };
    }
  } catch {
    error.value = t('ping_error');
  } finally {
    running.value = false;
  }
}

function stop(): void {
  cancelled = true;
}

async function useEndpoint(url: string): Promise<void> {
  const chain = app.currentChain;
  if (!chain) return;
  await chainService.setNode(chain.chainId, url);
  await app.load();
}
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-5 md:gap-6">
    <PageHeader :title="t('ping_title')" :eyebrow="app.currentChain?.name" />

    <div class="bg-card flex flex-col gap-3 rounded-lg border p-4">
      <p class="text-muted-foreground text-sm">{{ t('ping_description') }}</p>
      <p class="text-muted-foreground text-xs">{{ t('ping_privacy') }}</p>
      <div class="flex flex-wrap items-center gap-2">
        <Button v-if="!running" size="sm" @click="start">
          <Play />
          {{ t('ping_start') }}
        </Button>
        <Button v-else size="sm" variant="outline" @click="stop">
          <Square />
          {{ t('ping_stop') }}
        </Button>
        <span v-if="progress.total > 0" class="text-muted-foreground num text-xs">
          {{ t('ping_progress', { done: progress.done, total: progress.total }) }}
        </span>
      </div>
      <p v-if="error" class="text-muted-foreground text-sm">{{ error }}</p>
    </div>

    <EmptyState v-if="!running && results.length === 0 && !error" :title="t('ping_idle')">
      <template #icon><Wifi class="text-muted-foreground size-6" /></template>
    </EmptyState>

    <div v-if="ranked.length > 0" class="bg-card divide-y rounded-lg border">
      <div
        v-for="result in ranked"
        :key="result.url"
        class="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
      >
        <span class="min-w-0 flex-1 truncate font-mono text-xs">{{ result.url }}</span>
        <Badge v-if="!result.ok" variant="destructive">{{ t('ping_failed') }}</Badge>
        <span v-else class="num text-xs">{{ result.latencyMs }} ms</span>
        <Button
          v-if="result.ok && app.currentChain?.node !== result.url"
          variant="outline"
          size="sm"
          @click="useEndpoint(result.url)"
          >{{ t('ping_use') }}</Button
        >
        <Badge v-else-if="result.ok" variant="secondary">{{ t('ping_current') }}</Badge>
      </div>
    </div>
  </div>
</template>
