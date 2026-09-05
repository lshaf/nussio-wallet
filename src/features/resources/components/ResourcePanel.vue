<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import DataList, { type DataListItem } from '@/components/shared/DataList.vue';
import ResourceGauge from '@/components/shared/ResourceGauge.vue';
import { Button } from '@/components/ui/button';
import { useResourceState } from '@/composables/useChainData';
import {
  formatAsset,
  formatBytes,
  formatMicroseconds,
  formatNumber,
  parseAsset,
  percentage,
} from '@/lib/antelope/format';
import type { AccountData } from '@/services/account.service';
import { useAppStore } from '@/stores/app.store';

const props = withDefaults(
  defineProps<{ data: AccountData; kind: 'cpu' | 'net'; canSign?: boolean }>(),
  { canSign: false },
);
const emit = defineEmits<{
  stake: [kind: 'cpu' | 'net'];
  unstake: [kind: 'cpu' | 'net'];
  rent: [mode: 'powerup' | 'rex', kind: 'cpu' | 'net'];
  claim: [];
}>();
const { t } = useTranslation('ext');
const app = useAppStore();

const limit = computed(() => props.data[props.kind]);
const format = computed(() => (props.kind === 'cpu' ? formatMicroseconds : formatBytes));
const showAvailable = computed(() => app.settings.displayResourcesAvailable);
const low = computed(
  () => limit.value.max > 0 && percentage(limit.value.available, limit.value.max) < 10,
);

function pretty(quantity: string | null): string | null {
  if (!quantity) return null;
  const asset = parseAsset(quantity);
  return formatAsset(asset.amount, asset.symbol, asset.precision);
}

const selfStaked = computed(() => props.data.selfDelegated?.[props.kind] ?? null);
const totalStaked = computed(() => props.data.totalResources?.[props.kind] ?? null);
const othersStaked = computed(() => {
  if (!totalStaked.value) return null;
  const total = parseAsset(totalStaked.value);
  const self = selfStaked.value ? parseAsset(selfStaked.value).amount : 0;
  return formatAsset(total.amount - self, total.symbol, total.precision);
});
const refunding = computed(() => props.data.refund?.[props.kind] ?? null);
const features = computed(() => app.currentChain?.features ?? []);
const refundReadyAt = computed(() => {
  if (!props.data.refund) return null;
  return new Date(Date.parse(`${props.data.refund.requestTime}Z`) + 72 * 3600 * 1000);
});

const state = useResourceState(() => app.settings.chainId);
const powerupPrice = computed(() => {
  const info = state.data.value?.powerup;
  if (!info) return undefined;
  return props.kind === 'cpu' ? info.cpuPricePerMs : info.netPricePerKb;
});
const rexPrice = computed(() => {
  const info = state.data.value?.rex;
  if (!info) return undefined;
  return props.kind === 'cpu' ? info.cpuPricePerMs : info.netPricePerKb;
});
const priceUnit = computed(() => (props.kind === 'cpu' ? t('rent_unit_ms') : t('rent_unit_kb')));

function priceLabel(price: number | undefined): string | null {
  if (price === undefined) return null;
  const chain = app.currentChain;
  if (!chain) return null;
  return `${formatNumber(price, Math.max(chain.tokenPrecision, 4))} ${chain.symbol}`;
}

const stakeItems = computed<DataListItem[]>(() => {
  const list: DataListItem[] = [
    { label: t('resources_self_staked'), value: pretty(selfStaked.value) },
    { label: t('resources_others_staked'), value: othersStaked.value },
  ];
  if (refunding.value)
    list.push({ label: t('resources_refunding'), value: pretty(refunding.value), tone: 'warning' });
  if (powerupPrice.value !== undefined)
    list.push({
      label: t('resources_powerup_price', { unit: priceUnit.value }),
      value: priceLabel(powerupPrice.value),
    });
  if (rexPrice.value !== undefined)
    list.push({
      label: t('resources_rex_price', { unit: priceUnit.value }),
      value: priceLabel(rexPrice.value),
    });
  return list;
});
</script>

<template>
  <section class="bg-card flex flex-col gap-4 rounded-xl border p-4 md:p-5">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="eyebrow text-foreground">{{ kind }}</h2>
      <span v-if="low" class="text-warning text-xs font-medium">{{
        t(`resources_status_${kind}_low`)
      }}</span>
    </div>
    <div>
      <p class="eyebrow">{{ showAvailable ? t('resources_available') : t('resources_used') }}</p>
      <p class="display-num mt-1 text-3xl font-semibold leading-none">
        {{ format(showAvailable ? limit.available : limit.used) }}
      </p>
      <ResourceGauge
        :used="showAvailable ? limit.available : limit.used"
        :max="limit.max"
        :warn="low"
        :label="kind"
        class="mt-3"
      />
      <DataList
        class="mt-2"
        size="sm"
        :items="[
          { label: t('resources_used'), value: format(limit.used) },
          { label: t('resources_allowed'), value: format(limit.max) },
        ]"
      />
    </div>
    <DataList :items="stakeItems" />
    <div class="flex flex-wrap gap-2">
      <Button
        v-if="features.includes('powerup') && powerupPrice !== undefined"
        size="sm"
        :disabled="!canSign"
        @click="emit('rent', 'powerup', kind)"
        >{{ t('resources_action_powerup') }}</Button
      >
      <Button
        v-if="features.includes('rex') && rexPrice !== undefined"
        size="sm"
        variant="secondary"
        :disabled="!canSign"
        @click="emit('rent', 'rex', kind)"
        >{{ t('resources_action_rent') }}</Button
      >
      <Button size="sm" variant="outline" :disabled="!canSign" @click="emit('stake', kind)">{{
        t('resources_action_stake')
      }}</Button>
      <Button size="sm" variant="outline" :disabled="!canSign" @click="emit('unstake', kind)">{{
        t('resources_action_unstake')
      }}</Button>
      <Button
        v-if="refundReadyAt && refundReadyAt.getTime() <= Date.now()"
        size="sm"
        :disabled="!canSign"
        @click="emit('claim')"
      >
        {{ t('resources_action_claim') }}
      </Button>
    </div>
  </section>
</template>
