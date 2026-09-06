<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useQuery } from '@tanstack/vue-query';
import { RefreshCw, Search, Vote } from 'lucide-vue-next';
import EmptyState from '@/components/shared/EmptyState.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import UnlockDialog from '@/components/dialogs/UnlockDialog.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccountData } from '@/composables/useAccountData';
import { useGovernanceService } from '@/composables/useServices';
import { formatNumber } from '@/lib/antelope/format';
import type { ActionInput } from '@/lib/antelope/transaction';
import { voteEffectiveness } from '@/lib/antelope/vote';
import { useAppStore } from '@/stores/app.store';
import TransactionResultDialog from '@/features/transactions/components/TransactionResultDialog.vue';
import { useTransact } from '@/features/transactions/composables/useTransact';
import ProducerDetailsDialog from '../components/ProducerDetailsDialog.vue';
import ProducerRow from '../components/ProducerRow.vue';
import ProxyList from '../components/ProxyList.vue';
import ProxyRegistration from '../components/ProxyRegistration.vue';

const MAX_VOTES = 30;
const PAGE = 30;

const { t } = useTranslation('ext');
const app = useAppStore();
const service = useGovernanceService();
const transact = useTransact();

const account = computed(() => app.currentWallet?.account);
const accountData = useAccountData(() => app.settings.chainId, account);
const search = ref('');
const shown = ref(PAGE);
const selected = ref<string[]>([]);
const detailsOwner = ref('');
const detailsOpen = ref(false);
const unlockOpen = ref(false);
let lastActions: ActionInput[] = [];

const producers = useQuery(
  computed(() => ({
    queryKey: ['producers', app.settings.chainId],
    queryFn: () => service.listProducers(app.settings.chainId!),
    enabled: Boolean(app.settings.chainId),
    refetchInterval: 120_000,
    retry: 1,
  })),
);

const voter = computed(() => accountData.data.value?.voter ?? null);
const currentProxy = computed(() => voter.value?.proxy ?? '');
const currentVotes = computed(() => voter.value?.producers ?? []);
const effectiveness = computed(() => {
  const data = accountData.data.value;
  const chain = app.currentChain;
  if (!data?.voter || !chain) return undefined;
  return voteEffectiveness(
    data.voter.lastVoteWeight,
    data.voter.proxiedVoteWeight,
    data.voter.staked,
    chain.voteDecayPeriodWeeks,
  );
});

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase();
  const list = producers.data.value?.producers ?? [];
  if (term.length === 0) return list;
  return list.filter(
    (producer) => producer.owner.includes(term) || producer.url.toLowerCase().includes(term),
  );
});
const visible = computed(() => filtered.value.slice(0, shown.value));
const dirty = computed(() => {
  const before = [...currentVotes.value].sort().join(',');
  const after = [...selected.value].sort().join(',');
  return before !== after;
});
const canSign = computed(() => transact.canSign.value && Boolean(app.currentWallet));

watch(
  currentVotes,
  (votes) => {
    selected.value = [...votes];
  },
  { immediate: true },
);
watch(search, () => (shown.value = PAGE));

function toggle(owner: string): void {
  if (selected.value.includes(owner)) {
    selected.value = selected.value.filter((entry) => entry !== owner);
    return;
  }
  if (selected.value.length >= MAX_VOTES) return;
  selected.value = [...selected.value, owner];
}

function openDetails(owner: string): void {
  detailsOwner.value = owner;
  detailsOpen.value = true;
}

async function run(actions: ActionInput[]): Promise<void> {
  lastActions = actions;
  await transact.run(actions);
}

function vote(): void {
  const wallet = app.currentWallet;
  const chain = app.currentChain;
  if (!wallet || !chain) return;
  void run([
    {
      account: chain.systemContract,
      name: 'voteproducer',
      authorization: [{ actor: wallet.account, permission: wallet.authorization }],
      data: {
        voter: wallet.account,
        proxy: '',
        producers: [...selected.value].sort(),
      },
    },
  ]);
}
</script>

