<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordConfirmDialog from '@/components/dialogs/PasswordConfirmDialog.vue';
import { useAccountService, useWalletService } from '@/composables/useServices';
import { legacyPublicKey, parsePrivateKey } from '@/lib/antelope/keys';
import type { Wallet } from '@/lib/storage/schemas';
import type { AccountMatch } from '@/services/account.service';
import { useAppStore } from '@/stores/app.store';
import AccountMatchList from './AccountMatchList.vue';

const emit = defineEmits<{ imported: [wallets: Wallet[]] }>();

const { t } = useTranslation('ext');
const app = useAppStore();
const accountService = useAccountService();
const walletService = useWalletService();

const wif = ref('');
const publicKey = ref('');
const invalid = ref(false);
const searching = ref(false);
const matches = ref<AccountMatch[]>([]);
const selected = ref<string[]>([]);
const confirmOpen = ref(false);
const busy = ref(false);

const legacy = computed(() =>
  publicKey.value ? legacyPublicKey(publicKey.value, app.currentChain?.keyPrefix ?? 'EOS') : '',
);

watch(wif, async (value) => {
  matches.value = [];
  selected.value = [];
  publicKey.value = '';
  invalid.value = false;
  if (value.trim().length < 50) return;
  try {
    publicKey.value = parsePrivateKey(value).publicKey;
  } catch {
    invalid.value = true;
    return;
  }
  if (!app.settings.chainId) return;
  searching.value = true;
  try {
    matches.value = await accountService.findAccountsByKey(app.settings.chainId, publicKey.value);
    selected.value = matches.value.map((match) => `${match.account}@${match.permission}`);
  } catch {
    matches.value = [];
  } finally {
    searching.value = false;
  }
});

async function importSelected(password: string): Promise<void> {
  if (!app.settings.chainId) return;
  busy.value = true;
  try {
    const { publicKey: imported } = await walletService.importKey(wif.value, password);
    const wallets: Wallet[] = matches.value
      .filter((match) => selected.value.includes(`${match.account}@${match.permission}`))
      .map((match) => ({
        chainId: app.settings.chainId!,
        account: match.account,
        authorization: match.permission,
        pubkey: imported,
        mode: 'hot',
      }));
    await walletService.addWallets(wallets);
    emit('imported', wallets);
    wif.value = '';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <Label for="import-wif">{{ t('import_key_label') }}</Label>
      <Input id="import-wif" v-model="wif" type="password" autocomplete="off" spellcheck="false" />
      <p class="text-muted-foreground text-xs">{{ t('import_key_hint') }}</p>
      <p v-if="invalid" class="text-destructive text-sm">{{ t('import_key_invalid') }}</p>
      <p v-if="legacy" class="font-mono text-xs break-all">
        {{ t('import_key_public') }}: {{ legacy }}
      </p>
    </div>
    <p v-if="searching" class="text-muted-foreground text-sm">{{ t('import_key_searching') }}</p>
    <p v-else-if="publicKey && matches.length === 0" class="text-destructive text-sm">
      {{ t('import_key_none', { chain: app.currentChain?.name ?? '' }) }}
    </p>
    <AccountMatchList v-if="matches.length > 0" v-model="selected" :matches="matches" />
    <Button :disabled="selected.length === 0 || busy" @click="confirmOpen = true">
      {{ t('action_import') }}
    </Button>
    <PasswordConfirmDialog v-model:open="confirmOpen" @confirm="importSelected" />
  </div>
</template>
