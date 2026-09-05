<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useTimeAgo } from '@vueuse/core';
import { ArrowDownLeft, ArrowUpRight, History } from 'lucide-vue-next';
import DangerLink from '@/components/shared/DangerLink.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Button } from '@/components/ui/button';
import { useHistoryService, type HistoryAction } from '@/composables/useServices';
import { transactionUrl } from '@/lib/antelope/explorers';
import { useAppStore } from '@/stores/app.store';

const PAGE = 25;

const { t } = useTranslation('ext');
const app = useAppStore();
const service = useHistoryService();

const actions = ref<HistoryAction[]>([]);
const loading = ref(false);
const error = ref('');
const done = ref(false);

const account = computed(() => app.currentWallet?.account);

function direction(entry: HistoryAction): 'in' | 'out' | null {
  if (!entry.transfer || !account.value) return null;
  if (entry.transfer.to === account.value) return 'in';
  if (entry.transfer.from === account.value) return 'out';
  return null;
}

function explorer(entry: HistoryAction): string | null {
  const chain = app.currentChain;
  return chain ? transactionUrl(chain, entry.transactionId, app.settings) : null;
}

async function load(reset = false): Promise<void> {
  const chainId = app.settings.chainId;
  if (!chainId || !account.value) return;
  loading.value = true;
  error.value = '';
  if (reset) {
    actions.value = [];
    done.value = false;
  }
  try {
    const page = await service.getActions(chainId, account.value, {
      skip: actions.value.length,
      limit: PAGE,
    });
    actions.value = [...actions.value, ...page.actions];
    done.value = page.actions.length < PAGE;
  } catch {
    error.value = t('history_unavailable');
    done.value = true;
  } finally {
    loading.value = false;
  }
}

watch([() => app.settings.chainId, account], () => void load(true));
onMounted(() => void load(true));
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-5 md:gap-6">
    <PageHeader :title="t('history_title')" :eyebrow="account">
      <template #actions>
        <Button variant="outline" size="sm" :disabled="loading" @click="load(true)">{{
          t('overview_refresh')
        }}</Button>
      </template>
    </PageHeader>

    <EmptyState v-if="!app.currentWallet" :title="t('home_no_wallet')" />
    <p v-else-if="error" class="text-muted-foreground text-sm">{{ error }}</p>
    <EmptyState
      v-else-if="!loading && actions.length === 0"
      :title="t('history_empty')"
      :description="t('history_empty_description')"
    >
      <template #icon><History class="text-muted-foreground size-6" /></template>
    </EmptyState>

    <div v-if="actions.length > 0" class="bg-card divide-y rounded-lg border">
      <div v-for="entry in actions" :key="entry.id" class="flex items-start gap-3 px-4 py-3">
        <component
          :is="direction(entry) === 'in' ? ArrowDownLeft : ArrowUpRight"
          class="mt-0.5 size-4 shrink-0"
          :class="
            direction(entry) === 'in'
              ? 'text-positive'
              : direction(entry) === 'out'
                ? 'text-warning'
                : 'text-muted-foreground'
          "
        />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="truncate text-sm">{{ entry.summary }}</span>
          <span v-if="entry.transfer?.memo" class="text-muted-foreground truncate text-xs">{{
            entry.transfer.memo
          }}</span>
          <span class="text-muted-foreground font-mono text-[11px]"
            >{{ entry.contract }}::{{ entry.action }}</span
          >
        </div>
        <div class="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span class="text-muted-foreground text-xs">{{
            useTimeAgo(new Date(`${entry.timestamp}Z`)).value
          }}</span>
          <DangerLink v-if="explorer(entry)" :href="explorer(entry)!" class="text-[11px]">{{
            entry.transactionId.slice(0, 8)
          }}</DangerLink>
        </div>
      </div>
    </div>

    <Button
      v-if="actions.length > 0 && !done"
      variant="outline"
      size="sm"
      class="self-center"
      :disabled="loading"
      @click="load()"
      >{{ t('governance_more') }}</Button
    >
  </div>
</template>
