<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordConfirmDialog from '@/components/dialogs/PasswordConfirmDialog.vue';
import { useWalletService } from '@/composables/useServices';
import { isValidPrivateKey } from '@/lib/antelope/keys';
import { accountNameSchema, permissionNameSchema, type Wallet } from '@/lib/storage/schemas';
import { useAppStore } from '@/stores/app.store';

const emit = defineEmits<{ imported: [wallets: Wallet[]] }>();

const { t } = useTranslation('ext');
const app = useAppStore();
const walletService = useWalletService();

const account = ref('');
const permission = ref('active');
const wif = ref('');
const confirmOpen = ref(false);
const busy = ref(false);

const valid = computed(
  () =>
    accountNameSchema.safeParse(account.value).success &&
    permissionNameSchema.safeParse(permission.value).success &&
    isValidPrivateKey(wif.value),
);

async function importWallet(password: string): Promise<void> {
  if (!app.settings.chainId) return;
  busy.value = true;
  try {
    const { publicKey } = await walletService.importKey(wif.value, password);
    const wallet: Wallet = {
      chainId: app.settings.chainId,
      account: account.value,
      authorization: permission.value,
      pubkey: publicKey,
      mode: 'hot',
    };
    await walletService.addWallets([wallet]);
    emit('imported', [wallet]);
    account.value = '';
    wif.value = '';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Alert variant="destructive">
      <AlertDescription>{{ t('import_manual_warning') }}</AlertDescription>
    </Alert>
    <div class="grid gap-3 sm:grid-cols-2">
      <div class="flex flex-col gap-2">
        <Label for="manual-account">{{ t('import_watch_account_label') }}</Label>
        <Input
          id="manual-account"
          v-model="account"
          class="font-mono"
          maxlength="12"
          autocomplete="off"
        />
      </div>
      <div class="flex flex-col gap-2">
        <Label for="manual-permission">{{ t('import_manual_permission_label') }}</Label>
        <Input
          id="manual-permission"
          v-model="permission"
          class="font-mono"
          maxlength="12"
          autocomplete="off"
        />
      </div>
    </div>
    <div class="flex flex-col gap-2">
      <Label for="manual-wif">{{ t('import_key_label') }}</Label>
      <Input id="manual-wif" v-model="wif" type="password" autocomplete="off" spellcheck="false" />
    </div>
    <Button :disabled="!valid || busy" @click="confirmOpen = true">{{ t('action_import') }}</Button>
    <PasswordConfirmDialog v-model:open="confirmOpen" @confirm="importWallet" />
  </div>
</template>
