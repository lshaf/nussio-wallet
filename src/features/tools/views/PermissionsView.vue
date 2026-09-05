<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { KeyRound, Lock, Pencil, Plus } from 'lucide-vue-next';
import EmptyState from '@/components/shared/EmptyState.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import UnlockDialog from '@/components/dialogs/UnlockDialog.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAccountData } from '@/composables/useAccountData';
import type { ActionInput } from '@/lib/antelope/transaction';
import type { PermissionSummary } from '@/services/account.service';
import { useAppStore } from '@/stores/app.store';
import TransactionResultDialog from '@/features/transactions/components/TransactionResultDialog.vue';
import { useTransact } from '@/features/transactions/composables/useTransact';
import PermissionEditor from '../components/PermissionEditor.vue';

const { t } = useTranslation('ext');
const app = useAppStore();
const transact = useTransact();

const account = computed(() => app.currentWallet?.account);
const query = useAccountData(() => app.settings.chainId, account);
const editorOpen = ref(false);
const editing = ref<PermissionSummary>();
const unlockOpen = ref(false);
let lastActions: ActionInput[] = [];

const permissions = computed(() => query.data.value?.permissions ?? []);
const signer = computed(() => {
  const wallet = app.currentWallet;
  return wallet ? { actor: wallet.account, permission: wallet.authorization } : undefined;
});
const canSign = computed(() => transact.canSign.value);
const canCreate = computed(() => app.settings.advancedPermissions || app.settings.advancedOptions);

function edit(permission?: PermissionSummary): void {
  editing.value = permission;
  editorOpen.value = true;
}

async function run(actions: ActionInput[]): Promise<void> {
  lastActions = actions;
  await transact.run(actions);
}
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-5 md:gap-6">
    <PageHeader :title="t('permissions_title')" :eyebrow="account">
      <template #actions>
        <Button v-if="canCreate" size="sm" :disabled="!canSign" @click="edit()">
          <Plus />
          {{ t('permissions_create') }}
        </Button>
      </template>
    </PageHeader>

    <EmptyState v-if="!app.currentWallet" :title="t('home_no_wallet')" />

    <template v-else>
      <div
        v-if="transact.needsUnlock.value"
        class="bg-card flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
      >
        <Lock class="text-muted-foreground size-4" />
        <span class="flex-1">{{ t('resources_locked') }}</span>
        <Button size="sm" variant="outline" @click="unlockOpen = true">{{
          t('action_unlock')
        }}</Button>
      </div>

      <p class="text-muted-foreground text-sm">{{ t('permissions_description') }}</p>

      <div v-if="permissions.length === 0" class="bg-muted h-40 animate-pulse rounded-lg" />
      <div
        v-for="permission in permissions"
        v-else
        :key="permission.name"
        class="bg-card flex flex-col gap-3 rounded-lg border p-4"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-sm font-medium">{{ permission.name }}</span>
          <Badge variant="secondary">{{
            t('permissions_threshold_badge', { count: permission.threshold })
          }}</Badge>
          <span v-if="permission.parent" class="text-muted-foreground text-xs"
            >{{ t('permissions_parent') }}: {{ permission.parent }}</span
          >
          <Button
            variant="ghost"
            size="icon-sm"
            class="ml-auto"
            :aria-label="t('action_edit')"
            :disabled="!canSign"
            @click="edit(permission)"
          >
            <Pencil />
          </Button>
        </div>

        <div v-if="permission.keys.length > 0" class="flex flex-col gap-1.5">
          <p class="eyebrow">{{ t('permissions_keys') }}</p>
          <div v-for="key in permission.keys" :key="key.key" class="flex items-start gap-2 text-xs">
            <KeyRound class="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
            <code class="min-w-0 flex-1 font-mono break-all">{{ key.key }}</code>
            <span class="num text-muted-foreground">+{{ key.weight }}</span>
          </div>
        </div>

        <div v-if="permission.accounts.length > 0" class="flex flex-col gap-1.5">
          <p class="eyebrow">{{ t('permissions_accounts') }}</p>
          <div
            v-for="entry in permission.accounts"
            :key="`${entry.actor}@${entry.permission}`"
            class="flex items-center gap-2 text-xs"
          >
            <code class="min-w-0 flex-1 font-mono">{{ entry.actor }}@{{ entry.permission }}</code>
            <span class="num text-muted-foreground">+{{ entry.weight }}</span>
          </div>
        </div>
      </div>
    </template>

    <PermissionEditor
      v-if="app.currentChain && account && signer"
      v-model:open="editorOpen"
      :chain="app.currentChain"
      :account="account"
      :permission="editing"
      :signer="signer"
      @confirm="run"
    />
    <UnlockDialog v-model:open="unlockOpen" />
    <TransactionResultDialog
      v-model:open="transact.open.value"
      :busy="transact.busy.value"
      :result="transact.result.value"
      @proceed="transact.proceedWithFee"
      @retry="run(lastActions)"
    />
  </div>
</template>
