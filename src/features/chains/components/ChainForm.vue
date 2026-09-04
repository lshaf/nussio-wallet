<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChainService } from '@/composables/useServices';
import { blockchainSchema, chainFeatureSchema, type Blockchain } from '@/lib/storage/schemas';

const props = defineProps<{ chain?: Blockchain }>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ saved: [chain: Blockchain] }>();

const { t } = useTranslation('ext');
const chainService = useChainService();

const form = reactive({
  name: '',
  chainId: '',
  node: '',
  symbol: '',
  keyPrefix: 'EOS',
  tokenPrecision: 4,
  testnet: false,
  features: [] as string[],
});

const isNew = computed(() => !props.chain);
const features = chainFeatureSchema.options;

const parsed = computed(() =>
  blockchainSchema.safeParse({
    id: props.chain?.id ?? `custom-${form.chainId.slice(0, 8)}`,
    chainId: form.chainId.trim().toLowerCase(),
    name: form.name.trim(),
    node: form.node.trim(),
    symbol: form.symbol.trim().toUpperCase(),
    keyPrefix: form.keyPrefix.trim() || 'EOS',
    tokenPrecision: Number(form.tokenPrecision),
    testnet: form.testnet,
    features: form.features,
    custom: props.chain?.custom ?? true,
    tokenContract: props.chain?.tokenContract,
    systemContract: props.chain?.systemContract,
    stakedResources: props.chain?.stakedResources,
    voteDecayPeriodWeeks: props.chain?.voteDecayPeriodWeeks,
    ramSymbol: props.chain?.ramSymbol,
  }),
);

watch(
  () => [open.value, props.chain] as const,
  ([isOpen, chain]) => {
    if (!isOpen) return;
    form.name = chain?.name ?? '';
    form.chainId = chain?.chainId ?? '';
    form.node = chain?.node ?? 'https://';
    form.symbol = chain?.symbol ?? '';
    form.keyPrefix = chain?.keyPrefix ?? 'EOS';
    form.tokenPrecision = chain?.tokenPrecision ?? 4;
    form.testnet = chain?.testnet ?? false;
    form.features = [...(chain?.features ?? [])];
  },
  { immediate: true },
);

function toggleFeature(feature: string, checked: boolean | 'indeterminate'): void {
  form.features =
    checked === true
      ? [...new Set([...form.features, feature])]
      : form.features.filter((entry) => entry !== feature);
}

async function save(): Promise<void> {
  if (!parsed.value.success) return;
  await chainService.upsert(parsed.value.data);
  emit('saved', parsed.value.data);
  open.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <form class="flex flex-col gap-4" @submit.prevent="save">
        <DialogHeader>
          <DialogTitle>{{
            isNew ? t('chain_form_title_new') : t('chain_form_title_edit')
          }}</DialogTitle>
        </DialogHeader>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-2 sm:col-span-2">
            <Label for="chain-name">{{ t('chain_form_name') }}</Label>
            <Input id="chain-name" v-model="form.name" />
          </div>
          <div class="flex flex-col gap-2 sm:col-span-2">
            <Label for="chain-id">{{ t('chain_form_chain_id') }}</Label>
            <Input
              id="chain-id"
              v-model="form.chainId"
              class="font-mono"
              :disabled="!isNew"
              maxlength="64"
            />
          </div>
          <div class="flex flex-col gap-2 sm:col-span-2">
            <Label for="chain-node">{{ t('node_label') }}</Label>
            <Input id="chain-node" v-model="form.node" type="url" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="chain-symbol">{{ t('chain_form_symbol') }}</Label>
            <Input id="chain-symbol" v-model="form.symbol" maxlength="7" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="chain-prefix">{{ t('chain_form_prefix') }}</Label>
            <Input id="chain-prefix" v-model="form.keyPrefix" maxlength="4" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="chain-precision">{{ t('chain_form_precision') }}</Label>
            <Input
              id="chain-precision"
              v-model="form.tokenPrecision"
              type="number"
              min="0"
              max="18"
            />
          </div>
          <div class="flex items-center gap-2 self-end pb-2">
            <Checkbox id="chain-testnet" v-model="form.testnet" />
            <Label for="chain-testnet">{{ t('chain_form_testnet') }}</Label>
          </div>
          <div class="flex flex-col gap-2 sm:col-span-2">
            <Label>{{ t('chain_form_features') }}</Label>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div v-for="feature in features" :key="feature" class="flex items-center gap-2">
                <Checkbox
                  :id="`feature-${feature}`"
                  :model-value="form.features.includes(feature)"
                  @update:model-value="(value) => toggleFeature(feature, value)"
                />
                <Label :for="`feature-${feature}`" class="font-mono text-xs">{{ feature }}</Label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" @click="open = false">{{
            t('action_cancel')
          }}</Button>
          <Button type="submit" :disabled="!parsed.success">{{ t('action_save') }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
