<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { chainLogo } from '@/lib/antelope/logos';
import { useAppStore } from '@/stores/app.store';

const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });
const { t } = useTranslation('ext');
const app = useAppStore();

const current = computed(() => app.currentChain);
const triggerClass = computed(() => (props.compact ? 'w-auto gap-1.5 px-2' : 'w-full'));

function onChange(value: unknown): void {
  if (typeof value === 'string' && value !== app.settings.chainId) void app.selectChain(value);
}
</script>

<template>
  <div :class="compact ? 'shrink-0' : 'min-w-0 md:w-56'">
    <Select :model-value="app.settings.chainId ?? undefined" @update:model-value="onChange">
      <SelectTrigger :class="triggerClass" :aria-label="t('nav_chains')">
        <template v-if="current">
          <img
            v-if="chainLogo(current.id)"
            :src="chainLogo(current.id)"
            class="size-5 rounded-full"
            alt=""
          />
          <span
            class="truncate text-sm font-medium"
            :class="compact ? 'max-w-[7.5rem]' : 'min-w-0 flex-1 text-left'"
            >{{ current.name }}</span
          >
          <Badge v-if="!compact && current.testnet" variant="outline" class="text-[10px]">{{
            t('chain_testnet')
          }}</Badge>
        </template>
        <span v-else class="text-muted-foreground text-sm">{{ t('nav_chains') }}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="chain in app.enabledChains" :key="chain.chainId" :value="chain.chainId">
          <span class="flex items-center gap-2">
            <img
              v-if="chainLogo(chain.id)"
              :src="chainLogo(chain.id)"
              class="size-4 rounded-full"
              alt=""
            />
            {{ chain.name }}
            <Badge v-if="chain.testnet" variant="outline" class="text-[10px]">{{
              t('chain_testnet')
            }}</Badge>
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
