<script setup lang="ts">
import { ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useClipboard } from '@vueuse/core';
import { Check, Copy, Eye, ShieldAlert } from 'lucide-vue-next';
import { toDataURL } from 'qrcode';
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

const props = defineProps<{ publicKey: string }>();
const open = defineModel<boolean>('open', { default: false });

const { t } = useTranslation('ext');
const walletService = useWalletService();
const { copy, copied } = useClipboard();

const password = ref('');
const wif = ref('');
const qr = ref('');
const busy = ref(false);
const failed = ref(false);

watch(open, (value) => {
  if (value) return;
  password.value = '';
  wif.value = '';
  qr.value = '';
  failed.value = false;
});

async function submit(): Promise<void> {
  busy.value = true;
  failed.value = false;
  try {
    wif.value = await walletService.exportKey(props.publicKey, password.value);
    qr.value = await toDataURL(wif.value, { margin: 1, scale: 5 });
    password.value = '';
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
      <DialogHeader>
        <DialogTitle>{{ t('keys_reveal_title') }}</DialogTitle>
        <DialogDescription>{{ t('keys_reveal_description') }}</DialogDescription>
      </DialogHeader>

      <form v-if="!wif" class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-2">
          <Label for="reveal-password">{{ t('password_label') }}</Label>
          <Input
            id="reveal-password"
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
          <Button type="submit" :disabled="busy || password.length === 0">
            <Eye />
            {{ t('keys_reveal_action') }}
          </Button>
        </DialogFooter>
      </form>

      <div v-else class="flex flex-col gap-3">
        <div
          class="border-destructive/40 bg-destructive/10 flex gap-2 rounded-md border p-3 text-xs"
        >
          <ShieldAlert class="text-destructive size-4 shrink-0" />
          <span>{{ t('keys_reveal_warning') }}</span>
        </div>
        <img v-if="qr" :src="qr" class="size-40 self-center rounded-md border bg-white" alt="" />
        <code class="bg-muted rounded-md p-2 font-mono text-[11px] break-all">{{ wif }}</code>
        <Button variant="outline" size="sm" class="self-start" @click="copy(wif)">
          <Check v-if="copied" />
          <Copy v-else />
          {{ copied ? t('action_copied') : t('action_copy') }}
        </Button>
        <DialogFooter>
          <Button variant="ghost" @click="open = false">{{ t('action_close') }}</Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>
