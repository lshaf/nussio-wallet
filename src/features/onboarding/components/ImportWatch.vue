<script setup lang="ts">
import { ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccountService, useWalletService } from '@/composables/useServices';
import type { Wallet } from '@/lib/storage/schemas';
import type { AccountMatch, AccountSummary } from '@/services/account.service';
import { useAppStore } from '@/stores/app.store';
import AccountMatchList from './AccountMatchList.vue';

const emit = defineEmits<{ imported: [wallets: Wallet[]] }>();

const { t } = useTranslation('ext');
const app = useAppStore();
const accountService = useAccountService();
const walletService = useWalletService();

const name = ref('');
const busy = ref(false);
const notFound = ref(false);
const failed = ref(false);
const summary = ref<AccountSummary | undefined>();
const matches = ref<AccountMatch[]>([]);
const selected = ref<string[]>([]);

async function find(): Promise<void> {
  if (!app.settings.chainId) return;
  busy.value = true;
  notFound.value = false;
  summary.value = await accountService.getAccount(app.settings.chainId, name.value.trim());
  busy.value = false;
  if (!summary.value) {
    notFound.value = true;
    matches.value = [];
    return;
  }
  matches.value = summary.value.permissions.map((permission) => ({
    account: summary.value!.account,
    permission: permission.name,
  }));
  selected.value = matches.value
    .filter((match) => match.permission === 'active')
    .map((match) => `${match.account}@${match.permission}`);
}

async function importSelected(): Promise<void> {
  if (!summary.value || !app.settings.chainId) return;
  busy.value = true;
  failed.value = false;
  try {
    const wallets: Wallet[] = summary.value.permissions
      .filter((permission) =>
        selected.value.includes(`${summary.value!.account}@${permission.name}`),
      )
      .map((permission) => ({
        chainId: app.settings.chainId!,
        account: summary.value!.account,
        authorization: permission.name,
        pubkey: permission.keys[0]?.key ?? '',
        mode: 'watch',
      }));
    await walletService.addWallets(wallets);
    emit('imported', wallets);
    name.value = '';
    summary.value = undefined;
    matches.value = [];
  } catch {
    failed.value = true;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">{{ t('import_watch_description') }}</p>
    <form class="flex flex-col gap-2" @submit.prevent="find">
      <Label for="watch-account">{{ t('import_watch_account_label') }}</Label>
      <div class="flex gap-2">
        <Input
          id="watch-account"
          v-model="name"
          class="flex-1 font-mono"
          maxlength="12"
          autocomplete="off"
        />
        <Button type="submit" variant="outline" :disabled="busy || name.trim().length === 0">{{
          t('action_find')
        }}</Button>
      </div>
      <p v-if="notFound" class="text-destructive text-sm">{{ t('import_watch_not_found') }}</p>
    </form>
    <AccountMatchList
      v-if="matches.length > 0"
      v-model="selected"
      :matches="matches"
      title="import_watch_permissions"
    />
    <Button :disabled="selected.length === 0 || busy" @click="importSelected">{{
      t('action_import')
    }}</Button>
  </div>
</template>
