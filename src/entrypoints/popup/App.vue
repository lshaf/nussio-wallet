<script setup lang="ts">
import { onMounted } from 'vue';
import { browser } from 'wxt/browser';
import { useAppStore } from '@/stores/app.store';

const app = useAppStore();

async function openWallet(): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL('/app.html') });
  window.close();
}

onMounted(() => {
  void app.refresh();
});
</script>

<template>
  <main class="flex w-80 flex-col gap-4 p-4">
    <header class="flex items-center justify-between">
      <h1 class="text-lg font-semibold">Anchor</h1>
      <span class="text-muted-foreground text-xs">
        {{ app.status.initialized ? (app.status.unlocked ? 'unlocked' : 'locked') : 'not set up' }}
      </span>
    </header>
    <button
      type="button"
      class="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium"
      @click="openWallet"
    >
      Open wallet
    </button>
    <button
      v-if="app.status.unlocked"
      type="button"
      class="bg-secondary text-secondary-foreground rounded-md px-3 py-2 text-sm font-medium"
      @click="app.lock()"
    >
      Lock
    </button>
  </main>
</template>
