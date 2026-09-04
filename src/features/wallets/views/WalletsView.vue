<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { Eye, KeyRound, Plus, Trash2 } from 'lucide-vue-next';
import EmptyState from '@/components/shared/EmptyState.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PasswordConfirmDialog from '@/components/dialogs/PasswordConfirmDialog.vue';
import { useWalletService } from '@/composables/useServices';
import { legacyPublicKey } from '@/lib/antelope/keys';
import { shortenKey } from '@/lib/antelope/format';
import type { Wallet } from '@/lib/storage/schemas';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const router = useRouter();
const app = useAppStore();
const walletService = useWalletService();

const confirmOpen = ref(false);
const pendingRemoval = ref<Wallet | undefined>();

function isCurrent(wallet: Wallet): boolean {
  return (
    wallet.account === app.settings.account && wallet.authorization === app.settings.authorization
  );
}

function shortKey(wallet: Wallet): string {
  try {
    return shortenKey(legacyPublicKey(wallet.pubkey, app.currentChain?.keyPrefix ?? 'EOS'));
  } catch {
    return shortenKey(wallet.pubkey);
  }
}

function requestRemove(wallet: Wallet): void {
  pendingRemoval.value = wallet;
  if (wallet.mode === 'hot' || wallet.mode === 'auth') confirmOpen.value = true;
  else void remove();
}

async function remove(): Promise<void> {
  if (!pendingRemoval.value) return;
  await walletService.removeWallet(pendingRemoval.value);
  pendingRemoval.value = undefined;
  await app.load();
}
</script>

<template>
  <div class="flex flex-col gap-5 md:gap-6">
    <PageHeader :title="t('wallets_title')" :eyebrow="app.currentChain?.name">
      <template #actions>
        <Button size="sm" @click="router.push('/setup/import')">
          <Plus />
          {{ t('action_import_account') }}
        </Button>
      </template>
    </PageHeader>

    <EmptyState v-if="app.walletsForChain.length === 0" :title="t('wallets_empty')">
      <Button size="sm" @click="router.push('/setup/import')">{{
        t('action_import_account')
      }}</Button>
    </EmptyState>

    <ul v-else class="bg-card divide-y rounded-lg border">
      <li
        v-for="wallet in app.walletsForChain"
        :key="`${wallet.account}@${wallet.authorization}`"
        class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
      >
        <span
          class="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full"
        >
          <Eye v-if="wallet.mode === 'watch'" class="size-4" />
          <KeyRound v-else class="size-4" />
        </span>
        <div class="flex min-w-0 flex-1 flex-col">
          <div class="flex flex-wrap items-center gap-2">
            <span class="truncate font-mono font-medium"
              >{{ wallet.account }}@{{ wallet.authorization }}</span
            >
            <Badge v-if="isCurrent(wallet)">{{ t('wallets_current') }}</Badge>
            <Badge variant="secondary">{{ t(`mode_${wallet.mode}`) }}</Badge>
          </div>
          <span v-if="wallet.pubkey" class="text-muted-foreground font-mono text-xs">{{
            shortKey(wallet)
          }}</span>
        </div>
        <div class="ml-auto flex items-center gap-1">
          <Button
            v-if="!isCurrent(wallet)"
            variant="outline"
            size="sm"
            @click="app.selectWallet(wallet)"
            >{{ t('wallets_use') }}</Button
          >
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="t('action_remove')"
            @click="requestRemove(wallet)"
          >
            <Trash2 />
          </Button>
        </div>
      </li>
    </ul>
    <PasswordConfirmDialog v-model:open="confirmOpen" @confirm="remove" />
  </div>
</template>
