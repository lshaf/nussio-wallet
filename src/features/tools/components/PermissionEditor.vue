<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Plus, Trash2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildAuthority, checkAuthority } from '@/lib/antelope/authority';
import type { ActionInput } from '@/lib/antelope/transaction';
import { accountNameSchema, permissionNameSchema, type Blockchain } from '@/lib/storage/schemas';
import type { PermissionSummary } from '@/services/account.service';

const props = defineProps<{
  chain: Blockchain;
  account: string;
  permission?: PermissionSummary;
  signer: { actor: string; permission: string };
}>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ confirm: [actions: ActionInput[]] }>();

const { t } = useTranslation('ext');

const name = ref('');
const parent = ref('active');
const threshold = ref(1);
const keys = ref<{ key: string; weight: number }[]>([]);
const accounts = ref<{ actor: string; permission: string; weight: number }[]>([]);

const creating = computed(() => props.permission === undefined);

watch(
  open,
  (isOpen) => {
    if (!isOpen) return;
    const source = props.permission;
    name.value = source?.name ?? '';
    parent.value = source?.parent || (source?.name === 'owner' ? '' : 'active');
    threshold.value = source?.threshold ?? 1;
    keys.value = source ? source.keys.map((entry) => ({ ...entry })) : [];
    accounts.value = source ? source.accounts.map((entry) => ({ ...entry })) : [];
  },
  { immediate: true },
);

const problem = computed(() => {
  if (creating.value && !permissionNameSchema.safeParse(name.value.trim()).success)
    return t('permissions_error_name');
  for (const entry of accounts.value) {
    if (!accountNameSchema.safeParse(entry.actor.trim()).success)
      return t('permissions_error_actor');
  }
  const result = checkAuthority({
    threshold: threshold.value,
    keys: keys.value.filter((entry) => entry.key.trim().length > 0),
    accounts: accounts.value.map((entry) => ({
      actor: entry.actor.trim(),
      permission: entry.permission.trim() || 'active',
      weight: entry.weight,
    })),
  });
  if (!result) return '';
  return t(`permissions_error_${result.code}`, { detail: result.detail ?? '' });
});

function addKey(): void {
  keys.value = [...keys.value, { key: '', weight: 1 }];
}

function addAccount(): void {
  accounts.value = [...accounts.value, { actor: '', permission: 'active', weight: 1 }];
}

function submit(): void {
  if (problem.value) return;
  const auth = buildAuthority({
    threshold: threshold.value,
    keys: keys.value.filter((entry) => entry.key.trim().length > 0),
    accounts: accounts.value.map((entry) => ({
      actor: entry.actor.trim(),
      permission: entry.permission.trim() || 'active',
      weight: entry.weight,
    })),
  });
  emit('confirm', [
    {
      account: props.chain.systemContract,
      name: 'updateauth',
      authorization: [props.signer],
      data: {
        account: props.account,
        permission: creating.value ? name.value.trim() : props.permission!.name,
        parent: creating.value ? parent.value.trim() : props.permission!.parent,
        auth,
      },
    },
  ]);
  open.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-md">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{
            creating
              ? t('permissions_create_title')
              : t('permissions_edit_title', { name: permission?.name })
          }}</DialogTitle>
          <DialogDescription>{{ t('permissions_edit_description') }}</DialogDescription>
        </DialogHeader>

        <div v-if="creating" class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label for="permission-name">{{ t('permissions_name') }}</Label>
            <Input id="permission-name" v-model="name" class="font-mono" maxlength="12" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="permission-parent">{{ t('permissions_parent') }}</Label>
            <Input id="permission-parent" v-model="parent" class="font-mono" maxlength="12" />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="permission-threshold">{{ t('permissions_threshold') }}</Label>
          <Input
            id="permission-threshold"
            v-model.number="threshold"
            type="number"
            min="1"
            class="num w-24"
          />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <p class="eyebrow">{{ t('permissions_keys') }}</p>
            <Button type="button" variant="ghost" size="sm" @click="addKey">
              <Plus />
              {{ t('permissions_add_key') }}
            </Button>
          </div>
          <div v-for="(entry, index) in keys" :key="index" class="flex items-center gap-2">
            <Input
              v-model="entry.key"
              class="min-w-0 flex-1 font-mono text-xs"
              spellcheck="false"
            />
            <Input v-model.number="entry.weight" type="number" min="1" class="num w-16" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              :aria-label="t('action_remove')"
              @click="keys = keys.filter((_, position) => position !== index)"
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <p class="eyebrow">{{ t('permissions_accounts') }}</p>
            <Button type="button" variant="ghost" size="sm" @click="addAccount">
              <Plus />
              {{ t('permissions_add_account') }}
            </Button>
          </div>
          <div v-for="(entry, index) in accounts" :key="index" class="flex items-center gap-2">
            <Input v-model="entry.actor" class="min-w-0 flex-1 font-mono text-xs" maxlength="12" />
            <Input v-model="entry.permission" class="w-24 font-mono text-xs" maxlength="12" />
            <Input v-model.number="entry.weight" type="number" min="1" class="num w-16" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              :aria-label="t('action_remove')"
              @click="accounts = accounts.filter((_, position) => position !== index)"
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        <p v-if="problem" class="text-destructive text-sm">{{ problem }}</p>

        <DialogFooter>
          <Button type="button" variant="ghost" @click="open = false">{{
            t('action_cancel')
          }}</Button>
          <Button type="submit" :disabled="Boolean(problem)">{{ t('permissions_apply') }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
