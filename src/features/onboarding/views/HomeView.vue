<script setup lang="ts">
import { onMounted } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('global');
const app = useAppStore();

onMounted(() => {
  void app.refresh();
});
</script>

<template>
  <main class="mx-auto flex max-w-3xl flex-col gap-6 p-8">
    <h1 class="text-2xl font-semibold">Anchor Wallet</h1>
    <p class="text-muted-foreground">
      {{
        app.status.initialized
          ? app.status.unlocked
            ? 'Wallet unlocked'
            : t('global_button_unlock', 'Unlock')
          : 'Set up a password to begin'
      }}
    </p>
  </main>
</template>
