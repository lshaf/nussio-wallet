<script setup lang="ts">
import { ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-vue-next';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useChainService } from '@/composables/useServices';
import { chainLogo } from '@/lib/antelope/logos';
import type { Blockchain } from '@/lib/storage/schemas';
import { useAppStore } from '@/stores/app.store';
import ChainForm from '../components/ChainForm.vue';

const { t } = useTranslation('ext');
const app = useAppStore();
const chainService = useChainService();

const formOpen = ref(false);
const editing = ref<Blockchain | undefined>();

async function toggleEnabled(chain: Blockchain, checked: boolean | 'indeterminate'): Promise<void> {
  const enabled = new Set(app.settings.enabledChains);
  if (checked === true) enabled.add(chain.chainId);
  else enabled.delete(chain.chainId);
  await chainService.setEnabled([...enabled]);
  await app.load();
}

async function togglePinned(chain: Blockchain): Promise<void> {
  const pinned = new Set(app.settings.pinnedChains);
  if (pinned.has(chain.chainId)) pinned.delete(chain.chainId);
  else pinned.add(chain.chainId);
  await app.updateSettings({ pinnedChains: [...pinned] });
}

function edit(chain?: Blockchain): void {
  editing.value = chain;
  formOpen.value = true;
}

async function remove(chain: Blockchain): Promise<void> {
  await chainService.remove(chain.chainId);
  await app.load();
}
</script>

<template>
  <div class="flex flex-col gap-5 md:gap-6">
    <PageHeader :title="t('nav_chains')">
      <template #actions>
        <Button size="sm" @click="edit()">
          <Plus />
          {{ t('action_add_chain') }}
        </Button>
      </template>
    </PageHeader>

    <ul class="bg-card divide-y rounded-lg border">
      <li
        v-for="chain in app.visibleChains"
        :key="chain.chainId"
        class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
        :class="app.settings.enabledChains.includes(chain.chainId) ? '' : 'opacity-70'"
      >
        <Checkbox
          :id="`chain-toggle-${chain.id}`"
          :model-value="app.settings.enabledChains.includes(chain.chainId)"
          :aria-label="t('chain_enabled')"
          @update:model-value="(value) => toggleEnabled(chain, value)"
        />
        <img
          v-if="chainLogo(chain.id)"
          :src="chainLogo(chain.id)"
          class="size-7 rounded-full"
          alt=""
        />
        <div class="flex min-w-0 flex-1 flex-col">
          <div class="flex flex-wrap items-center gap-2">
            <label :for="`chain-toggle-${chain.id}`" class="font-medium">{{ chain.name }}</label>
            <Badge v-if="chain.testnet" variant="outline">{{ t('chain_testnet') }}</Badge>
            <Badge v-if="chain.custom" variant="secondary">{{ t('chain_custom') }}</Badge>
            <Badge v-if="app.settings.pinnedChains.includes(chain.chainId)" variant="secondary">{{
              t('chain_pinned')
            }}</Badge>
          </div>
          <span class="text-muted-foreground truncate font-mono text-xs">{{ chain.node }}</span>
        </div>
        <div class="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="t('chain_pinned')"
            @click="togglePinned(chain)"
          >
            <PinOff v-if="app.settings.pinnedChains.includes(chain.chainId)" />
            <Pin v-else />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="t('chain_form_title_edit')"
            @click="edit(chain)"
          >
            <Pencil />
          </Button>
          <Button
            v-if="chain.custom"
            variant="ghost"
            size="icon-sm"
            :aria-label="t('action_remove')"
            @click="remove(chain)"
          >
            <Trash2 />
          </Button>
        </div>
      </li>
    </ul>
    <ChainForm v-model:open="formOpen" :chain="editing" @saved="app.load()" />
  </div>
</template>
