<script setup lang="ts">
import { ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useClipboard } from '@vueuse/core';
import { Check, Copy, Download, RefreshCw, Save, ShieldAlert } from 'lucide-vue-next';
import { PrivateKey } from '@wharfkit/antelope';
import { Button } from '@/components/ui/button';
import PasswordConfirmDialog from '@/components/dialogs/PasswordConfirmDialog.vue';
import { useWalletService } from '@/composables/useServices';

const emit = defineEmits<{ saved: [] }>();

const { t } = useTranslation('ext');
const walletService = useWalletService();
const { copy, copied } = useClipboard();

const wif = ref('');
const publicKey = ref('');
const saveOpen = ref(false);
const saved = ref(false);
const error = ref('');

function generate(): void {
  const key = PrivateKey.generate('K1');
  wif.value = key.toWif();
  publicKey.value = String(key.toPublic());
  saved.value = false;
  error.value = '';
}

function download(): void {
  const blob = new Blob([`PUBLIC: ${publicKey.value}\nPRIVATE: ${wif.value}\n`], {
    type: 'text/plain',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nussio-key-${publicKey.value.slice(-8)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

async function save(password: string): Promise<void> {
  try {
    await walletService.importKey(wif.value, password);
    saved.value = true;
    emit('saved');
  } catch {
    error.value = t('keys_save_failed');
  }
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="eyebrow">{{ t('keys_generator_title') }}</h2>
    <div class="bg-card flex flex-col gap-4 rounded-lg border p-4">
      <p class="text-muted-foreground text-sm">{{ t('keys_generator_description') }}</p>
      <Button variant="outline" size="sm" class="self-start" @click="generate">
        <RefreshCw />
        {{ t('keys_generator_action') }}
      </Button>

      <template v-if="wif">
        <div class="border-warning/40 bg-warning/10 flex gap-2 rounded-md border p-3 text-xs">
          <ShieldAlert class="text-warning size-4 shrink-0" />
          <span>{{ t('keys_generator_warning') }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <p class="eyebrow">{{ t('keys_public') }}</p>
          <code class="bg-muted rounded-md p-2 font-mono text-[11px] break-all">{{
            publicKey
          }}</code>
        </div>
        <div class="flex flex-col gap-1">
          <p class="eyebrow">{{ t('keys_private') }}</p>
          <code class="bg-muted rounded-md p-2 font-mono text-[11px] break-all">{{ wif }}</code>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" @click="copy(wif)">
            <Check v-if="copied" />
            <Copy v-else />
            {{ copied ? t('action_copied') : t('keys_copy_private') }}
          </Button>
          <Button variant="outline" size="sm" @click="download">
            <Download />
            {{ t('keys_download') }}
          </Button>
          <Button size="sm" :disabled="saved" @click="saveOpen = true">
            <Save />
            {{ saved ? t('keys_saved') : t('keys_save') }}
          </Button>
        </div>
        <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
      </template>
    </div>
    <PasswordConfirmDialog v-model:open="saveOpen" @confirm="save" />
  </section>
</template>
