<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { FileCode2, Play, Search, Table2 } from 'lucide-vue-next';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useContractService, type ContractInfo } from '@/composables/useServices';
import type { ActionInput } from '@/lib/antelope/transaction';
import { accountNameSchema } from '@/lib/storage/schemas';
import { useAppStore } from '@/stores/app.store';
import TransactionResultDialog from '@/features/transactions/components/TransactionResultDialog.vue';
import { useTransact } from '@/features/transactions/composables/useTransact';

const { t } = useTranslation('ext');
const app = useAppStore();
const service = useContractService();
const transact = useTransact();

const contract = ref('');
const info = ref<ContractInfo>();
const loading = ref(false);
const error = ref('');
const actionName = ref('');
const fields = ref<Record<string, string>>({});
const tableName = ref('');
const scope = ref('');
const rows = ref<unknown[]>([]);
const tableError = ref('');
const tableLoading = ref(false);
let lastActions: ActionInput[] = [];

const recents = computed(() =>
  app.settings.chainId ? (app.settings.recentContracts[app.settings.chainId] ?? []) : [],
);
const action = computed(() => info.value?.actions.find((entry) => entry.name === actionName.value));
const canSign = computed(() => transact.canSign.value && Boolean(app.currentWallet));

async function load(name = contract.value.trim().toLowerCase()): Promise<void> {
  const chainId = app.settings.chainId;
  if (!chainId || !accountNameSchema.safeParse(name).success) {
    error.value = t('contract_error_name');
    return;
  }
  contract.value = name;
  loading.value = true;
  error.value = '';
  info.value = undefined;
  rows.value = [];
  try {
    info.value = await service.getContract(chainId, name);
    actionName.value = info.value.actions[0]?.name ?? '';
    tableName.value = info.value.tables[0]?.name ?? '';
    scope.value = name;
    const list = [name, ...recents.value.filter((entry) => entry !== name)].slice(0, 8);
    await app.updateSettings({
      recentContracts: { ...app.settings.recentContracts, [chainId]: list },
    });
  } catch {
    error.value = t('contract_error_load');
  } finally {
    loading.value = false;
  }
}

watch(action, (next) => {
  fields.value = Object.fromEntries((next?.fields ?? []).map((field) => [field.name, '']));
});

function placeholderFor(type: string): string {
  if (type.endsWith('[]')) return '[]';
  if (type.startsWith('bool')) return 'true / false';
  if (type.includes('asset')) return `1.0000 ${app.currentChain?.symbol ?? 'EOS'}`;
  return type;
}

function parseValue(type: string, value: string): unknown {
  const raw = value.trim();
  if (type.endsWith('[]') || type.endsWith('?') || raw.startsWith('{') || raw.startsWith('[')) {
    try {
      return JSON.parse(raw.length > 0 ? raw : '[]');
    } catch {
      return raw;
    }
  }
  if (type.startsWith('bool')) return raw === 'true' || raw === '1';
  if (/^(u?int|float)\d*/.test(type) && raw.length > 0 && !Number.isNaN(Number(raw)))
    return Number(raw);
  return raw;
}

async function run(actions: ActionInput[]): Promise<void> {
  lastActions = actions;
  await transact.run(actions);
}

function push(): void {
  const wallet = app.currentWallet;
  const current = action.value;
  if (!wallet || !current || !info.value) return;
  const data = Object.fromEntries(
    current.fields.map((field) => [
      field.name,
      parseValue(field.type, fields.value[field.name] ?? ''),
    ]),
  );
  void run([
    {
      account: info.value.contract,
      name: current.name,
      authorization: [{ actor: wallet.account, permission: wallet.authorization }],
      data,
    },
  ]);
}

