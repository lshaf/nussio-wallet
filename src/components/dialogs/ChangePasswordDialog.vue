<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { ShieldAlert } from 'lucide-vue-next';
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
import { useWalletService } from '@/composables/useServices';

const MIN_LENGTH = 8;

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ changed: [] }>();

const { t } = useTranslation('ext');
const walletService = useWalletService();

const current = ref('');
const next = ref('');
const confirm = ref('');
const busy = ref(false);
const failed = ref(false);

watch(open, (value) => {
  if (value) return;
  current.value = '';
  next.value = '';
  confirm.value = '';
  failed.value = false;
});

const error = computed(() => {
  if (next.value.length > 0 && next.value.length < MIN_LENGTH) return t('password_too_short');
  if (confirm.value.length > 0 && confirm.value !== next.value) return t('password_mismatch');
  if (next.value.length > 0 && next.value === current.value) return t('password_same');
  return '';
});
const valid = computed(
  () =>
    current.value.length > 0 &&
    next.value.length >= MIN_LENGTH &&
    next.value === confirm.value &&
    next.value !== current.value,
);

async function submit(): Promise<void> {
  if (!valid.value) return;
  busy.value = true;
  failed.value = false;
  try {
    await walletService.changePassword(current.value, next.value);
    open.value = false;
    emit('changed');
  } catch {
    failed.value = true;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-sm">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ t('password_change_title') }}</DialogTitle>
          <DialogDescription>{{ t('password_change_description') }}</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-2">
          <Label for="password-current">{{ t('password_current_label') }}</Label>
          <Input
            id="password-current"
            v-model="current"
            type="password"
            autocomplete="current-password"
            autofocus
          />
          <p v-if="failed" class="text-destructive text-sm">{{ t('unlock_failed') }}</p>
        </div>
        <div class="flex flex-col gap-2">
          <Label for="password-new">{{ t('password_new_label') }}</Label>
          <Input id="password-new" v-model="next" type="password" autocomplete="new-password" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="password-new-confirm">{{ t('password_confirm_label') }}</Label>
          <Input
            id="password-new-confirm"
            v-model="confirm"
            type="password"
            autocomplete="new-password"
          />
          <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
        </div>
        <div
          class="border-warning/40 bg-warning/10 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
        >
          <ShieldAlert class="text-warning mt-0.5 size-4 shrink-0" />
          <span>{{ t('password_change_warning') }}</span>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" @click="open = false">{{
            t('action_cancel')
          }}</Button>
          <Button type="submit" :disabled="!valid || busy">{{
            t('password_change_submit')
          }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
