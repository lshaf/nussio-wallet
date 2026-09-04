<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { useQueryClient } from '@tanstack/vue-query';
import { Radio, RefreshCw, Users } from 'lucide-vue-next';
import PageHeader from '@/components/shared/PageHeader.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePriceFeed } from '@/composables/useChainData';
import { useAppStore } from '@/stores/app.store';
import { useAccountOverview } from '../composables/useAccountOverview';
import AccountHero from '../components/AccountHero.vue';
import AccountHints from '../components/AccountHints.vue';
import OverviewCard from '../components/OverviewCard.vue';
import OverviewRow from '../components/OverviewRow.vue';
import PriceBadge from '../components/PriceBadge.vue';
import BroadcastDialog from '@/features/transactions/components/BroadcastDialog.vue';

type Tab = 'systemtokens' | 'balances' | 'resources' | 'governance';

const { t } = useTranslation('ext');
const router = useRouter();
const app = useAppStore();
const queryClient = useQueryClient();
const tab = ref<Tab>('systemtokens');
const broadcastOpen = ref(false);

const feed = usePriceFeed(() => app.settings.chainId);
const usd = computed(() => feed.data.value?.usd);

const accounts = computed(() => [...new Set(app.walletsForChain.map((wallet) => wallet.account))]);
const chain = computed(() => app.currentChain);

const current = useAccountOverview(chain, () => app.currentWallet?.account);

const tabs = computed<{ value: Tab; label: string }[]>(() => [
  { value: 'systemtokens', label: 'overview_tab_systemtokens' },
  { value: 'balances', label: 'overview_tab_balances' },
  ...(chain.value?.stakedResources
    ? [{ value: 'resources' as Tab, label: 'overview_tab_resources' }]
    : []),
  { value: 'governance', label: 'overview_tab_governance' },
]);

const columns = computed<string[]>(() => {
  if (!chain.value) return [];
  switch (tab.value) {
    case 'systemtokens':
      return [
        'overview_col_total',
        'overview_col_available',
        ...(usd.value !== undefined ? ['overview_col_usd'] : []),
        ...(chain.value.stakedResources
          ? [
              'overview_col_staked',
              ...(chain.value.features.includes('rex') ? ['overview_col_rex'] : []),
              'overview_col_delegated',
              'overview_col_refunding',
            ]
          : []),
      ];
    case 'balances':
      return ['overview_tab_balances'];
    case 'resources':
      return ['overview_col_cpu', 'overview_col_net', 'overview_col_ram'];
    default:
      return [
        'overview_col_vote_weight',
        'overview_col_effectiveness',
        'overview_col_votes',
        'overview_col_proxy',
      ];
  }
});

function refreshAll(): void {
  void queryClient.invalidateQueries({ queryKey: ['account', app.settings.chainId] });
  void queryClient.invalidateQueries({ queryKey: ['balances', app.settings.chainId] });
}
</script>

<template>
  <div class="flex flex-col gap-5 md:gap-6">
    <PageHeader :title="t('home_title')" :eyebrow="chain?.name">
      <template #meta><PriceBadge /></template>
      <template #actions>
        <Button variant="outline" size="sm" @click="refreshAll">
          <RefreshCw />
          {{ t('overview_refresh_all') }}
        </Button>
        <Button variant="outline" size="sm" @click="router.push('/wallets')">
          <Users />
          {{ t('overview_manage_accounts') }}
        </Button>
        <Button
          v-if="chain"
          variant="outline"
          size="sm"
          :aria-label="t('broadcast_title')"
          @click="broadcastOpen = true"
        >
          <Radio />
          <span class="hidden sm:inline">{{ t('overview_broadcast') }}</span>
        </Button>
      </template>
    </PageHeader>

    <template v-if="chain && app.currentWallet">
      <AccountHero :chain="chain" :account="app.currentWallet.account" :usd="usd" />
      <AccountHints v-if="current.data.value" :data="current.data.value" />
    </template>

    <template v-if="chain && accounts.length > 0">
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <p class="eyebrow">{{ t('overview_all_accounts', { count: accounts.length }) }}</p>
        </div>
        <Tabs v-model="tab">
          <TabsList class="h-auto max-w-full flex-wrap justify-start">
            <TabsTrigger v-for="entry in tabs" :key="entry.value" :value="entry.value">{{
              t(entry.label)
            }}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div class="bg-card hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('overview_col_account') }}</TableHead>
              <TableHead
                v-for="column in columns"
                :key="column"
                :class="tab === 'balances' ? '' : 'text-right'"
              >
                {{ t(column) }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <OverviewRow
              v-for="account in accounts"
              :key="`${tab}-${account}`"
              :chain="chain"
              :account="account"
              :tab="tab"
              :usd="usd"
            />
          </TableBody>
        </Table>
      </div>

      <div class="flex flex-col gap-3 md:hidden">
        <OverviewCard
          v-for="account in accounts"
          :key="`${tab}-${account}`"
          :chain="chain"
          :account="account"
          :tab="tab"
          :usd="usd"
        />
      </div>
    </template>

    <EmptyState v-else :title="t('home_no_wallet')" :description="t('wallets_empty')">
      <Button size="sm" @click="router.push('/setup/import')">{{
        t('action_import_account')
      }}</Button>
    </EmptyState>
    <BroadcastDialog v-model:open="broadcastOpen" />
  </div>
</template>
