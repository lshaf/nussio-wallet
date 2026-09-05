<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useClipboard } from '@vueuse/core';
import { Check, Copy, RefreshCw, Trash2, UserCheck } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  usePendingService,
  type PendingAccount,
  type PendingAccountStatus,
} from '@/composables/useServices';
import { useAppStore } from '@/stores/app.store';

const POLL_MS = 5000;

const { t } = useTranslation('ext');
const app = useAppStore();
const service = usePendingService();
const { copy, copied } = useClipboard();

const accounts = ref<PendingAccount[]>([]);
const statuses = ref<Record<string, PendingAccountStatus>>({});
const checking = ref('');
let timer: ReturnType<typeof setInterval> | undefined;

function keyFor(entry: PendingAccount): string {
  return `${entry.chainId}:${entry.account}`;
}

function chainName(chainId: string): string {
  return app.chains.find((chain) => chain.chainId === chainId)?.name ?? chainId.slice(0, 8);
}

function shareUrl(entry: PendingAccount): string {
  return `https://wallet.greymass.com/request/${entry.request.replace(/^esr:\/\//, '')}`;
}

async function refresh(): Promise<void> {
  accounts.value = await service.list();
}

async function check(entry: PendingAccount): Promise<void> {
  checking.value = keyFor(entry);
  try {
    statuses.value = {
      ...statuses.value,
      [keyFor(entry)]: await service.status(entry.chainId, entry.account),
    };
  } finally {
    checking.value = '';
  }
}

async function claim(entry: PendingAccount): Promise<void> {
  await service.claim(entry.chainId, entry.account);
  await refresh();
  await app.load();
}

async function remove(entry: PendingAccount): Promise<void> {
  accounts.value = await service.remove(entry.chainId, entry.account);
}

async function poll(): Promise<void> {
  const next = accounts.value.find((entry) => statuses.value[keyFor(entry)] !== 'ready');
  if (next) await check(next);
}

onMounted(async () => {
  await refresh();
  timer = setInterval(() => void poll(), POLL_MS);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

defineExpose({ refresh });
</script>

<template>
  <section v-if="accounts.length > 0" class="flex flex-col gap-3">
    <h2 class="eyebrow">{{ t('pending_accounts_title') }}</h2>
    <div class="bg-card divide-y rounded-lg border">
      <div v-for="entry in accounts" :key="keyFor(entry)" class="flex flex-col gap-3 px-4 py-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-sm font-medium">{{ entry.account }}</span>
          <span class="text-muted-foreground text-xs">{{ chainName(entry.chainId) }}</span>
          <Badge
            :variant="statuses[keyFor(entry)] === 'ready' ? 'secondary' : 'outline'"
            class="ml-auto"
            >{{ t(`pending_account_${statuses[keyFor(entry)] ?? 'awaiting'}`) }}</Badge
          >
        </div>
        <p class="text-muted-foreground text-xs">{{ t('pending_accounts_hint') }}</p>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" @click="copy(shareUrl(entry))">
            <Check v-if="copied" />
            <Copy v-else />
            {{ copied ? t('action_copied') : t('pending_copy_url') }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="checking === keyFor(entry)"
            @click="check(entry)"
          >
            <RefreshCw :class="checking === keyFor(entry) ? 'animate-spin' : ''" />
            {{ t('pending_check') }}
          </Button>
          <Button size="sm" :disabled="statuses[keyFor(entry)] !== 'ready'" @click="claim(entry)">
            <UserCheck />
            {{ t('pending_claim') }}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="t('action_remove')"
            @click="remove(entry)"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </div>
  </section>
</template>
