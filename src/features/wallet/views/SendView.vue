<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useDebounceFn } from '@vueuse/core';
import { ArrowRight, Lock, SendHorizontal } from 'lucide-vue-next';
import Amount from '@/components/shared/Amount.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import UnlockDialog from '@/components/dialogs/UnlockDialog.vue';
import { useAccountData, useBalances } from '@/composables/useAccountData';
import { useContactsService, useTransactionService } from '@/composables/useServices';
import { exchangeAccountsFor } from '@/lib/antelope/exchanges';
import { parseAsset } from '@/lib/antelope/format';
import { accountNameSchema, type Contact } from '@/lib/storage/schemas';
import { useAppStore } from '@/stores/app.store';
import TransactionResultDialog from '@/features/transactions/components/TransactionResultDialog.vue';
import { useTransact } from '@/features/transactions/composables/useTransact';

interface TokenOption {
  key: string;
  contract: string;
  symbol: string;
  amount: string;
}

const { t } = useTranslation('ext');
const app = useAppStore();
const transactionService = useTransactionService();
const contactsService = useContactsService();
const transact = useTransact();

const account = computed(() => app.currentWallet?.account);
const chain = computed(() => app.currentChain);
const accountData = useAccountData(() => app.settings.chainId, account);
const balances = useBalances(() => app.settings.chainId, account);

const to = ref('');
const memo = ref('');
const quantity = ref('');
const tokenKey = ref('');
const confirming = ref(false);
const countdown = ref(0);
const destinationHasContract = ref(false);
const unlockOpen = ref(false);
const contacts = ref<Contact[]>([]);
let timer: ReturnType<typeof setInterval> | undefined;

const tokens = computed<TokenOption[]>(() => {
  const current = chain.value;
  if (!current) return [];
  const list: TokenOption[] = [];
  const system = accountData.data.value?.balance;
  if (system) {
    list.push({
      key: `${current.tokenContract}:${current.symbol}`,
      contract: current.tokenContract,
      symbol: current.symbol,
      amount: system,
    });
  }
  for (const balance of balances.data.value ?? []) {
    const key = `${balance.contract}:${balance.symbol}`;
    if (list.some((entry) => entry.key === key)) continue;
    if (parseAsset(balance.amount).amount <= 0) continue;
    list.push({ key, contract: balance.contract, symbol: balance.symbol, amount: balance.amount });
  }
  return list;
});

const selected = computed(
  () => tokens.value.find((entry) => entry.key === tokenKey.value) ?? tokens.value[0],
);
const available = computed(() => (selected.value ? parseAsset(selected.value.amount) : undefined));
const amount = computed(() => Number(quantity.value.replace(/,/g, '')));
const exchanges = computed(() => exchangeAccountsFor(app.settings.chainId ?? ''));
const contact = computed(() =>
  contacts.value.find((entry) => entry.accountName === to.value.trim()),
);

const errors = computed(() => {
  const list: string[] = [];
  const destination = to.value.trim();
  if (destination.length > 0 && !accountNameSchema.safeParse(destination).success)
    list.push('send_error_account');
  if (destination.length > 0 && destination === account.value) list.push('send_error_self');
  if (exchanges.value.includes(destination) && memo.value.trim().length === 0)
    list.push('send_error_exchange_memo');
  if (quantity.value.length > 0 && !(amount.value > 0)) list.push('send_error_quantity');
  if (available.value && amount.value > available.value.amount)
    list.push('send_error_insufficient');
  return list;
});

const warnings = computed(() => {
  const list: string[] = [];
  const text = memo.value.toLowerCase();
  if (exchanges.value.some((name) => text.includes(name))) list.push('send_warning_memo_exchange');
  if (destinationHasContract.value) list.push('send_warning_contract');
  return list;
});

const valid = computed(
  () =>
    Boolean(selected.value) &&
    accountNameSchema.safeParse(to.value.trim()).success &&
    amount.value > 0 &&
    errors.value.length === 0,
);

