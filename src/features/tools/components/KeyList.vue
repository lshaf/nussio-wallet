<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Eye, KeyRound, Trash2 } from 'lucide-vue-next';
import EmptyState from '@/components/shared/EmptyState.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PasswordConfirmDialog from '@/components/dialogs/PasswordConfirmDialog.vue';
import RevealKeyDialog from '@/components/dialogs/RevealKeyDialog.vue';
import { useWalletService } from '@/composables/useServices';
import { samePublicKey } from '@/lib/antelope/keys';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();
const walletService = useWalletService();

const keys = ref<string[]>([]);
const selected = ref('');
const revealOpen = ref(false);
const removeOpen = ref(false);
const error = ref('');

const rows = computed(() =>
  keys.value.map((pubkey) => ({
    pubkey,
    wallets: app.wallets.filter((wallet) => samePublicKey(wallet.pubkey, pubkey)),
  })),
);

async function refresh(): Promise<void> {
  keys.value = await walletService.listPublicKeys();
}

function reveal(pubkey: string): void {
  selected.value = pubkey;
  revealOpen.value = true;
}

function askRemove(pubkey: string): void {
  selected.value = pubkey;
  error.value = '';
  removeOpen.value = true;
}

async function remove(password: string): Promise<void> {
  try {
    await walletService.removeKey(selected.value, password);
    await refresh();
  } catch {
    error.value = t('keys_remove_failed');
  }
}

defineExpose({ refresh });

onMounted(refresh);
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="eyebrow">{{ t('keys_list_title') }}</h2>
    <EmptyState v-if="rows.length === 0" :title="t('keys_empty')">
      <template #icon><KeyRound class="text-muted-foreground size-6" /></template>
    </EmptyState>
    <div v-else class="bg-card divide-y rounded-lg border">
      <div v-for="row in rows" :key="row.pubkey" class="flex flex-col gap-2 px-4 py-3">
        <div class="flex flex-wrap items-center gap-2">
          <code class="min-w-0 flex-1 font-mono text-xs break-all">{{ row.pubkey }}</code>
          <Button variant="outline" size="sm" @click="reveal(row.pubkey)">
            <Eye />
            {{ t('keys_reveal_action') }}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="row.wallets.length > 0"
            :title="row.wallets.length > 0 ? t('keys_remove_blocked') : t('action_remove')"
            :aria-label="t('action_remove')"
            @click="askRemove(row.pubkey)"
          >
            <Trash2 />
          </Button>
        </div>
        <div v-if="row.wallets.length > 0" class="flex flex-wrap gap-1.5">
          <Badge
            v-for="wallet in row.wallets"
            :key="`${wallet.chainId}-${wallet.account}`"
            variant="secondary"
          >
            {{ wallet.account }}@{{ wallet.authorization }}
          </Badge>
        </div>
        <p v-else class="text-muted-foreground text-xs">{{ t('keys_unused') }}</p>
      </div>
    </div>
    <p v-if="error" class="text-destructive text-sm">{{ error }}</p>

    <RevealKeyDialog v-model:open="revealOpen" :public-key="selected" />
    <PasswordConfirmDialog v-model:open="removeOpen" @confirm="remove" />
  </section>
</template>
