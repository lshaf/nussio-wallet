<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useTimeAgo } from '@vueuse/core';
import { Button } from '@/components/ui/button';
import { useSessionService, type LinkInfo } from '@/composables/useServices';
import { shortenKey } from '@/lib/antelope/format';
import { linkStatusItem } from '@/lib/storage/items';

const { t } = useTranslation('ext');
const service = useSessionService();
const info = ref<LinkInfo | null>(null);
const busy = ref(false);
let unwatch: (() => void) | undefined;

const lastMessage = useTimeAgo(() => info.value?.lastMessage ?? 0);

async function refresh(): Promise<void> {
  info.value = await service.status();
}

async function run(action: () => Promise<void>): Promise<void> {
  busy.value = true;
  try {
    await action();
  } finally {
    busy.value = false;
    await refresh();
  }
}

onMounted(async () => {
  await refresh();
  unwatch = linkStatusItem.watch(() => {
    void refresh();
  });
});
onBeforeUnmount(() => unwatch?.());
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="eyebrow">{{ t('settings_link_service') }}</h2>
    <div class="bg-card flex flex-col gap-3 rounded-lg border p-4 text-sm">
      <div class="flex items-center gap-2">
        <span
          class="size-2.5 rounded-full"
          :class="info?.connected ? 'bg-positive' : 'bg-destructive'"
        />
        <span class="font-medium">{{
          info?.connected ? t('link_connected') : t('link_disconnected')
        }}</span>
      </div>
      <p class="text-muted-foreground text-xs">{{ t('link_description') }}</p>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt class="text-muted-foreground">{{ t('link_id') }}</dt>
        <dd class="font-mono break-all">{{ info?.linkUrl }}/{{ info?.linkId ?? '—' }}</dd>
        <dt class="text-muted-foreground">{{ t('link_key') }}</dt>
        <dd class="font-mono" :title="info?.requestPublicKey ?? ''">
          {{ info?.requestPublicKey ? shortenKey(info.requestPublicKey, 12, 8) : '—' }}
        </dd>
        <dt class="text-muted-foreground">{{ t('link_last_message') }}</dt>
        <dd>{{ info?.lastMessage ? lastMessage : '—' }}</dd>
        <template v-if="info?.lastError">
          <dt class="text-muted-foreground">{{ t('link_last_error') }}</dt>
          <dd class="text-destructive font-mono break-all">{{ info.lastError }}</dd>
        </template>
      </dl>
      <div class="flex flex-wrap gap-2">
        <Button
          v-if="!info?.connected"
          size="sm"
          variant="outline"
          :disabled="busy"
          @click="run(() => service.connect())"
          >{{ t('link_connect') }}</Button
        >
        <Button
          v-else
          size="sm"
          variant="outline"
          :disabled="busy"
          @click="run(() => service.disconnect())"
          >{{ t('link_disconnect') }}</Button
        >
        <Button
          size="sm"
          variant="outline"
          :disabled="busy"
          @click="run(() => service.restart())"
          >{{ t('link_restart') }}</Button
        >
        <Button
          size="sm"
          variant="ghost"
          :disabled="busy"
          :title="t('link_reset_key_description')"
          @click="run(() => service.resetKey())"
          >{{ t('link_reset_key') }}</Button
        >
      </div>
    </div>
  </section>
</template>
