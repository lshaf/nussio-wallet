<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useTimeAgo } from '@vueuse/core';
import { Trash2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { useSessionService } from '@/composables/useServices';
import { chainLogo } from '@/lib/antelope/logos';
import { sessionsItem } from '@/lib/storage/items';
import type { Session } from '@/lib/storage/schemas';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();
const service = useSessionService();
const sessions = ref<Session[]>([]);
let unwatch: (() => void) | undefined;

const rows = computed(() =>
  sessions.value
    .map((session) => ({
      ...session,
      chain: app.chains.find((chain) => chain.chainId === session.network),
      ago: useTimeAgo(session.lastUsed),
    }))
    .sort((a, b) => b.lastUsed - a.lastUsed),
);

onMounted(async () => {
  sessions.value = await service.list();
  unwatch = sessionsItem.watch((state) => {
    sessions.value = state.sessions;
  });
});
onBeforeUnmount(() => unwatch?.());
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <h2 class="eyebrow">{{ t('settings_sessions') }}</h2>
      <Button v-if="sessions.length > 1" variant="ghost" size="sm" @click="service.clear()">{{
        t('sessions_remove_all')
      }}</Button>
    </div>
    <p
      v-if="sessions.length === 0"
      class="bg-card text-muted-foreground rounded-lg border px-4 py-3 text-sm"
    >
      {{ t('sessions_empty') }}
    </p>
    <ul v-else class="bg-card divide-y rounded-lg border">
      <li
        v-for="row in rows"
        :key="`${row.network}-${row.actor}-${row.permission}-${row.name}`"
        class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
      >
        <img
          v-if="row.chain && chainLogo(row.chain.id)"
          :src="chainLogo(row.chain.id)"
          class="size-6 rounded-full"
          alt=""
        />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="font-medium">{{ row.name }}</span>
          <span class="text-muted-foreground font-mono text-xs"
            >{{ row.actor }}@{{ row.permission }}
            <span v-if="row.chain" class="font-sans">· {{ row.chain.name }}</span></span
          >
        </div>
        <span class="text-muted-foreground text-xs">{{
          t('sessions_last_used', { ago: row.ago.value })
        }}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          :aria-label="t('action_remove')"
          @click="service.remove(row)"
        >
          <Trash2 />
        </Button>
      </li>
    </ul>
  </section>
</template>
