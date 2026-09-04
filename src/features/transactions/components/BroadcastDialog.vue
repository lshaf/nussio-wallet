<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useTimeAgo } from '@vueuse/core';
import { Radio } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRequestService, useTransactionService } from '@/composables/useServices';
import type { InspectResult, TransactResult } from '@/services/transaction.service';
import { useAppStore } from '@/stores/app.store';
import ActionList from './ActionList.vue';
import TransactionResultDialog from './TransactionResultDialog.vue';

const open = defineModel<boolean>('open', { default: false });

const { t } = useTranslation('ext');
const app = useAppStore();
const transactionService = useTransactionService();
const requestService = useRequestService();

const tab = ref('json');
const text = ref('');
const esr = ref('');
const inspecting = ref(false);
const inspected = ref<InspectResult | null>(null);
const resultOpen = ref(false);
const busy = ref(false);
const result = ref<TransactResult | null>(null);

const detail = computed(() => (inspected.value?.kind === 'transaction' ? inspected.value : null));
const expiresAgo = useTimeAgo(
  computed(() => (detail.value ? Date.parse(`${detail.value.expiration}Z`) : Date.now())),
);

watch(open, (value) => {
  if (!value) {
    text.value = '';
    esr.value = '';
    inspected.value = null;
  }
});

async function inspect(): Promise<void> {
  if (!app.settings.chainId || text.value.trim().length === 0) return;
  inspecting.value = true;
  inspected.value = await transactionService.inspect(app.settings.chainId, text.value);
  inspecting.value = false;
  if (inspected.value.kind === 'esr') {
    await requestService.open(inspected.value.uri);
    open.value = false;
  }
}

async function onFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  text.value = await file.text();
  await inspect();
}

async function openRequest(): Promise<void> {
  if (esr.value.trim().length === 0) return;
  await requestService.open(esr.value.trim());
  open.value = false;
}

async function broadcast(): Promise<void> {
  if (!app.settings.chainId || !detail.value?.signed) return;
  resultOpen.value = true;
  busy.value = true;
  result.value = null;
  result.value = await transactionService.broadcast(app.settings.chainId, text.value);
  busy.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Radio class="size-5" />
          {{ t('broadcast_title') }}
        </DialogTitle>
        <DialogDescription>{{ t('broadcast_description') }}</DialogDescription>
      </DialogHeader>

      <div v-if="detail" class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <Badge :variant="detail.signed ? 'default' : 'secondary'">{{
            detail.signed ? t('broadcast_signed') : t('broadcast_unsigned')
          }}</Badge>
          <Badge v-if="detail.expired" variant="destructive">{{ t('broadcast_expired') }}</Badge>
          <span class="text-muted-foreground text-xs">{{
            t('tx_expires_relative', { time: expiresAgo })
          }}</span>
        </div>
        <ActionList :actions="detail.actions" />
        <details class="text-xs">
          <summary class="text-muted-foreground cursor-pointer">{{ t('broadcast_raw') }}</summary>
          <pre
            class="bg-muted mt-2 max-h-48 overflow-auto rounded-md p-2 font-mono whitespace-pre-wrap"
            >{{
              JSON.stringify(
                { signatures: detail.signatures, transaction: detail.transaction },
                null,
                2,
              )
            }}</pre>
        </details>
        <p v-if="!detail.signed" class="text-warning text-xs">{{ t('broadcast_not_signed') }}</p>
      </div>

      <Tabs v-else v-model="tab">
        <TabsList class="h-auto flex-wrap">
          <TabsTrigger value="json">{{ t('broadcast_tab_json') }}</TabsTrigger>
          <TabsTrigger value="file">{{ t('broadcast_tab_file') }}</TabsTrigger>
          <TabsTrigger value="esr">{{ t('broadcast_tab_esr') }}</TabsTrigger>
        </TabsList>
        <TabsContent value="json" class="flex flex-col gap-3">
          <textarea
            v-model="text"
            rows="8"
            class="bg-background w-full rounded-md border p-2 font-mono text-xs"
            :placeholder="t('broadcast_json_placeholder')"
            spellcheck="false"
          />
          <p v-if="inspected?.kind === 'invalid'" class="text-destructive text-sm">
            {{ t('broadcast_invalid') }}
          </p>
          <Button
            class="self-end"
            :disabled="inspecting || text.trim().length === 0"
            @click="inspect"
            >{{ t('broadcast_load') }}</Button
          >
        </TabsContent>
        <TabsContent value="file" class="flex flex-col gap-3">
          <p class="text-muted-foreground text-sm">{{ t('broadcast_file_description') }}</p>
          <input type="file" accept="application/json,.json" class="text-sm" @change="onFile" />
          <p v-if="inspected?.kind === 'invalid'" class="text-destructive text-sm">
            {{ t('broadcast_invalid') }}
          </p>
        </TabsContent>
        <TabsContent value="esr" class="flex flex-col gap-3">
          <p class="text-muted-foreground text-sm">{{ t('broadcast_esr_description') }}</p>
          <textarea
            v-model="esr"
            rows="4"
            class="bg-background w-full rounded-md border p-2 font-mono text-xs"
            placeholder="esr://…"
            spellcheck="false"
          />
          <Button class="self-end" :disabled="esr.trim().length === 0" @click="openRequest">{{
            t('broadcast_open_request')
          }}</Button>
        </TabsContent>
      </Tabs>

      <DialogFooter v-if="detail" class="gap-2">
        <Button variant="ghost" @click="inspected = null">{{ t('action_back') }}</Button>
        <Button :disabled="!detail.signed || detail.expired" @click="broadcast">{{
          t('broadcast_action')
        }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  <TransactionResultDialog v-model:open="resultOpen" :busy="busy" :result="result" />
</template>
