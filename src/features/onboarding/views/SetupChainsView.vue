<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useChainService } from '@/composables/useServices';
import { chainLogo } from '@/lib/antelope/logos';
import { useAppStore } from '@/stores/app.store';
import NodeField from '../components/NodeField.vue';

const { t } = useTranslation('ext');
const router = useRouter();
const app = useAppStore();
const chainService = useChainService();

const selected = ref<Set<string>>(new Set());
const busy = ref(false);

const count = computed(() => selected.value.size);

function toggle(chainId: string, checked: boolean | 'indeterminate'): void {
  const next = new Set(selected.value);
  if (checked === true) next.add(chainId);
  else next.delete(chainId);
  selected.value = next;
}

async function submit(): Promise<void> {
  if (count.value === 0) return;
  busy.value = true;
  try {
    await chainService.setEnabled([...selected.value]);
    await app.load();
    await router.push('/setup/import');
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  await app.ready();
  selected.value = new Set(app.settings.enabledChains);
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('setup_chains_title') }}</h1>
      <p class="text-muted-foreground text-sm">{{ t('setup_chains_description') }}</p>
    </div>
    <ul class="bg-card divide-y rounded-xl border">
      <li v-for="chain in app.visibleChains" :key="chain.chainId" class="px-4 py-3">
        <div class="flex items-center gap-3">
          <Checkbox
            :id="`chain-${chain.id}`"
            :model-value="selected.has(chain.chainId)"
            @update:model-value="(value) => toggle(chain.chainId, value)"
          />
          <img
            v-if="chainLogo(chain.id)"
            :src="chainLogo(chain.id)"
            class="size-6 rounded-full"
            alt=""
          />
          <Label
            :for="`chain-${chain.id}`"
            class="flex min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-2"
          >
            <span>{{ chain.name }}</span>
            <span class="text-muted-foreground font-mono text-xs"
              >{{ chain.chainId.slice(0, 8) }}…</span
            >
          </Label>
          <Badge v-if="chain.testnet" variant="outline">{{ t('chain_testnet') }}</Badge>
        </div>
        <div v-if="selected.has(chain.chainId)" class="mt-3 sm:pl-9">
          <NodeField
            :chain-id="chain.chainId"
            :node="chain.node"
            @change="(node) => chainService.setNode(chain.chainId, node)"
          />
        </div>
      </li>
    </ul>
    <p v-if="count === 0" class="text-muted-foreground text-sm">{{ t('setup_chains_none') }}</p>
    <div class="flex justify-between gap-2">
      <Button variant="ghost" @click="router.push('/setup')">{{ t('action_back') }}</Button>
      <Button :disabled="count === 0 || busy" @click="submit">
        {{ count === 1 ? t('setup_chains_submit_one') : t('setup_chains_submit', { count }) }}
      </Button>
    </div>
  </div>
</template>
