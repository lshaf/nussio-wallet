<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useClipboard } from '@vueuse/core';
import { Check, Copy, Download } from 'lucide-vue-next';
import { toDataURL } from 'qrcode';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TransactResult } from '@/services/transaction.service';
import ActionList from './ActionList.vue';

const props = defineProps<{ result: Extract<TransactResult, { status: 'unsigned' }> }>();
const { t } = useTranslation('ext');
const { copy, copied } = useClipboard();
const copiedEsr = ref(false);
const qr = ref('');

const json = computed(() => JSON.stringify(props.result.file, null, 2));

function download(): void {
  const blob = new Blob([json.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `anchor-unsigned-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyEsr(): Promise<void> {
  await navigator.clipboard.writeText(props.result.esr);
  copiedEsr.value = true;
  setTimeout(() => (copiedEsr.value = false), 3000);
}

onMounted(async () => {
  qr.value = await toDataURL(props.result.esr, { margin: 1, scale: 5 });
});
</script>

<template>
  <Tabs default-value="sign">
    <TabsList class="h-auto flex-wrap">
      <TabsTrigger value="sign">{{ t('tx_unsigned_tab_sign') }}</TabsTrigger>
      <TabsTrigger value="tx">{{ t('tx_unsigned_tab_transaction') }}</TabsTrigger>
    </TabsList>
    <TabsContent value="sign" class="flex flex-col gap-4">
      <p class="text-muted-foreground text-sm">{{ t('tx_unsigned_description') }}</p>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" @click="download">
          <Download />
          {{ t('tx_unsigned_download') }}
        </Button>
        <Button variant="outline" size="sm" @click="copy(json)">
          <Check v-if="copied" />
          <Copy v-else />
          {{ copied ? t('action_copied') : t('tx_unsigned_copy') }}
        </Button>
      </div>
      <div class="flex flex-col gap-3 sm:flex-row">
        <img v-if="qr" :src="qr" class="size-40 shrink-0 rounded-md border bg-white" alt="" />
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <p class="eyebrow">{{ t('tx_unsigned_esr') }}</p>
          <p class="text-muted-foreground text-xs">{{ t('tx_unsigned_esr_description') }}</p>
          <code
            class="bg-muted max-h-24 overflow-auto rounded-md p-2 font-mono text-[11px] break-all"
            >{{ result.esr }}</code
          >
          <Button variant="outline" size="sm" class="self-start" @click="copyEsr">
            <Check v-if="copiedEsr" />
            <Copy v-else />
            {{ copiedEsr ? t('action_copied') : t('tx_unsigned_copy_esr') }}
          </Button>
        </div>
      </div>
      <p class="text-muted-foreground text-xs">
        {{ t('tx_expires_at', { time: result.expiration }) }}
      </p>
    </TabsContent>
    <TabsContent value="tx" class="flex flex-col gap-3">
      <ActionList :actions="result.actions" />
      <pre
        class="bg-muted max-h-64 overflow-auto rounded-md p-3 font-mono text-[11px] whitespace-pre-wrap"
        >{{ JSON.stringify(result.transaction, null, 2) }}</pre>
    </TabsContent>
  </Tabs>
</template>
