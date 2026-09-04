<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { RefreshCw } from 'lucide-vue-next';
import Amount from '@/components/shared/Amount.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAccountData } from '@/composables/useAccountData';
import { percentage } from '@/lib/antelope/format';
import { useAppStore } from '@/stores/app.store';
import RamPanel from '../components/RamPanel.vue';
import ResourcePanel from '../components/ResourcePanel.vue';

const { t } = useTranslation('ext');
const route = useRoute();
const app = useAppStore();

const account = computed(() => String(route.params.name ?? ''));
const query = useAccountData(() => app.settings.chainId, account);
const data = computed(() => query.data.value);

const status = computed(() => {
  const value = data.value;
  if (!value) return 'ok';
  let result: 'ok' | 'cpu_low' | 'net_low' | 'ram_low' = 'ok';
  if (value.cpu.max === 0 || percentage(value.cpu.available, value.cpu.max) < 10)
    result = 'cpu_low';
  if (value.net.max === 0 || percentage(value.net.available, value.net.max) < 10)
    result = 'net_low';
  if (value.ram.quota > 0 && percentage(value.ram.quota - value.ram.used, value.ram.quota) < 10)
    result = 'ram_low';
  return result;
});
</script>

<template>
  <div class="flex flex-col gap-5 md:gap-6">
    <PageHeader :title="t('resources_title')" :eyebrow="account">
      <template #meta>
        <Badge :variant="status === 'ok' ? 'secondary' : 'destructive'">{{
          t(`resources_status_${status}`)
        }}</Badge>
      </template>
      <template #actions>
        <Amount v-if="data" :value="data.balance" size="md" />
        <Button
          variant="outline"
          size="sm"
          :disabled="query.isFetching.value"
          @click="query.refetch()"
        >
          <RefreshCw :class="query.isFetching.value ? 'animate-spin' : ''" />
          {{ t('overview_refresh') }}
        </Button>
      </template>
    </PageHeader>

    <p v-if="app.currentChain && !app.currentChain.stakedResources" class="text-muted-foreground">
      {{ t('resources_not_supported') }}
    </p>
    <p v-else-if="query.isError.value || (query.isSuccess.value && !data)" class="text-destructive">
      {{ t('overview_error') }}
    </p>
    <div v-else-if="!data" class="grid gap-4 md:grid-cols-2">
      <div v-for="index in 3" :key="index" class="bg-muted h-44 animate-pulse rounded-xl" />
    </div>
    <template v-else>
      <div class="grid gap-4 md:grid-cols-2 md:gap-6">
        <ResourcePanel :data="data" kind="cpu" />
        <ResourcePanel :data="data" kind="net" />
        <RamPanel :data="data" class="md:col-span-2" />
      </div>
      <p class="text-muted-foreground text-sm">{{ t('resources_actions_soon') }}</p>
    </template>
  </div>
</template>