const formattedQuantity = computed(() =>
  available.value
    ? `${amount.value.toFixed(available.value.precision)} ${available.value.symbol}`
    : '',
);

const checkContract = useDebounceFn(async (name: string) => {
  if (!app.settings.chainId || !accountNameSchema.safeParse(name).success) {
    destinationHasContract.value = false;
    return;
  }
  destinationHasContract.value = await transactionService.hasContract(app.settings.chainId, name);
}, 400);

watch(to, (value) => {
  destinationHasContract.value = false;
  void checkContract(value.trim());
  const match = contacts.value.find((entry) => entry.accountName === value.trim());
  if (match && match.defaultMemo.length > 0 && memo.value.trim().length === 0)
    memo.value = match.defaultMemo;
});

watch(tokens, (list) => {
  if (!list.some((entry) => entry.key === tokenKey.value)) tokenKey.value = list[0]?.key ?? '';
});

function fillMax(): void {
  if (available.value) quantity.value = available.value.amount.toFixed(available.value.precision);
}

function normalizeQuantity(): void {
  if (available.value && amount.value > 0)
    quantity.value = amount.value.toFixed(available.value.precision);
}

function stopTimer(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}

function review(): void {
  if (!valid.value) return;
  normalizeQuantity();
  confirming.value = true;
  countdown.value = 3;
  stopTimer();
  timer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) stopTimer();
  }, 1000);
}

function back(): void {
  confirming.value = false;
  stopTimer();
}

async function submit(): Promise<void> {
  const wallet = app.currentWallet;
  const token = selected.value;
  if (!wallet || !token || !valid.value) return;
  await transact.run([
    {
      account: token.contract,
      name: 'transfer',
      authorization: [{ actor: wallet.account, permission: wallet.authorization }],
      data: {
        from: wallet.account,
        to: to.value.trim(),
        quantity: formattedQuantity.value,
        memo: memo.value,
      },
    },
  ]);
}

watch(
  () => transact.result.value?.status,
  (status) => {
    if (status === 'success') {
      to.value = '';
      memo.value = '';
      quantity.value = '';
      back();
    }
  },
);

onMounted(async () => {
  contacts.value = await contactsService.list();
});

