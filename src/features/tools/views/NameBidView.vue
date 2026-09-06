<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useDebounceFn } from '@vueuse/core';
import { Gavel, Search } from 'lucide-vue-next';
import DataList from '@/components/shared/DataList.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccountData } from '@/composables/useAccountData';
import { useSystemService, type NameBid, type NameStatus } from '@/composables/useServices';
import { parseAsset } from '@/lib/antelope/format';
import type { ActionInput } from '@/lib/antelope/transaction';
import { useAppStore } from '@/stores/app.store';
import TransactionResultDialog from '@/features/transactions/components/TransactionResultDialog.vue';
import { useTransact } from '@/features/transactions/composables/useTransact';

const { t } = useTranslation('ext');
const app = useAppStore();
const service = useSystemService();
const transact = useTransact();

const name = ref('');
const amount = ref('');
const status = ref<NameStatus>();
const checking = ref(false);
const recent = ref<NameBid[]>([]);
const auctions = ref<NameBid[]>([]);
const loadingAuctions = ref(false);
let lastActions: ActionInput[] = [];

const account = computed(() => app.currentWallet?.account);
const accountData = useAccountData(() => app.settings.chainId, account);
const liquid = computed(() =>
  accountData.data.value ? parseAsset(accountData.data.value.balance) : undefined,
);
const value = computed(() => Number(amount.value.replace(/,/g, '')));
const currentBid = computed(() =>
  status.value?.bid && !status.value.bid.settled ? parseAsset(status.value.bid.highBid) : undefined,
);
const problem = computed(() => {
  if (status.value?.state === 'taken') return t('bid_error_taken');
  if (!(value.value > 0)) return '';
  if (liquid.value && value.value > liquid.value.amount) return t('send_error_insufficient');
  if (currentBid.value && value.value <= currentBid.value.amount)
    return t('bid_error_outbid', { amount: status.value?.bid?.highBid ?? '' });
  return '';
});
const valid = computed(
  () =>
    Boolean(status.value) && status.value?.state !== 'taken' && value.value > 0 && !problem.value,
);

const check = useDebounceFn(async (candidate: string) => {
  const chainId = app.settings.chainId;
  status.value = undefined;
  if (!chainId || candidate.length === 0) return;
  checking.value = true;
  try {
    status.value = await service.getNameStatus(chainId, candidate);
  } finally {
    checking.value = false;
  }
}, 400);

watch(name, (value) => void check(value.trim().toLowerCase()));

async function loadAuctions(): Promise<void> {
  const chainId = app.settings.chainId;
  if (!chainId || !app.currentChain?.features.includes('bidname')) {
    auctions.value = [];
    return;
  }
  loadingAuctions.value = true;
  try {
    auctions.value = await service.listOpenNameBids(chainId);
  } catch {
    auctions.value = [];
  } finally {
    loadingAuctions.value = false;
  }
}

async function loadRecent(): Promise<void> {
  const chainId = app.settings.chainId;
  const names = chainId ? (app.settings.recentBids[chainId] ?? []) : [];
  recent.value = names.length > 0 && chainId ? await service.getNameBids(chainId, names) : [];
}

async function run(actions: ActionInput[]): Promise<void> {
  lastActions = actions;
  await transact.run(actions);
}

async function bid(): Promise<void> {
  const wallet = app.currentWallet;
  const chain = app.currentChain;
  const target = name.value.trim().toLowerCase();
  if (!wallet || !chain || !valid.value) return;
  const quantity = `${value.value.toFixed(chain.tokenPrecision)} ${chain.symbol}`;
  await run([
    {
      account: chain.systemContract,
      name: 'bidname',
      authorization: [{ actor: wallet.account, permission: wallet.authorization }],
      data: { bidder: wallet.account, newname: target, bid: quantity },
    },
  ]);
  const list = new Set([...(app.settings.recentBids[chain.chainId] ?? []), target]);
  await app.updateSettings({
    recentBids: { ...app.settings.recentBids, [chain.chainId]: [...list] },
  });
  await Promise.all([loadRecent(), loadAuctions()]);
}

