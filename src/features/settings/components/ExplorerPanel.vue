<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CUSTOM_EXPLORER, defaultExplorer, explorerOptions } from '@/lib/antelope/explorers';
import type { Blockchain } from '@/lib/storage/schemas';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();
const custom = ref<Record<string, boolean>>({});

const chains = computed(() =>
  app.enabledChains.length > 0 ? app.enabledChains : app.visibleChains.slice(0, 1),
);

function stored(chain: Blockchain): string {
  return app.settings.blockExplorers[chain.chainId] ?? '';
}

function selection(chain: Blockchain): string {
  const value = stored(chain);
  if (custom.value[chain.chainId]) return CUSTOM_EXPLORER;
  const match = explorerOptions(chain).find((option) => option.template === value);
  if (match) return match.id;
  if (value.length > 0) return CUSTOM_EXPLORER;
  return explorerOptions(chain)[0]?.id ?? CUSTOM_EXPLORER;
}

function setExplorer(chain: Blockchain, template: string): void {
  const explorers = { ...app.settings.blockExplorers };
  if (template.length === 0) delete explorers[chain.chainId];
  else explorers[chain.chainId] = template;
  void app.updateSettings({ blockExplorers: explorers });
}

function select(chain: Blockchain, value: unknown): void {
  if (typeof value !== 'string') return;
  if (value === CUSTOM_EXPLORER) {
    custom.value = { ...custom.value, [chain.chainId]: true };
    if (stored(chain).length === 0) setExplorer(chain, defaultExplorer(chain) ?? '');
    return;
  }
  custom.value = { ...custom.value, [chain.chainId]: false };
  const option = explorerOptions(chain).find((entry) => entry.id === value);
  setExplorer(chain, option?.template ?? '');
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="eyebrow">{{ t('settings_explorers') }}</h2>
    <div class="bg-card divide-y rounded-lg border">
      <div v-for="chain in chains" :key="chain.chainId" class="flex flex-col gap-2 px-4 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <Label :for="`explorer-${chain.id}`">{{ chain.name }}</Label>
          <Select :model-value="selection(chain)" @update:model-value="(v) => select(chain, v)">
            <SelectTrigger :id="`explorer-${chain.id}`" class="w-44" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in explorerOptions(chain)"
                :key="option.id"
                :value="option.id"
                >{{ option.label }}</SelectItem
              >
              <SelectItem :value="CUSTOM_EXPLORER">{{ t('settings_explorer_custom') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          v-if="selection(chain) === CUSTOM_EXPLORER"
          class="font-mono text-xs"
          :placeholder="t('settings_explorer_placeholder')"
          :model-value="stored(chain)"
          @change="
            (event: Event) => setExplorer(chain, (event.target as HTMLInputElement).value.trim())
          "
        />
      </div>
    </div>
    <p class="text-muted-foreground text-xs">{{ t('settings_explorer_hint') }}</p>
  </section>
</template>
