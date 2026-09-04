<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Button } from '@/components/ui/button';
import { useAccountService, useWalletService } from '@/composables/useServices';
import type { Wallet } from '@/lib/storage/schemas';
import type { AccountMatch } from '@/services/account.service';
import { useAppStore } from '@/stores/app.store';
import AccountMatchList from './AccountMatchList.vue';

const emit = defineEmits<{ imported: [wallets: Wallet[]] }>();

const { t } = useTranslation('ext');
const app = useAppStore();
const accountService = useAccountService();
const walletService = useWalletService();

const scanning = ref(false);
const scanned = ref(false);
const found = ref<(AccountMatch & { pubkey: string })[]>([]);
const selected = ref<string[]>([]);
const busy = ref(false);

async function scan(): Promise<void> {
  if (!app.settings.chainId || !app.status.unlocked) return;
  scanning.value = true;
  found.value = [];
  const keys = await walletService.unlockedPublicKeys();
  const existing = new Set(
    app.walletsForChain.map((wallet) => `${wallet.account}@${wallet.authorization}`),
  );
  for (const pubkey of keys) {
    const matches = await accountService.findAccountsByKey(app.settings.chainId, pubkey);
    for (const match of matches) {
      const id = `${match.account}@${match.permission}`;
      if (
        existing.has(id) ||
        found.value.some((entry) => `${entry.account}@${entry.permission}` === id)
      )
        continue;
      found.value.push({ ...match, pubkey });
    }
  }
  selected.value = found.value.map((match) => `${match.account}@${match.permission}`);
  scanning.value = false;
  scanned.value = true;
}

async function importSelected(): Promise<void> {
  if (!app.settings.chainId) return;
  busy.value = true;
  try {
    const wallets: Wallet[] = found.value
      .filter((match) => selected.value.includes(`${match.account}@${match.permission}`))
      .map((match) => ({
        chainId: app.settings.chainId!,
        account: match.account,
        authorization: match.permission,
        pubkey: match.pubkey,
        mode: 'hot',
      }));
    await walletService.addWallets(wallets);
    emit('imported', wallets);
    found.value = [];
    selected.value = [];
  } finally {
    busy.value = false;
  }
}

watch(
  () => app.status.unlocked,
  (unlocked) => {
    if (unlocked && !scanned.value) void scan();
  },
);

onMounted(() => {
  void scan();
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">{{ t('import_detect_description') }}</p>
    <p v-if="!app.status.unlocked" class="text-warning text-sm">
      {{ t('import_detect_locked') }}
    </p>
    <p v-else-if="scanning" class="text-muted-foreground text-sm">
      {{ t('import_detect_scanning') }}
    </p>
    <p v-else-if="scanned && found.length === 0" class="text-muted-foreground text-sm">
      {{ t('import_detect_none') }}
    </p>
    <AccountMatchList v-if="found.length > 0" v-model="selected" :matches="found" />
    <div class="flex gap-2">
      <Button variant="outline" :disabled="scanning || !app.status.unlocked" @click="scan">{{
        t('action_find')
      }}</Button>
      <Button :disabled="selected.length === 0 || busy" @click="importSelected">{{
        t('action_import')
      }}</Button>
    </div>
  </div>
</template>
