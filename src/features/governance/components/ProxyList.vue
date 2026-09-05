<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useQuery } from '@tanstack/vue-query';
import { Search, UserMinus, UserCheck } from 'lucide-vue-next';
import DangerLink from '@/components/shared/DangerLink.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGovernanceService } from '@/composables/useServices';
import type { ActionInput } from '@/lib/antelope/transaction';
import { useAppStore } from '@/stores/app.store';

const PAGE = 20;

defineProps<{ current: string; canSign: boolean }>();
const emit = defineEmits<{ confirm: [actions: ActionInput[]] }>();

const { t } = useTranslation('ext');
const app = useAppStore();
const service = useGovernanceService();
const search = ref('');
const shown = ref(PAGE);

const proxies = useQuery(
  computed(() => ({
    queryKey: ['proxies', app.settings.chainId],
    queryFn: () => service.listProxies(app.settings.chainId!),
    enabled: Boolean(app.settings.chainId),
    refetchInterval: 120_000,
    retry: 1,
  })),
);

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase();
  const list = proxies.data.value ?? [];
  if (term.length === 0) return list;
  return list.filter(
    (proxy) => proxy.owner.includes(term) || proxy.name.toLowerCase().includes(term),
  );
});
const visible = computed(() => filtered.value.slice(0, shown.value));

function setProxy(owner: string): void {
  const wallet = app.currentWallet;
  const chain = app.currentChain;
  if (!wallet || !chain) return;
  emit('confirm', [
    {
      account: chain.systemContract,
      name: 'voteproducer',
      authorization: [{ actor: wallet.account, permission: wallet.authorization }],
      data: { voter: wallet.account, proxy: owner, producers: [] },
    },
  ]);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="current"
      class="bg-card flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
    >
      <span class="flex-1"
        >{{ t('governance_proxying') }}: <span class="font-mono">{{ current }}</span></span
      >
      <Button variant="outline" size="sm" :disabled="!canSign" @click="setProxy('')">
        <UserMinus />
        {{ t('governance_proxy_remove') }}
      </Button>
    </div>

    <div class="relative">
      <Search class="text-muted-foreground absolute top-2.5 left-3 size-4" />
      <Input v-model="search" class="pl-9" :placeholder="t('governance_proxy_search')" />
    </div>

    <EmptyState
      v-if="proxies.isSuccess.value && filtered.length === 0"
      :title="t('governance_proxy_empty')"
    />
    <div v-else-if="!proxies.data.value" class="bg-muted h-48 animate-pulse rounded-lg" />
    <div v-else class="bg-card divide-y rounded-lg border">
      <div
        v-for="proxy in visible"
        :key="proxy.owner"
        class="flex flex-wrap items-center gap-3 px-4 py-3"
      >
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-sm font-medium">{{ proxy.name }}</span>
          <span class="text-muted-foreground font-mono text-xs">{{ proxy.owner }}</span>
          <span v-if="proxy.slogan" class="text-muted-foreground truncate text-xs">{{
            proxy.slogan
          }}</span>
          <DangerLink v-if="proxy.website" :href="proxy.website" class="truncate text-xs">{{
            proxy.website.replace(/^https?:\/\//, '')
          }}</DangerLink>
        </div>
        <Button
          v-if="proxy.owner !== current"
          variant="outline"
          size="sm"
          :disabled="!canSign"
          @click="setProxy(proxy.owner)"
        >
          <UserCheck />
          {{ t('governance_proxy_set') }}
        </Button>
      </div>
    </div>
    <Button
      v-if="visible.length < filtered.length"
      variant="outline"
      size="sm"
      class="self-center"
      @click="shown += PAGE"
      >{{ t('governance_more') }}</Button
    >
  </div>
</template>
