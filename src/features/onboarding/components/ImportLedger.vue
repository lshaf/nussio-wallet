<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Button } from '@/components/ui/button';
import { useLedger } from '@/composables/useLedger';
import { useAccountService, useWalletService } from '@/composables/useServices';
import { normalizePublicKey } from '@/lib/antelope/keys';
import type { Wallet } from '@/lib/storage/schemas';
import type { AccountMatch } from '@/services/account.service';
import { useAppStore } from '@/stores/app.store';
import AccountMatchList from './AccountMatchList.vue';

interface LedgerMatch extends AccountMatch {
  path: string;
  pubkey: string;
}

const emit = defineEmits<{ imported: [wallets: Wallet[]] }>();

const { t } = useTranslation('ext');
const app = useAppStore();
const accountService = useAccountService();
const walletService = useWalletService();
const { supported, busy: scanning, error, version, accounts } = useLedger();

const found = ref<LedgerMatch[]>([]);
const selected = ref<string[]>([]);
const scanned = ref(false);
const busy = ref(false);

const matches = computed<AccountMatch[]>(() =>
  found.value.map(({ account, permission }) => ({ account, permission })),
);

async function scan(): Promise<void> {
  scanned.value = false;
  found.value = [];
  selected.value = [];
  const chainId = app.settings.chainId;
  const derived = await accounts();
  if (!derived || !chainId) return;
  const collected: LedgerMatch[] = [];
  for (const entry of derived) {
    const pubkey = normalizePublicKey(entry.legacy);
    const hits = await accountService.findAccountsByKey(chainId, pubkey);
    for (const hit of hits) collected.push({ ...hit, path: entry.path, pubkey });
  }
  found.value = collected;
  scanned.value = true;
}

async function importSelected(): Promise<void> {
  const chainId = app.settings.chainId;
  if (!chainId) return;
  busy.value = true;
  try {
    const wallets: Wallet[] = found.value
      .filter((match) => selected.value.includes(`${match.account}@${match.permission}`))
      .map((match) => ({
        chainId,
        account: match.account,
        authorization: match.permission,
        pubkey: match.pubkey,
        path: match.path,
        mode: 'ledger',
      }));
    await walletService.addWallets(wallets);
    emit('imported', wallets);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">{{ t('import_ledger_description') }}</p>
    <p v-if="!supported" class="text-destructive text-sm">{{ t('import_ledger_unsupported') }}</p>
    <template v-else>
      <Button variant="outline" :disabled="scanning" @click="scan">
        {{ scanning ? t('import_ledger_scanning') : t('import_ledger_connect') }}
      </Button>
      <p v-if="version" class="text-muted-foreground text-xs">
        {{ t('import_ledger_app_version', { version }) }}
      </p>
      <p v-if="error" class="text-destructive text-sm">
        {{ t('import_ledger_error') }} <span class="font-mono">{{ error }}</span>
      </p>
      <p v-else-if="scanned && found.length === 0" class="text-destructive text-sm">
        {{ t('import_ledger_none', { chain: app.currentChain?.name ?? '' }) }}
      </p>
      <AccountMatchList
        v-if="found.length > 0"
        v-model="selected"
        :matches="matches"
        title="import_ledger_found"
      />
      <Button
        v-if="found.length > 0"
        :disabled="selected.length === 0 || busy"
        @click="importSelected"
      >
        {{ t('action_import') }}
      </Button>
    </template>
  </div>
</template>
