<script setup lang="ts">
import { ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
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
import { useAppStore } from '@/stores/app.store';

const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ unlocked: [] }>();

const { t } = useTranslation('ext');
const app = useAppStore();
const password = ref('');
const failed = ref(false);
const busy = ref(false);

watch(open, (value) => {
  if (!value) {
    password.value = '';
    failed.value = false;
  }
});

async function submit(): Promise<void> {
  busy.value = true;
  failed.value = !(await app.unlock(password.value));
  busy.value = false;
  if (!failed.value) {
    open.value = false;
    emit('unlocked');
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-sm">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ t('unlock_title') }}</DialogTitle>
          <DialogDescription>{{ t('unlock_description') }}</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-2">
          <Label for="unlock-password">{{ t('password_label') }}</Label>
          <Input
            id="unlock-password"
            v-model="password"
            type="password"
            autofocus
            autocomplete="current-password"
          />
          <p v-if="failed" class="text-destructive text-sm">{{ t('unlock_failed') }}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" @click="open = false">{{
            t('action_cancel')
          }}</Button>
          <Button type="submit" :disabled="busy || password.length === 0">{{
            t('action_unlock')
          }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