watch(
  () => app.settings.chainId,
  () => void Promise.all([loadRecent(), loadAuctions()]),
);
onMounted(() => void Promise.all([loadRecent(), loadAuctions()]));
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-5 md:gap-6">
    <PageHeader :title="t('bid_title')" :eyebrow="app.currentChain?.name" />

    <EmptyState
      v-if="!app.currentChain?.features.includes('bidname')"
      :title="t('bid_unsupported')"
    />

    <template v-else>
      <form class="bg-card flex flex-col gap-4 rounded-lg border p-4" @submit.prevent="bid">
        <p class="text-muted-foreground text-sm">{{ t('bid_description') }}</p>
        <div class="flex flex-col gap-2">
          <Label for="bid-name">{{ t('bid_name_label') }}</Label>
          <div class="relative">
            <Search class="text-muted-foreground absolute top-2.5 left-3 size-4" />
            <Input
              id="bid-name"
              v-model="name"
              class="pl-9 font-mono"
              maxlength="12"
              autocomplete="off"
              spellcheck="false"
            />
          </div>
          <p v-if="checking" class="text-muted-foreground text-xs">{{ t('bid_checking') }}</p>
          <p
            v-else-if="status"
            class="text-xs"
            :class="status.state === 'taken' ? 'text-destructive' : 'text-muted-foreground'"
          >
            {{ t(`bid_state_${status.state}`) }}
          </p>
        </div>

        <DataList
          v-if="status?.bid"
          :items="[
            { label: t('bid_high_bid'), value: status.bid.highBid },
            { label: t('bid_high_bidder'), value: status.bid.highBidder, mono: true },
          ]"
        />

        <div class="flex flex-col gap-2">
          <Label for="bid-amount">{{ t('bid_amount_label') }}</Label>
          <Input id="bid-amount" v-model="amount" class="num" inputmode="decimal" />
        </div>

        <p v-if="problem" class="text-destructive text-sm">{{ problem }}</p>

        <Button type="submit" class="self-start" :disabled="!valid || !transact.canSign.value">
          <Gavel />
          {{ t('bid_action') }}
        </Button>
      </form>

      <section class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <h2 class="eyebrow">{{ t('bid_auctions') }}</h2>
          <Button variant="ghost" size="sm" :disabled="loadingAuctions" @click="loadAuctions">{{
            t('overview_refresh')
          }}</Button>
        </div>
        <div v-if="loadingAuctions" class="bg-muted h-24 animate-pulse rounded-lg" />
        <p v-else-if="auctions.length === 0" class="text-muted-foreground text-sm">
          {{ t('bid_auctions_empty') }}
        </p>
        <div v-else class="bg-card divide-y rounded-lg border">
          <button
            v-for="entry in auctions"
            :key="entry.name"
            type="button"
            class="hover:bg-accent/50 flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors"
            @click="name = entry.name"
          >
            <span class="font-mono font-medium">{{ entry.name }}</span>
            <span class="num ml-auto">{{ entry.highBid }}</span>
            <span class="text-muted-foreground w-full font-mono text-xs sm:w-auto">{{
              entry.highBidder
            }}</span>
          </button>
        </div>
      </section>

      <section v-if="recent.length > 0" class="flex flex-col gap-3">
        <h2 class="eyebrow">{{ t('bid_recent') }}</h2>
        <div class="bg-card divide-y rounded-lg border">
          <div
            v-for="entry in recent"
            :key="entry.name"
            class="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
          >
            <span class="font-mono font-medium">{{ entry.name }}</span>
            <Badge :variant="entry.settled ? 'secondary' : 'outline'">{{
              entry.settled ? t('bid_settled') : t('bid_open')
            }}</Badge>
            <span class="num ml-auto">{{ entry.highBid }}</span>
            <span class="text-muted-foreground w-full font-mono text-xs sm:w-auto">{{
              entry.highBidder
            }}</span>
          </div>
        </div>
      </section>
    </template>

    <TransactionResultDialog
      v-model:open="transact.open.value"
      :busy="transact.busy.value"
      :ledger-waiting="transact.ledgerWaiting.value"
      :result="transact.result.value"
      @proceed="transact.proceedWithFee"
      @retry="run(lastActions)"
    />
  </div>
</template>
