<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useDebounceFn } from '@vueuse/core';
import { Download, ShieldAlert, UserPlus } from 'lucide-vue-next';
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
import PasswordConfirmDialog from '@/components/dialogs/PasswordConfirmDialog.vue';
import { usePendingService } from '@/composables/useServices';
import { accountNameSchema } from '@/lib/storage/schemas';
import { useAppStore } from '@/stores/app.store';

const emit = defineEmits<{ created: [] }>();

const { t } = useTranslation('ext');
const app = useAppStore();
const service = usePendingService();

const name = ref('');
const availability = ref<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
const passwordOpen = ref(false);
const busy = ref(false);
const error = ref('');
const ownerOpen = ref(false);
const ownerKey = ref('');
const activeKey = ref('');
const exported = ref(false);

const valid = computed(() => availability.value === 'available');

const check = useDebounceFn(async (value: string) => {
  const chainId = app.settings.chainId;
  if (!chainId || !accountNameSchema.safeParse(value).success || value.length !== 12) {
    availability.value = value.length === 0 ? 'idle' : 'invalid';
    return;
  }
  availability.value = 'checking';
  try {
    const status = await service.checkName(chainId, value);
    availability.value = status === 'taken' ? 'taken' : 'available';
  } catch {
    availability.value = 'invalid';
  }
}, 400);

watch(name, (value) => {
  void check(value.trim().toLowerCase());
});

async function create(password: string): Promise<void> {
  const chainId = app.settings.chainId;
  if (!chainId || !valid.value) return;
  busy.value = true;
  error.value = '';
  try {
    const created = await service.create(chainId, name.value.trim().toLowerCase(), password);
    ownerKey.value = created.ownerKey;
    activeKey.value = created.activeKey;
    exported.value = false;
    ownerOpen.value = true;
    name.value = '';
    availability.value = 'idle';
    emit('created');
  } catch {
    error.value = t('create_account_failed');
  } finally {
    busy.value = false;
  }
}

function downloadKeys(): void {
  const blob = new Blob([`ACTIVE: ${activeKey.value}\nOWNER: ${ownerKey.value}\n`], {
    type: 'text/plain',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nussio-owner-key-${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
  exported.value = true;
}

function closeOwner(): void {
  if (!exported.value) return;
  ownerOpen.value = false;
  ownerKey.value = '';
  activeKey.value = '';
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="eyebrow">{{ t('create_account_title') }}</h2>
    <form
      class="bg-card flex flex-col gap-4 rounded-lg border p-4"
      @submit.prevent="passwordOpen = true"
    >
      <p class="text-muted-foreground text-sm">{{ t('create_account_description') }}</p>
      <div class="flex flex-col gap-2">
        <Label for="create-account-name">{{ t('create_account_name_label') }}</Label>
        <Input
          id="create-account-name"
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
      <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
      <Button type="submit" class="self-start" :disabled="busy || !valid || !app.settings.chainId">
        <UserPlus />
        {{ t('create_account_action') }}
      </Button>
    </form>

    <PasswordConfirmDialog v-model:open="passwordOpen" @confirm="create" />

    <Dialog :open="ownerOpen" @update:open="closeOwner">
      <DialogContent
        class="sm:max-w-md"
        :show-close-button="exported"
        @escape-key-down="(event: Event) => !exported && event.preventDefault()"
        @pointer-down-outside="(event: Event) => !exported && event.preventDefault()"
      >
        <DialogHeader>
          <DialogTitle>{{ t('create_account_owner_title') }}</DialogTitle>
          <DialogDescription>{{ t('create_account_owner_description') }}</DialogDescription>
        </DialogHeader>
        <div
          class="border-destructive/40 bg-destructive/10 flex gap-2 rounded-md border p-3 text-xs"
        >
          <ShieldAlert class="text-destructive size-4 shrink-0" />
          <span>{{ t('create_account_owner_warning') }}</span>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="downloadKeys">
            <Download />
            {{ t('create_account_owner_save') }}
          </Button>
          <Button :disabled="!exported" @click="closeOwner">{{
            t('create_account_owner_done')
          }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
