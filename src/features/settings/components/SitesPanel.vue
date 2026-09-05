<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useTimeAgo } from '@vueuse/core';
import { Trash2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { useProviderService } from '@/composables/useServices';
import { chainLogo } from '@/lib/antelope/logos';
import { connectedSitesItem } from '@/lib/storage/items';
import type { ConnectedSite } from '@/lib/storage/schemas';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();
const service = useProviderService();
const sites = ref<ConnectedSite[]>([]);
let unwatch: (() => void) | undefined;

const rows = computed(() =>
  sites.value
    .map((site) => ({
      ...site,
      host: site.origin.replace(/^https?:\/\//, ''),
      chain: app.chains.find((chain) => chain.chainId === site.chainId),
      ago: useTimeAgo(site.lastUsedAt),
    }))
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt),
);

onMounted(async () => {
  sites.value = await service.listSites();
  unwatch = connectedSitesItem.watch((value) => {
    sites.value = value;
  });
});
onBeforeUnmount(() => unwatch?.());
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <h2 class="eyebrow">{{ t('settings_sites') }}</h2>
      <Button v-if="sites.length > 1" variant="ghost" size="sm" @click="service.revokeAll()">{{
        t('sites_remove_all')
      }}</Button>
    </div>
    <p
      v-if="sites.length === 0"
      class="bg-card text-muted-foreground rounded-lg border px-4 py-3 text-sm"
    >
      {{ t('sites_empty') }}
    </p>
    <ul v-else class="bg-card divide-y rounded-lg border">
      <li
        v-for="row in rows"
        :key="row.origin"
        class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
      >
        <img
          v-if="row.chain && chainLogo(row.chain.id)"
          :src="chainLogo(row.chain.id)"
          class="size-6 rounded-full"
          alt=""
        />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="truncate font-medium">{{ row.host }}</span>
          <span class="text-muted-foreground font-mono text-xs"
            >{{ row.actor }}@{{ row.permission }}
            <span v-if="row.chain" class="font-sans">· {{ row.chain.name }}</span></span
          >
        </div>
        <span class="text-muted-foreground text-xs">{{
          t('sites_last_used', { ago: row.ago.value })
        }}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          :aria-label="t('sites_disconnect')"
          @click="service.revoke(row.origin)"
        >
          <Trash2 />
        </Button>
      </li>
    </ul>
  </section>
</template>
