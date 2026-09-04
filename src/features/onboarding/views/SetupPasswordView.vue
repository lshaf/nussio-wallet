<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { ShieldAlert } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWalletService } from '@/composables/useServices';
import { useAppStore } from '@/stores/app.store';

const MIN_LENGTH = 8;

const { t } = useTranslation('ext');
const router = useRouter();
const app = useAppStore();
const walletService = useWalletService();

const password = ref('');
const confirm = ref('');
const busy = ref(false);

const error = computed(() => {
  if (password.value.length > 0 && password.value.length < MIN_LENGTH)
    return t('password_too_short');
  if (confirm.value.length > 0 && confirm.value !== password.value) return t('password_mismatch');
  return '';
});
const valid = computed(
  () => password.value.length >= MIN_LENGTH && confirm.value === password.value,
);

async function submit(): Promise<void> {
  if (!valid.value) return;
  busy.value = true;
  try {
    if (!app.status.initialized) await walletService.initialize(password.value);
    await app.refreshStatus();
    await router.push('/setup/chains');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('setup_password_title') }}</h1>
      <p class="text-muted-foreground text-sm">{{ t('setup_password_description') }}</p>
    </div>
    <form class="bg-card flex flex-col gap-4 rounded-xl border p-4 md:p-6" @submit.prevent="submit">
      <div class="flex flex-col gap-2">
        <Label for="password">{{ t('password_label') }}</Label>
        <Input
          id="password"
          v-model="password"
          type="password"
          autocomplete="new-password"
          autofocus
        />
      </div>
      <div class="flex flex-col gap-2">
        <Label for="password-confirm">{{ t('password_confirm_label') }}</Label>
        <Input
          id="password-confirm"
          v-model="confirm"
          type="password"
          autocomplete="new-password"
        />
        <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
      </div>
      <div
        class="border-warning/40 bg-warning/10 flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm"
      >
        <ShieldAlert class="text-warning mt-0.5 size-4 shrink-0" />
        <div>
          <p class="font-medium">{{ t('setup_password_warning_title') }}</p>
          <p class="text-muted-foreground">{{ t('setup_password_warning') }}</p>
        </div>
      </div>
      <div class="flex justify-between gap-2">
        <Button type="button" variant="ghost" @click="router.push('/setup')">{{
          t('action_back')
        }}</Button>
        <Button type="submit" :disabled="!valid || busy">{{ t('setup_password_submit') }}</Button>
      </div>
    </form>
  </div>
</template>
