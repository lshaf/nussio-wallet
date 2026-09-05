<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Contact as ContactIcon, Pencil, Plus, Trash2 } from 'lucide-vue-next';
import EmptyState from '@/components/shared/EmptyState.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useContactsService } from '@/composables/useServices';
import { accountNameSchema, type Contact } from '@/lib/storage/schemas';

const { t } = useTranslation('ext');
const service = useContactsService();

const contacts = ref<Contact[]>([]);
const editing = ref<string>();
const formOpen = ref(false);
const accountName = ref('');
const label = ref('');
const defaultMemo = ref('');

const nameValid = computed(() => accountNameSchema.safeParse(accountName.value.trim()).success);
const duplicate = computed(
  () =>
    editing.value !== accountName.value.trim() &&
    contacts.value.some((entry) => entry.accountName === accountName.value.trim()),
);
const valid = computed(() => nameValid.value && !duplicate.value);

function reset(): void {
  editing.value = undefined;
  accountName.value = '';
  label.value = '';
  defaultMemo.value = '';
  formOpen.value = false;
}

function add(): void {
  reset();
  formOpen.value = true;
}

function edit(contact: Contact): void {
  editing.value = contact.accountName;
  accountName.value = contact.accountName;
  label.value = contact.label;
  defaultMemo.value = contact.defaultMemo;
  formOpen.value = true;
}

async function submit(): Promise<void> {
  if (!valid.value) return;
  contacts.value = await service.save(
    {
      accountName: accountName.value.trim(),
      label: label.value.trim(),
      defaultMemo: defaultMemo.value.trim(),
    },
    editing.value,
  );
  reset();
}

async function remove(contact: Contact): Promise<void> {
  contacts.value = await service.remove(contact.accountName);
  if (editing.value === contact.accountName) reset();
}

onMounted(async () => {
  contacts.value = await service.list();
});
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-5 md:gap-6">
    <PageHeader :title="t('contacts_title')" :eyebrow="t('nav_tools')">
      <template #actions>
        <Button size="sm" @click="add">
          <Plus />
          {{ t('contacts_add') }}
        </Button>
      </template>
    </PageHeader>

    <form
      v-if="formOpen"
      class="bg-card flex flex-col gap-4 rounded-lg border p-4"
      @submit.prevent="submit"
    >
      <div class="flex flex-col gap-2">
        <Label for="contact-account">{{ t('contacts_account_label') }}</Label>
        <Input
          id="contact-account"
          v-model="accountName"
          class="font-mono"
          maxlength="12"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-2">
          <Label for="contact-label">{{ t('contacts_label_label') }}</Label>
          <Input id="contact-label" v-model="label" maxlength="40" autocomplete="off" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="contact-memo">{{ t('contacts_memo_label') }}</Label>
          <Input id="contact-memo" v-model="defaultMemo" maxlength="256" autocomplete="off" />
        </div>
      </div>
      <p v-if="accountName && !nameValid" class="text-destructive text-sm">
        {{ t('contacts_error_account') }}
      </p>
      <p v-else-if="duplicate" class="text-destructive text-sm">{{ t('contacts_error_exists') }}</p>
      <div class="flex justify-end gap-2">
        <Button type="button" variant="ghost" @click="reset">{{ t('action_cancel') }}</Button>
        <Button type="submit" :disabled="!valid">{{ t('action_save') }}</Button>
      </div>
    </form>

    <EmptyState
      v-if="contacts.length === 0"
      :title="t('contacts_empty')"
      :description="t('contacts_empty_description')"
    >
      <template #icon><ContactIcon class="text-muted-foreground size-6" /></template>
    </EmptyState>
    <div v-else class="bg-card divide-y rounded-lg border">
      <div
        v-for="contact in contacts"
        :key="contact.accountName"
        class="flex flex-wrap items-center gap-3 px-4 py-3"
      >
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="font-mono text-sm font-medium">{{ contact.accountName }}</span>
          <span v-if="contact.label" class="text-muted-foreground text-xs">{{
            contact.label
          }}</span>
          <span v-if="contact.defaultMemo" class="text-muted-foreground truncate text-xs">
            {{ t('contacts_memo_prefix', { memo: contact.defaultMemo }) }}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          :aria-label="t('action_edit')"
          @click="edit(contact)"
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          :aria-label="t('action_remove')"
          @click="remove(contact)"
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  </div>
</template>
