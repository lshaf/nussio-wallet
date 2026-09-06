<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { ArrowLeft } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { hidSupported } from '@/lib/ledger/hid';
import ChainSwitcher from '@/components/layout/ChainSwitcher.vue';
import type { Wallet } from '@/lib/storage/schemas';
import { useAppStore } from '@/stores/app.store';
import ImportDetect from '../components/ImportDetect.vue';
import ImportLedger from '../components/ImportLedger.vue';
import ImportManual from '../components/ImportManual.vue';
import ImportPrivateKey from '../components/ImportPrivateKey.vue';
import ImportWatch from '../components/ImportWatch.vue';

const { t } = useTranslation('ext');
const router = useRouter();
const app = useAppStore();
const tab = ref('key');
const ledgerSupported = hidSupported();
const canCancel = computed(() => app.setupRoute === null);

async function onImported(wallets: Wallet[]): Promise<void> {
  const first = wallets[0];
  if (first && !app.currentWallet) await app.selectWallet(first);
  await app.load();
  await router.push('/');
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('setup_import_title') }}</h1>
      <p class="text-muted-foreground text-sm">
        {{ t('setup_import_description', { chain: app.currentChain?.name ?? '' }) }}
      </p>
      <ChainSwitcher class="mt-1" />
    </div>
    <div class="bg-card rounded-xl border p-4 md:p-6">
      <Tabs v-model="tab">
        <TabsList class="mb-4 h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value="key">{{ t('import_tab_key') }}</TabsTrigger>
          <TabsTrigger value="watch">{{ t('import_tab_watch') }}</TabsTrigger>
          <TabsTrigger value="detect">{{ t('import_tab_detect') }}</TabsTrigger>
          <TabsTrigger v-if="ledgerSupported" value="ledger">
            {{ t('import_tab_ledger') }}
          </TabsTrigger>
          <TabsTrigger v-if="app.settings.advancedOptions" value="manual">{{
            t('import_tab_manual')
          }}</TabsTrigger>
        </TabsList>
        <TabsContent value="key"><ImportPrivateKey @imported="onImported" /></TabsContent>
        <TabsContent value="watch"><ImportWatch @imported="onImported" /></TabsContent>
        <TabsContent value="detect"><ImportDetect @imported="onImported" /></TabsContent>
        <TabsContent v-if="ledgerSupported" value="ledger">
          <ImportLedger @imported="onImported" />
        </TabsContent>
        <TabsContent value="manual"><ImportManual @imported="onImported" /></TabsContent>
      </Tabs>
    </div>
    <Button v-if="canCancel" variant="ghost" class="self-start" @click="router.push('/')">
      <ArrowLeft />
      {{ t('action_cancel') }}
    </Button>
  </div>
</template>