<template>
  <div class="flex flex-col gap-5 md:gap-6">
    <PageHeader :title="t('governance_title')" :eyebrow="app.currentChain?.name">
      <template #meta>
        <Badge v-if="currentProxy" variant="secondary"
          >{{ t('governance_proxying') }}: {{ currentProxy }}</Badge
        >
        <Badge v-else-if="effectiveness !== undefined" variant="secondary"
          >{{ t('governance_strength') }} {{ formatNumber(effectiveness, 1) }} %</Badge
        >
      </template>
      <template #actions>
        <Button
          variant="outline"
          size="sm"
          :disabled="producers.isFetching.value"
          @click="producers.refetch()"
        >
          <RefreshCw :class="producers.isFetching.value ? 'animate-spin' : ''" />
          {{ t('overview_refresh') }}
        </Button>
      </template>
    </PageHeader>

    <EmptyState v-if="!app.currentWallet" :title="t('home_no_wallet')" />

    <Tabs v-else default-value="producers" class="gap-4">
      <TabsList>
        <TabsTrigger value="producers">{{ t('governance_producers') }}</TabsTrigger>
        <TabsTrigger v-if="app.currentChain?.features.includes('regproxyinfo')" value="proxies">{{
          t('governance_proxies')
        }}</TabsTrigger>
      </TabsList>

      <TabsContent value="producers" class="flex flex-col gap-4">
        <div class="relative">
          <Search class="text-muted-foreground absolute top-2.5 left-3 size-4" />
          <Input v-model="search" class="pl-9" :placeholder="t('governance_search')" />
        </div>

        <p v-if="producers.isError.value" class="text-destructive text-sm">
          {{ t('governance_error') }}
        </p>
        <div v-else-if="!producers.data.value" class="bg-muted h-64 animate-pulse rounded-lg" />
        <template v-else>
          <div class="bg-card divide-y rounded-lg border">
            <ProducerRow
              v-for="producer in visible"
              :key="producer.owner"
              :producer="producer"
              :selected="selected.includes(producer.owner)"
              :disabled="selected.length >= MAX_VOTES"
              :voted="currentVotes.includes(producer.owner)"
              @toggle="toggle(producer.owner)"
              @details="openDetails(producer.owner)"
            />
          </div>
          <Button
            v-if="visible.length < filtered.length"
            variant="outline"
            size="sm"
            class="self-center"
            @click="shown += PAGE"
            >{{ t('governance_more') }}</Button
          >
        </template>
      </TabsContent>

      <TabsContent
        v-if="app.currentChain?.features.includes('regproxyinfo')"
        value="proxies"
        class="flex flex-col gap-4"
      >
        <ProxyRegistration :is-proxy="voter?.isProxy ?? false" :can-sign="canSign" @confirm="run" />
        <ProxyList :current="currentProxy" :can-sign="canSign" @confirm="run" />
      </TabsContent>
    </Tabs>

    <div
      v-if="app.currentWallet && dirty"
      class="bg-card sticky bottom-16 z-10 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 shadow-lg md:bottom-4"
    >
      <Vote class="text-primary size-4 shrink-0" />
      <span class="flex-1 text-sm"
        >{{ t('governance_selected', { count: selected.length, max: MAX_VOTES }) }}
      </span>
      <Button variant="ghost" size="sm" @click="selected = [...currentVotes]">{{
        t('action_cancel')
      }}</Button>
      <Button v-if="canSign" size="sm" @click="vote">{{ t('governance_save') }}</Button>
      <Button v-else size="sm" variant="outline" @click="unlockOpen = true">{{
        t('action_unlock')
      }}</Button>
    </div>

    <ProducerDetailsDialog v-model:open="detailsOpen" :owner="detailsOwner" />
    <UnlockDialog v-model:open="unlockOpen" />
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