onBeforeUnmount(stopTimer);
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-5 md:gap-6">
    <PageHeader :title="t('send_title')" :eyebrow="chain?.name">
      <template #meta>
        <span v-if="app.currentWallet" class="font-mono text-sm">{{
          app.currentWallet.account
        }}</span>
      </template>
    </PageHeader>

    <EmptyState v-if="!app.currentWallet" :title="t('home_no_wallet')" />

    <div
      v-else-if="transact.needsUnlock.value"
      class="bg-card flex flex-col items-start gap-3 rounded-xl border p-5"
    >
      <Lock class="text-muted-foreground size-6" />
      <div>
        <p class="font-medium">{{ t('send_locked_title') }}</p>
        <p class="text-muted-foreground text-sm">{{ t('send_locked_description') }}</p>
      </div>
      <Button @click="unlockOpen = true">{{ t('action_unlock') }}</Button>
      <UnlockDialog v-model:open="unlockOpen" />
    </div>

    <form
      v-else-if="!confirming"
      class="bg-card flex flex-col gap-4 rounded-xl border p-4 md:p-6"
      @submit.prevent="review"
    >
      <p v-if="app.currentWallet.mode === 'watch'" class="text-muted-foreground text-sm">
        {{ t('send_watch_note') }}
      </p>
      <div class="flex flex-col gap-2">
        <Label for="send-to">{{ t('send_to_label') }}</Label>
        <Input
          id="send-to"
          v-model="to"
          class="font-mono"
          maxlength="12"
          autocomplete="off"
          spellcheck="false"
          list="send-contacts"
        />
        <datalist id="send-contacts">
          <option v-for="entry in contacts" :key="entry.accountName" :value="entry.accountName">
            {{ entry.label || entry.accountName }}
          </option>
        </datalist>
        <p v-if="contact" class="text-muted-foreground text-xs">
          {{ contact.label || t('send_contact_known') }}
        </p>
      </div>
      <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div class="flex flex-col gap-2">
          <Label for="send-token">{{ t('send_token_label') }}</Label>
          <Select v-model="tokenKey">
            <SelectTrigger id="send-token" class="w-full">
              <span v-if="selected" class="flex min-w-0 items-center gap-2">
                <span class="font-medium">{{ selected.symbol }}</span>
                <span class="text-muted-foreground truncate font-mono text-xs">{{
                  selected.contract
                }}</span>
              </span>
              <span v-else class="text-muted-foreground">{{ t('send_token_label') }}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="token in tokens" :key="token.key" :value="token.key">
                <span class="flex items-center gap-2">
                  <span class="font-medium">{{ token.symbol }}</span>
                  <span class="text-muted-foreground font-mono text-xs">{{ token.contract }}</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label for="send-quantity">{{ t('send_quantity_label') }}</Label>
            <button
              type="button"
              class="text-primary text-xs font-medium hover:underline"
              @click="fillMax"
            >
              {{ t('send_max') }}
            </button>
          </div>
          <Input
            id="send-quantity"
            v-model="quantity"
            class="num"
            inputmode="decimal"
            autocomplete="off"
            @blur="normalizeQuantity"
          />
          <p v-if="selected" class="text-muted-foreground num text-xs">
            {{ t('send_available', { amount: selected.amount }) }}
          </p>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="send-memo">{{ t('send_memo_label') }}</Label>
        <Input id="send-memo" v-model="memo" maxlength="256" autocomplete="off" />
      </div>
      <ul v-if="errors.length > 0" class="text-destructive flex flex-col gap-1 text-sm">
        <li v-for="error in errors" :key="error">{{ t(error) }}</li>
      </ul>
      <ul v-if="warnings.length > 0" class="text-warning flex flex-col gap-1 text-sm">
        <li v-for="warning in warnings" :key="warning">{{ t(warning) }}</li>
      </ul>
      <Button type="submit" class="self-end" :disabled="!valid">
        {{ t('action_review') }}
        <ArrowRight />
      </Button>
    </form>

    <div v-else class="bg-card flex flex-col gap-4 rounded-xl border p-4 md:p-6">
      <div>
        <p class="font-medium">{{ t('send_review_title') }}</p>
        <p class="text-muted-foreground text-sm">{{ t('send_review_description') }}</p>
      </div>
      <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt class="text-muted-foreground">{{ t('send_from') }}</dt>
        <dd class="font-mono">{{ app.currentWallet.account }}</dd>
        <dt class="text-muted-foreground">{{ t('send_to') }}</dt>
        <dd class="font-mono">{{ to.trim() }}</dd>
        <dt class="text-muted-foreground">{{ t('send_quantity_label') }}</dt>
        <dd><Amount :value="formattedQuantity" size="md" /></dd>
        <dt class="text-muted-foreground">{{ t('send_memo_label') }}</dt>
        <dd class="break-all">{{ memo || '—' }}</dd>
      </dl>
      <div class="flex justify-between gap-2">
        <Button variant="ghost" @click="back">{{ t('action_back') }}</Button>
        <Button :disabled="countdown > 0 || transact.busy.value" @click="submit">
          <SendHorizontal />
          {{
            countdown > 0 ? t('action_confirm_countdown', { count: countdown }) : t('action_send')
          }}
        </Button>
      </div>
    </div>

    <TransactionResultDialog
      v-model:open="transact.open.value"
      :busy="transact.busy.value"
      :ledger-waiting="transact.ledgerWaiting.value"
      :result="transact.result.value"
      @proceed="transact.proceedWithFee"
      @retry="submit"
    />
  </div>
</template>
