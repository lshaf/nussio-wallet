<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Coins, Plus, RefreshCw, Trash2 } from 'lucide-vue-next';
import EmptyState from '@/components/shared/EmptyState.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTokensService, type ScannedToken } from '@/composables/useServices';
import { accountNameSchema, type CustomToken } from '@/lib/storage/schemas';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();
const service = useTokensService();

const tokens = ref<CustomToken[]>([]);
const contract = ref('');
const symbol = ref('');
const busy = ref(false);
const error = ref('');
const scanned = ref<ScannedToken[]>([]);
const scanError = ref('');
const scanning = ref(false);

const chainId = computed(() => app.settings.chainId);
const valid = computed(
  () =>
    accountNameSchema.safeParse(contract.value.trim()).success &&
    /^[A-Z]{1,7}$/.test(symbol.value.trim().toUpperCase()),
);

async function refresh(): Promise<void> {
  if (!chainId.value) return;
  tokens.value = await service.list(chainId.value);
}

async function add(): Promise<void> {
  if (!chainId.value || !valid.value) return;
  busy.value = true;
  error.value = '';
  try {
    tokens.value = await service.add(
      chainId.value,
      contract.value.trim(),
      symbol.value.trim().toUpperCase(),
    );
    contract.value = '';
    symbol.value = '';
    scanned.value = scanned.value.map((entry) => ({
      ...entry,
      tracked: tokens.value.some(
        (token) => token.contract === entry.contract && token.symbol === entry.symbol,
      ),
    }));
  } catch {
    error.value = t('tokens_error_add');
  } finally {
    busy.value = false;
  }
}

async function track(token: ScannedToken): Promise<void> {
  contract.value = token.contract;
  symbol.value = token.symbol;
  await add();
}

async function remove(token: CustomToken): Promise<void> {
  if (!chainId.value) return;
  tokens.value = await service.remove(chainId.value, token.contract, token.symbol);
  scanned.value = scanned.value.map((entry) => ({
    ...entry,
    tracked:
      entry.contract === token.contract && entry.symbol === token.symbol ? false : entry.tracked,
  }));
}

async function scan(): Promise<void> {
  const account = app.currentWallet?.account;
  if (!chainId.value || !account) return;
  scanning.value = true;
  scanError.value = '';
  try {
    scanned.value = await service.scan(chainId.value, account);
    if (scanned.value.length === 0) scanError.value = t('tokens_scan_empty');
  } catch {
    scanError.value = t('tokens_scan_unsupported');
  } finally {
    scanning.value = false;
  }
}

watch(chainId, () => {
  scanned.value = [];
  void refresh();
});

onMounted(refresh);
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-5 md:gap-6">
    <PageHeader :title="t('tokens_title')" :eyebrow="app.currentChain?.name" />

    <form class="bg-card flex flex-col gap-4 rounded-lg border p-4" @submit.prevent="add">
      <p class="text-muted-foreground text-sm">{{ t('tokens_add_description') }}</p>
      <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <div class="flex flex-col gap-2">
          <Label for="token-contract">{{ t('tokens_contract_label') }}</Label>
          <Input
            id="token-contract"
            v-model="contract"
            class="font-mono"
            maxlength="12"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="token-symbol">{{ t('tokens_symbol_label') }}</Label>
          <Input
            id="token-symbol"
            v-model="symbol"
            class="font-mono uppercase"
            maxlength="7"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
      </div>
      <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
      <div class="flex flex-wrap gap-2">
        <Button type="submit" :disabled="busy || !valid || !chainId">
          <Plus />
          {{ t('tokens_add_action') }}
        </Button>
        <Button
          type="button"
          variant="outline"
          :disabled="scanning || !app.currentWallet"
          @click="scan"
        >
          <RefreshCw :class="scanning ? 'animate-spin' : ''" />
          {{ t('tokens_scan_action') }}
        </Button>
      </div>
      <p v-if="scanError" class="text-muted-foreground text-sm">{{ scanError }}</p>
    </form>

    <section v-if="scanned.length > 0" class="flex flex-col gap-3">
      <h2 class="eyebrow">{{ t('tokens_scan_title') }}</h2>
      <div class="bg-card divide-y rounded-lg border">
        <div
          v-for="token in scanned"
          :key="`${token.contract}:${token.symbol}`"
          class="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
        >
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="font-medium">{{ token.symbol }}</span>
            <span class="text-muted-foreground font-mono text-xs">{{ token.contract }}</span>
          </div>
          <span class="num text-muted-foreground text-xs">{{ token.amount }}</span>
          <Button
            v-if="!token.tracked"
            variant="outline"
            size="sm"
            :disabled="busy"
            @click="track(token)"
            >{{ t('tokens_track') }}</Button
          >
          <span v-else class="text-positive text-xs">{{ t('tokens_tracked') }}</span>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="eyebrow">{{ t('tokens_tracked_title') }}</h2>
      <EmptyState v-if="tokens.length === 0" :title="t('tokens_empty')">
        <template #icon><Coins class="text-muted-foreground size-6" /></template>
      </EmptyState>
      <div v-else class="bg-card divide-y rounded-lg border">
        <div
          v-for="token in tokens"
          :key="`${token.contract}:${token.symbol}`"
          class="flex items-center gap-3 px-4 py-3 text-sm"
        >
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="font-medium">{{ token.symbol }}</span>
            <span class="text-muted-foreground font-mono text-xs">{{ token.contract }}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="t('action_remove')"
            @click="remove(token)"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </section>
  </div>
</template>