async function loadRows(): Promise<void> {
  const chainId = app.settings.chainId;
  if (!chainId || !info.value || !tableName.value) return;
  tableLoading.value = true;
  tableError.value = '';
  try {
    const page = await service.getTableRows(chainId, {
      contract: info.value.contract,
      table: tableName.value,
      scope: scope.value.trim(),
      limit: 25,
    });
    rows.value = page.rows;
    if (page.rows.length === 0) tableError.value = t('contract_table_empty');
  } catch {
    tableError.value = t('contract_table_error');
  } finally {
    tableLoading.value = false;
  }
}
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-5 md:gap-6">
    <PageHeader :title="t('contract_title')" :eyebrow="app.currentChain?.name" />

    <form class="bg-card flex flex-col gap-3 rounded-lg border p-4" @submit.prevent="load()">
      <p class="text-muted-foreground text-sm">{{ t('contract_description') }}</p>
      <div class="flex flex-wrap gap-2">
        <div class="relative min-w-0 flex-1">
          <Search class="text-muted-foreground absolute top-2.5 left-3 size-4" />
          <Input
            v-model="contract"
            class="pl-9 font-mono"
            maxlength="12"
            spellcheck="false"
            :placeholder="t('contract_placeholder')"
          />
        </div>
        <Button type="submit" :disabled="loading">{{ t('contract_load') }}</Button>
      </div>
      <div v-if="recents.length > 0" class="flex flex-wrap gap-1.5">
        <button
          v-for="entry in recents"
          :key="entry"
          type="button"
          class="hover:bg-accent rounded-md border px-2 py-1 font-mono text-xs"
          @click="load(entry)"
        >
          {{ entry }}
        </button>
      </div>
      <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
    </form>

    <Tabs v-if="info" default-value="actions" class="gap-4">
      <TabsList>
        <TabsTrigger value="actions">{{ t('contract_tab_actions') }}</TabsTrigger>
        <TabsTrigger value="tables">{{ t('contract_tab_tables') }}</TabsTrigger>
        <TabsTrigger value="abi">{{ t('contract_tab_abi') }}</TabsTrigger>
      </TabsList>

      <TabsContent value="actions" class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <Label for="contract-action">{{ t('contract_action') }}</Label>
          <div>
            <Select v-model="actionName">
              <SelectTrigger id="contract-action" class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="entry in info.actions" :key="entry.name" :value="entry.name">{{
                  entry.name
                }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div v-if="action" class="bg-card flex flex-col gap-3 rounded-lg border p-4">
          <div v-for="field in action.fields" :key="field.name" class="flex flex-col gap-1.5">
            <Label :for="`field-${field.name}`" class="flex items-center gap-2">
              {{ field.name }}
              <Badge variant="outline" class="font-mono text-[10px]">{{ field.type }}</Badge>
            </Label>
            <Input
              :id="`field-${field.name}`"
              v-model="fields[field.name]"
              class="font-mono text-xs"
              spellcheck="false"
              :placeholder="placeholderFor(field.type)"
            />
          </div>
          <p v-if="action.fields.length === 0" class="text-muted-foreground text-sm">
            {{ t('contract_no_fields') }}
          </p>
          <Button class="self-start" :disabled="!canSign" @click="push">
            <Play />
            {{ t('contract_push') }}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="tables" class="flex flex-col gap-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label for="contract-table">{{ t('contract_table') }}</Label>
            <div>
              <Select v-model="tableName">
                <SelectTrigger id="contract-table" class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="entry in info.tables" :key="entry.name" :value="entry.name">{{
                    entry.name
                  }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <Label for="contract-scope">{{ t('contract_scope') }}</Label>
            <Input id="contract-scope" v-model="scope" class="font-mono" spellcheck="false" />
          </div>
        </div>
        <Button variant="outline" class="self-start" :disabled="tableLoading" @click="loadRows">
          <Table2 />
          {{ t('contract_read') }}
        </Button>
        <p v-if="tableError" class="text-muted-foreground text-sm">{{ tableError }}</p>
        <pre
          v-if="rows.length > 0"
          class="bg-muted max-h-96 overflow-auto rounded-md p-3 font-mono text-[11px] whitespace-pre-wrap"
          >{{ JSON.stringify(rows, null, 2) }}</pre>
      </TabsContent>

      <TabsContent value="abi">
        <pre
          class="bg-muted max-h-96 overflow-auto rounded-md p-3 font-mono text-[11px] whitespace-pre-wrap"
          >{{ JSON.stringify(info.abi, null, 2) }}</pre>
      </TabsContent>
    </Tabs>

    <p v-else-if="loading" class="text-muted-foreground flex items-center gap-2 text-sm">
      <FileCode2 class="size-4" />
      {{ t('contract_loading') }}
    </p>

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
