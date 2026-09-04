<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import { usePriceFeed } from '@/composables/useChainData';
import { formatNumber } from '@/lib/antelope/format';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();
const feed = usePriceFeed(() => app.settings.chainId);
</script>

<template>
  <span
    v-if="feed.data.value"
    class="bg-card num inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
  >
    <span class="bg-positive size-1.5 rounded-full" />
    {{
      t('price_usd', {
        price: formatNumber(feed.data.value.usd, 4),
        symbol: app.currentChain?.symbol ?? '',
      })
    }}
  </span>
</template>
