<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { AlertTriangle } from 'lucide-vue-next';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ActionList from '@/features/transactions/components/ActionList.vue';
import type { RequestSigner } from '@/lib/storage/schemas';
import type { RequestView } from '@/services/request.service';
import { useAppStore } from '@/stores/app.store';
import Countdown from './Countdown.vue';
import FuelBanner from './FuelBanner.vue';
import SignerSelect from './SignerSelect.vue';

const props = defineProps<{ view: RequestView }>();
const emit = defineEmits<{ signer: [signer: RequestSigner]; expired: [] }>();
const { t } = useTranslation('ext');
const app = useAppStore();
const tab = ref('overview');

const summary = computed(() =>
  props.view.actions
    .filter((action) => action.account !== 'greymassnoop')
    .map((action) => ({
      key: `${action.account}::${action.name}`,
      fields: Object.entries(action.data)
        .slice(0, 4)
        .map(([name, value]) => ({
          name,
          value: typeof value === 'string' ? value : JSON.stringify(value),
        })),
    })),
);

function setCloseOnComplete(value: boolean | 'indeterminate'): void {
  void app.updateSettings({ promptCloseOnComplete: value === true });
}
</script>

<template>
  <div class="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
    <aside class="flex flex-col gap-4">
      <div class="bg-card flex flex-col gap-2 rounded-lg border p-3">
        <p class="eyebrow">{{ t('prompt_sign_as') }}</p>
        <SignerSelect
          v-if="view.chainId"
          :wallets="view.wallets"
          :signer="view.signer"
          :chain-id="view.chainId"
          :disabled="!view.placeholders && !view.signerMissing"
          @change="(signer) => emit('signer', signer)"
        />
        <p v-if="view.signerMissing && view.requestedSigner" class="text-warning text-xs">
          {{
            t('prompt_signer_missing', {
              signer: `${view.requestedSigner.actor}@${view.requestedSigner.permission}`,
            })
          }}
        </p>
      </div>
      <dl class="bg-card grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-lg border p-3 text-xs">
        <template v-if="view.expiration">
          <dt class="text-muted-foreground">{{ t('prompt_expires') }}</dt>
          <dd class="text-right">
            <Countdown :expiration="view.expiration" @expired="emit('expired')" />
          </dd>
        </template>
        <dt class="text-muted-foreground">{{ t('prompt_broadcast') }}</dt>
        <dd class="text-right">
          {{ view.broadcast ? t('prompt_broadcast_wallet') : t('prompt_broadcast_app') }}
        </dd>
        <template v-if="view.callback">
          <dt class="text-muted-foreground">{{ t('prompt_callback') }}</dt>
          <dd class="truncate text-right font-mono" :title="view.callback.url">
            {{ view.callback.origin }}
          </dd>
        </template>
      </dl>
      <label class="flex items-center gap-2 px-1 text-xs">
        <Checkbox
          :model-value="app.settings.promptCloseOnComplete"
          @update:model-value="setCloseOnComplete"
        />
        <span>{{ t('settings_close_on_complete') }}</span>
      </label>
    </aside>

    <section class="flex min-w-0 flex-col gap-3">
      <div
        v-if="view.forbidden.length > 0"
        class="border-destructive/40 bg-destructive/10 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
      >
        <AlertTriangle class="text-destructive mt-0.5 size-4 shrink-0" />
        <span>{{ t('prompt_dangerous_allowed', { actions: view.forbidden.join(', ') }) }}</span>
      </div>
      <Tabs v-model="tab">
        <TabsList class="h-auto flex-wrap">
          <TabsTrigger value="overview">{{ t('prompt_tab_overview') }}</TabsTrigger>
          <TabsTrigger value="actions">{{ t('prompt_tab_actions') }}</TabsTrigger>
          <TabsTrigger value="raw">{{ t('prompt_tab_raw') }}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" class="flex flex-col gap-3">
          <FuelBanner v-if="view.fuel.provider || view.fuel.fee" :fee="view.fuel.fee" />
          <ol class="flex flex-col gap-2">
            <li
              v-for="(entry, index) in summary"
              :key="`${index}-${entry.key}`"
              class="bg-card rounded-lg border p-3"
            >
              <p class="font-mono text-sm font-medium">{{ entry.key }}</p>
              <dl
                v-if="entry.fields.length > 0"
                class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs"
              >
                <template v-for="field in entry.fields" :key="field.name">
                  <dt class="text-muted-foreground font-mono">{{ field.name }}</dt>
                  <dd class="font-mono break-all">{{ field.value }}</dd>
                </template>
              </dl>
            </li>
          </ol>
        </TabsContent>
        <TabsContent value="actions">
          <ActionList :actions="view.actions" />
        </TabsContent>
        <TabsContent value="raw">
          <pre
            class="bg-card max-h-80 overflow-auto rounded-lg border p-3 font-mono text-[11px] whitespace-pre-wrap"
            >{{ JSON.stringify(view.transaction, null, 2) }}</pre>
        </TabsContent>
      </Tabs>
    </section>
  </div>
</template>
