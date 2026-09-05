<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useDebounceFn } from '@vueuse/core';
import { PrivateKey } from '@wharfkit/antelope';
import { Download, RefreshCw, ShieldAlert, UserPlus } from 'lucide-vue-next';
import EmptyState from '@/components/shared/EmptyState.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSystemService } from '@/composables/useServices';
import { inspectKey } from '@/lib/antelope/keys';
import type { ActionInput } from '@/lib/antelope/transaction';
import { accountNameSchema } from '@/lib/storage/schemas';
import { useAppStore } from '@/stores/app.store';
import TransactionResultDialog from '@/features/transactions/components/TransactionResultDialog.vue';
import { useTransact } from '@/features/transactions/composables/useTransact';

const { t } = useTranslation('ext');
const app = useAppStore();
const service = useSystemService();
const transact = useTransact();

const name = ref('');
const ownerKey = ref('');
const activeKey = ref('');
const ramBytes = ref(3000);
const stakeCpu = ref('0.1000');
const stakeNet = ref('0.1000');
const transfer = ref(false);
const availability = ref<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
const generated = ref<{ owner: string; active: string }>();
let lastActions: ActionInput[] = [];

const chain = computed(() => app.currentChain);
const nameValid = computed(() => accountNameSchema.safeParse(name.value.trim()).success);
const keysValid = computed(
  () =>
    inspectKey(ownerKey.value).kind === 'public' && inspectKey(activeKey.value).kind === 'public',
);
const valid = computed(
  () =>
    nameValid.value &&
    availability.value === 'available' &&
    keysValid.value &&
    ramBytes.value >= 64,
);

const check = useDebounceFn(async (candidate: string) => {
  const chainId = app.settings.chainId;
  if (!chainId || !accountNameSchema.safeParse(candidate).success) {
    availability.value = candidate.length === 0 ? 'idle' : 'invalid';
    return;
  }
  availability.value = 'checking';
  const status = await service.getNameStatus(chainId, candidate);
  availability.value = status.state === 'taken' ? 'taken' : 'available';
}, 400);

watch(name, (value) => void check(value.trim().toLowerCase()));

function generate(): void {
  const owner = PrivateKey.generate('K1');
  const active = PrivateKey.generate('K1');
  ownerKey.value = String(owner.toPublic());
  activeKey.value = String(active.toPublic());
  generated.value = { owner: owner.toWif(), active: active.toWif() };
}

function downloadKeys(): void {
  if (!generated.value) return;
  const blob = new Blob([`OWNER: ${generated.value.owner}\nACTIVE: ${generated.value.active}\n`], {
    type: 'text/plain',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nussio-new-account-${name.value.trim() || 'keys'}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function authority(publicKey: string): Record<string, unknown> {
  return { threshold: 1, keys: [{ key: publicKey, weight: 1 }], accounts: [], waits: [] };
}

async function run(actions: ActionInput[]): Promise<void> {
  lastActions = actions;
  await transact.run(actions);
}

function create(): void {
  const wallet = app.currentWallet;
  const current = chain.value;
  if (!wallet || !current || !valid.value) return;
  const authorization = [{ actor: wallet.account, permission: wallet.authorization }];
  const target = name.value.trim().toLowerCase();
  const quantity = (value: string): string =>
    `${Number(value).toFixed(current.tokenPrecision)} ${current.symbol}`;
  const actions: ActionInput[] = [
    {
      account: current.systemContract,
      name: 'newaccount',
      authorization,
      data: {
        creator: wallet.account,
        name: target,
        owner: authority(ownerKey.value.trim()),
        active: authority(activeKey.value.trim()),
      },
    },
    {
      account: current.systemContract,
      name: 'buyrambytes',
      authorization,
      data: { payer: wallet.account, receiver: target, bytes: ramBytes.value },
    },
  ];
  if (current.stakedResources) {
    actions.push({
      account: current.systemContract,
      name: 'delegatebw',
      authorization,
      data: {
        from: wallet.account,
        receiver: target,
        stake_net_quantity: quantity(stakeNet.value),
        stake_cpu_quantity: quantity(stakeCpu.value),
        transfer: transfer.value,
      },
    });
  }
  void run(actions);
}
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-5 md:gap-6">
    <PageHeader :title="t('create_direct_title')" :eyebrow="app.currentWallet?.account" />

    <EmptyState v-if="!app.currentWallet" :title="t('home_no_wallet')" />

    <form v-else class="bg-card flex flex-col gap-4 rounded-lg border p-4" @submit.prevent="create">
      <p class="text-muted-foreground text-sm">{{ t('create_direct_description') }}</p>

      <div class="flex flex-col gap-2">
        <Label for="create-name">{{ t('create_account_name_label') }}</Label>
        <Input
          id="create-name"
          v-model="name"
          class="font-mono"
          maxlength="12"
          autocomplete="off"
          spellcheck="false"
        />
        <p
          v-if="availability !== 'idle'"
          class="text-xs"
          :class="availability === 'available' ? 'text-positive' : 'text-muted-foreground'"
        >
          {{ t(`create_account_${availability}`) }}
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <Label for="create-owner">{{ t('create_direct_owner_key') }}</Label>
          <Button type="button" variant="ghost" size="sm" @click="generate">
            <RefreshCw />
            {{ t('create_direct_generate') }}
          </Button>
        </div>
        <Input id="create-owner" v-model="ownerKey" class="font-mono text-xs" spellcheck="false" />
      </div>

      <div class="flex flex-col gap-2">
        <Label for="create-active">{{ t('create_direct_active_key') }}</Label>
        <Input
          id="create-active"
          v-model="activeKey"
          class="font-mono text-xs"
          spellcheck="false"
        />
      </div>

      <div
        v-if="generated"
        class="border-warning/40 bg-warning/10 flex flex-wrap items-center gap-2 rounded-md border p-3 text-xs"
      >
        <ShieldAlert class="text-warning size-4 shrink-0" />
        <span class="flex-1">{{ t('create_direct_generated_warning') }}</span>
        <Button type="button" variant="outline" size="sm" @click="downloadKeys">
          <Download />
          {{ t('create_account_owner_save') }}
        </Button>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="flex flex-col gap-2">
          <Label for="create-ram">{{ t('create_direct_ram') }}</Label>
          <Input id="create-ram" v-model.number="ramBytes" type="number" min="64" class="num" />
        </div>
        <template v-if="chain?.stakedResources">
          <div class="flex flex-col gap-2">
            <Label for="create-cpu">{{ t('create_direct_cpu') }}</Label>
            <Input id="create-cpu" v-model="stakeCpu" class="num" inputmode="decimal" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="create-net">{{ t('create_direct_net') }}</Label>
            <Input id="create-net" v-model="stakeNet" class="num" inputmode="decimal" />
          </div>
        </template>
      </div>

      <label
        v-if="chain?.stakedResources"
        for="create-transfer"
        class="flex cursor-pointer items-center gap-2 text-xs"
      >
        <Checkbox
          id="create-transfer"
          :model-value="transfer"
          @update:model-value="(next) => (transfer = next === true)"
        />
        <span>{{ t('create_direct_transfer') }}</span>
      </label>

      <Button type="submit" class="self-start" :disabled="!valid || !transact.canSign.value">
        <UserPlus />
        {{ t('create_direct_action') }}
      </Button>
    </form>

    <TransactionResultDialog
      v-model:open="transact.open.value"
      :busy="transact.busy.value"
      :result="transact.result.value"
      @proceed="transact.proceedWithFee"
      @retry="run(lastActions)"
    />
  </div>
</template>
