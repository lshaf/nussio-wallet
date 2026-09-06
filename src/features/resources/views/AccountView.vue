<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { Lock, RefreshCw } from 'lucide-vue-next';
import Amount from '@/components/shared/Amount.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import UnlockDialog from '@/components/dialogs/UnlockDialog.vue';
import { useAccountData } from '@/composables/useAccountData';
import { percentage } from '@/lib/antelope/format';
import type { ActionInput } from '@/lib/antelope/transaction';
import { useAppStore } from '@/stores/app.store';
import TransactionResultDialog from '@/features/transactions/components/TransactionResultDialog.vue';
import { useTransact } from '@/features/transactions/composables/useTransact';
import DelegationsPanel from '../components/DelegationsPanel.vue';
import RamDialog from '../components/RamDialog.vue';
import RamPanel from '../components/RamPanel.vue';
import RentDialog from '../components/RentDialog.vue';
import ResourcePanel from '../components/ResourcePanel.vue';
import StakeDialog from '../components/StakeDialog.vue';

const { t } = useTranslation('ext');
const route = useRoute();
const app = useAppStore();
const transact = useTransact();

const account = computed(() => String(route.params.name ?? ''));
const query = useAccountData(() => app.settings.chainId, account);
const data = computed(() => query.data.value);
const isCurrent = computed(() => app.currentWallet?.account === account.value);
const canSign = computed(() => isCurrent.value && transact.canSign.value);

const stakeOpen = ref(false);
const stakeKind = ref<'cpu' | 'net'>('cpu');
const stakeMode = ref<'stake' | 'unstake'>('stake');
const rentOpen = ref(false);
const rentKind = ref<'cpu' | 'net'>('cpu');
const rentMode = ref<'powerup' | 'rex'>('powerup');
const ramOpen = ref(false);
const ramMode = ref<'buy' | 'sell'>('buy');
const unlockOpen = ref(false);
let lastActions: ActionInput[] = [];

const status = computed(() => {
  const value = data.value;
  if (!value) return 'ok';
  let result: 'ok' | 'cpu_low' | 'net_low' | 'ram_low' = 'ok';
  if (value.cpu.max === 0 || percentage(value.cpu.available, value.cpu.max) < 10)
    result = 'cpu_low';
  if (value.net.max === 0 || percentage(value.net.available, value.net.max) < 10)
    result = 'net_low';
  if (value.ram.quota > 0 && percentage(value.ram.quota - value.ram.used, value.ram.quota) < 10)
    result = 'ram_low';
  return result;
});

function openStake(mode: 'stake' | 'unstake', kind: 'cpu' | 'net'): void {
  stakeMode.value = mode;
  stakeKind.value = kind;
  stakeOpen.value = true;
}

function openRent(mode: 'powerup' | 'rex', kind: 'cpu' | 'net'): void {
  rentMode.value = mode;
  rentKind.value = kind;
  rentOpen.value = true;
}

function openRam(mode: 'buy' | 'sell'): void {
  ramMode.value = mode;
  ramOpen.value = true;
}

async function run(actions: ActionInput[]): Promise<void> {
  lastActions = actions;
  await transact.run(actions);
}

function claim(): void {
  const wallet = app.currentWallet;
  const chain = app.currentChain;
  if (!wallet || !chain) return;
  void run([
    {
      account: chain.systemContract,
      name: 'refund',
      authorization: [{ actor: wallet.account, permission: wallet.authorization }],
      data: { owner: wallet.account },
    },
  ]);
}
</script>

<template>
  <div class="flex flex-col gap-5 md:gap-6">
    <PageHeader :title="t('resources_title')" :eyebrow="account">
      <template #meta>
        <Badge :variant="status === 'ok' ? 'secondary' : 'destructive'">{{
          t(`resources_status_${status}`)
        }}</Badge>
      </template>
      <template #actions>
        <Amount v-if="data" :value="data.balance" size="md" />
        <Button
          variant="outline"
          size="sm"
          :disabled="query.isFetching.value"
          @click="query.refetch()"
        >
          <RefreshCw :class="query.isFetching.value ? 'animate-spin' : ''" />
          {{ t('overview_refresh') }}
        </Button>
      </template>
    </PageHeader>

    <p v-if="app.currentChain && !app.currentChain.stakedResources" class="text-muted-foreground">
      {{ t('resources_not_supported') }}
    </p>
    <p v-else-if="query.isError.value || (query.isSuccess.value && !data)" class="text-destructive">
      {{ query.isError.value ? t('overview_error') : t('overview_not_found') }}
      <span v-if="query.error.value" class="text-muted-foreground block font-mono text-xs">{{
        query.error.value.message
      }}</span>
    </p>
    <div v-else-if="!data" class="grid gap-4 md:grid-cols-2">
      <div v-for="index in 3" :key="index" class="bg-muted h-44 animate-pulse rounded-xl" />
    </div>
    <template v-else>
      <div
        v-if="isCurrent && transact.needsUnlock.value"
        class="bg-card flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
      >
        <Lock class="text-muted-foreground size-4" />
        <span class="flex-1">{{ t('resources_locked') }}</span>
        <Button size="sm" variant="outline" @click="unlockOpen = true">{{
          t('action_unlock')
        }}</Button>
      </div>
      <div class="grid gap-4 md:grid-cols-2 md:gap-6">
        <ResourcePanel
          :data="data"
          kind="cpu"
          :can-sign="canSign"
          @stake="(kind) => openStake('stake', kind)"
          @unstake="(kind) => openStake('unstake', kind)"
          @rent="openRent"
          @claim="claim"
        />
        <ResourcePanel
          :data="data"
          kind="net"
          :can-sign="canSign"
          @stake="(kind) => openStake('stake', kind)"
          @unstake="(kind) => openStake('unstake', kind)"
          @rent="openRent"
          @claim="claim"
        />
        <RamPanel :data="data" :can-sign="canSign" class="md:col-span-2" @trade="openRam" />
        <DelegationsPanel
          v-if="app.currentChain"
          class="md:col-span-2"
          :chain="app.currentChain"
          :account="account"
          :can-sign="canSign"
          :signer="
            app.currentWallet
              ? {
                  actor: app.currentWallet.account,
                  permission: app.currentWallet.authorization,
                }
              : undefined
          "
          @confirm="run"
        />
      </div>

      <template v-if="app.currentChain && app.currentWallet">
        <StakeDialog
          v-model:open="stakeOpen"
          :chain="app.currentChain"
          :data="data"
          :kind="stakeKind"
          :mode="stakeMode"
          :signer="{
            actor: app.currentWallet.account,
            permission: app.currentWallet.authorization,
          }"
          @confirm="run"
        />
        <RentDialog
          v-model:open="rentOpen"
          :chain="app.currentChain"
          :data="data"
          :kind="rentKind"
          :mode="rentMode"
          :signer="{
            actor: app.currentWallet.account,
            permission: app.currentWallet.authorization,
          }"
          @confirm="run"
        />
        <RamDialog
          v-model:open="ramOpen"
          :chain="app.currentChain"
          :data="data"
          :mode="ramMode"
          :signer="{
            actor: app.currentWallet.account,
            permission: app.currentWallet.authorization,
          }"
          @confirm="run"
        />
      </template>
    </template>

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
