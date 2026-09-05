<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useTimeAgo } from '@vueuse/core';
import { Database, Trash2 } from 'lucide-vue-next';
import EmptyState from '@/components/shared/EmptyState.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Button } from '@/components/ui/button';
import { useContractService, type AbiCacheEntryInfo } from '@/composables/useServices';

const { t } = useTranslation('ext');
const service = useContractService();
const entries = ref<AbiCacheEntryInfo[]>([]);

async function refresh(): Promise<void> {
  entries.value = (await service.listAbiCache()).sort((a, b) => b.fetchedAt - a.fetchedAt);
}

async function clear(): Promise<void> {
  await service.clearAbiCache();
  await refresh();
}

onMounted(refresh);
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-5 md:gap-6">
    <PageHeader :title="t('abis_title')">
      <template #meta>
        <span class="text-muted-foreground num text-sm">{{
          t('abis_count', { count: entries.length })
        }}</span>
      </template>
      <template #actions>
        <Button variant="outline" size="sm" :disabled="entries.length === 0" @click="clear">
          <Trash2 />
          {{ t('abis_clear') }}
        </Button>
      </template>
    </PageHeader>

    <p class="text-muted-foreground text-sm">{{ t('abis_description') }}</p>

    <EmptyState v-if="entries.length === 0" :title="t('abis_empty')">
      <template #icon><Database class="text-muted-foreground size-6" /></template>
    </EmptyState>
    <div v-else class="bg-card divide-y rounded-lg border">
      <div
        v-for="entry in entries"
        :key="entry.key"
        class="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
      >
        <span class="font-mono">{{ entry.contract }}</span>
        <span class="text-muted-foreground text-xs">{{ entry.chainName }}</span>
        <span class="text-muted-foreground ml-auto text-xs">{{
          useTimeAgo(new Date(entry.fetchedAt)).value
        }}</span>
      </div>
    </div>
  </div>
</template>
