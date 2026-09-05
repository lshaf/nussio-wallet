<script setup lang="ts">
import { ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Lock, LockOpen } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import AppMark from '@/components/shared/AppMark.vue';
import ChainSwitcher from './ChainSwitcher.vue';
import AccountSwitcher from './AccountSwitcher.vue';
import ConnectionIndicator from './ConnectionIndicator.vue';
import UnlockDialog from '@/components/dialogs/UnlockDialog.vue';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();
const unlockOpen = ref(false);
</script>

<template>
  <header
    class="bg-background/90 sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b px-4 py-2 backdrop-blur md:h-16 md:flex-nowrap md:px-6"
  >
    <AppMark size="control" :wordmark="false" class="shrink-0 md:hidden" />
    <ChainSwitcher compact class="md:hidden" />
    <ChainSwitcher class="hidden md:block" />
    <AccountSwitcher
      class="order-last basis-full md:order-none md:max-w-72 md:flex-1 md:basis-auto"
    />
    <ConnectionIndicator />
    <div class="flex-1 md:hidden" />
    <Button
      v-if="app.status.initialized"
      variant="outline"
      size="sm"
      class="md:ml-auto"
      :aria-label="app.status.unlocked ? t('action_lock') : t('action_unlock')"
      @click="app.status.unlocked ? app.lock() : (unlockOpen = true)"
    >
      <LockOpen v-if="app.status.unlocked" />
      <Lock v-else />
      <span class="hidden md:inline">{{
        app.status.unlocked ? t('action_lock') : t('action_unlock')
      }}</span>
    </Button>
    <UnlockDialog v-model:open="unlockOpen" />
  </header>
</template>
