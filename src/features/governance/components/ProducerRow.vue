<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Info } from 'lucide-vue-next';
import DangerLink from '@/components/shared/DangerLink.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatNumber } from '@/lib/antelope/format';
import type { Producer } from '@/composables/useServices';

const props = defineProps<{
  producer: Producer;
  selected: boolean;
  disabled: boolean;
  voted: boolean;
}>();
const emit = defineEmits<{ toggle: []; details: [] }>();

const { t } = useTranslation('ext');
const votes = computed(() => formatNumber(props.producer.share, 2));
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-2.5">
    <Checkbox
      :id="`producer-${producer.owner}`"
      :model-value="selected"
      :disabled="disabled && !selected"
      @update:model-value="emit('toggle')"
    />
    <span class="num text-muted-foreground w-6 shrink-0 text-xs">{{ producer.rank }}</span>
    <label :for="`producer-${producer.owner}`" class="flex min-w-0 flex-1 cursor-pointer flex-col">
      <span class="flex items-center gap-2">
        <span class="font-mono text-sm font-medium">{{ producer.owner }}</span>
        <span v-if="voted" class="text-primary text-[10px] font-semibold uppercase">{{
          t('governance_voted')
        }}</span>
      </span>
      <DangerLink v-if="producer.url" :href="producer.url" class="truncate text-xs">{{
        producer.url.replace(/^https?:\/\//, '')
      }}</DangerLink>
    </label>
    <span class="num text-right text-xs">{{ votes }} %</span>
    <Button
      variant="ghost"
      size="icon-sm"
      :aria-label="t('governance_details')"
      @click="emit('details')"
    >
      <Info />
    </Button>
  </div>
</template>
