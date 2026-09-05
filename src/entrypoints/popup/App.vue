<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { useTranslation } from 'i18next-vue';
import { ExternalLink, Gauge, Lock, LockOpen, SendHorizontal } from 'lucide-vue-next';
import AppMark from '@/components/shared/AppMark.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ChainSwitcher from '@/components/layout/ChainSwitcher.vue';
import AccountSwitcher from '@/components/layout/AccountSwitcher.vue';
import ConnectionIndicator from '@/components/layout/ConnectionIndicator.vue';
import AccountHero from '@/features/home/components/AccountHero.vue';
import PendingRequests from '@/features/transactions/components/PendingRequests.vue';
import { usePriceFeed } from '@/composables/useChainData';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();
const password = ref('');
const unlocking = ref(false);
const failed = ref(false);
const feed = usePriceFeed(() => app.settings.chainId);
const usd = computed(() => feed.data.value?.usd);

async function open(path: string): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL(`/app.html#${path}`) });
  window.close();
}

async function unlock(): Promise<void> {
  failed.value = !(await app.unlock(password.value));
  if (!failed.value) {
    unlocking.value = false;
    password.value = '';
  }
}

onMounted(() => {
  void app.ready();
});
</script>

<template>
  <main class="flex flex-col gap-3 p-4">
    <header class="flex items-center justify-between">
      <AppMark size="sm" />
      <div class="flex items-center gap-1">
        <ConnectionIndicator />
        <Button
          v-if="app.status.initialized"
          variant="ghost"
          size="sm"
          :aria-label="app.status.unlocked ? t('action_lock') : t('action_unlock')"
          @click="app.status.unlocked ? app.lock() : (unlocking = !unlocking)"
        >
          <LockOpen v-if="app.status.unlocked" class="text-positive" />
          <Lock v-else class="text-muted-foreground" />
          {{ app.status.unlocked ? t('status_unlocked') : t('status_locked') }}
        </Button>
      </div>
    </header>

    <form
      v-if="unlocking && !app.status.unlocked"
      class="bg-card rise-in flex flex-col gap-2 rounded-lg border p-3"
      @submit.prevent="unlock"
    >
      <label for="popup-password" class="eyebrow">{{ t('password_label') }}</label>
      <Input
        id="popup-password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        autofocus
      />
      <p v-if="failed" class="text-destructive text-xs">{{ t('unlock_failed') }}</p>
      <div class="flex gap-2">
        <Button type="button" variant="ghost" size="sm" class="flex-1" @click="unlocking = false">{{
          t('action_cancel')
        }}</Button>
        <Button type="submit" size="sm" class="flex-1" :disabled="password.length === 0">{{
          t('action_unlock')
        }}</Button>
      </div>
    </form>

    <template v-if="app.setupRoute === null">
      <PendingRequests />
      <div class="flex flex-col gap-2">
        <ChainSwitcher class="w-full" />
        <AccountSwitcher />
      </div>
      <AccountHero
        :chain="app.currentChain"
        :account="app.currentWallet?.account"
        :usd="usd"
        compact
      />
      <div class="grid grid-cols-2 gap-2">
        <Button
          v-if="app.currentWallet"
          variant="outline"
          size="sm"
          :class="app.currentChain?.stakedResources ? '' : 'col-span-2'"
          @click="open('/send')"
        >
          <SendHorizontal />
          {{ t('nav_send') }}
        </Button>
        <Button
          v-if="app.currentChain?.stakedResources && app.currentWallet"
          variant="outline"
          size="sm"
          @click="open(`/account/${app.currentWallet.account}`)"
        >
          <Gauge />
          {{ t('nav_resources') }}
        </Button>
        <Button size="sm" class="col-span-2" @click="open('/')">
          <ExternalLink />
          {{ t('action_open_wallet') }}
        </Button>
      </div>
    </template>

    <div v-else class="flex flex-col gap-3">
      <div class="bg-card rounded-lg border p-4">
        <p class="font-medium">{{ t('setup_welcome_title') }}</p>
        <p class="text-muted-foreground mt-1 text-sm">{{ t('popup_finish_setup') }}</p>
      </div>
      <Button size="sm" @click="open('/setup')">
        <ExternalLink />
        {{ t('setup_welcome_start') }}
      </Button>
    </div>
  </main>
</template>
