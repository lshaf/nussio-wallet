<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useGovernanceService } from '@/composables/useServices';
import { useAppStore } from '@/stores/app.store';

const props = defineProps<{ owner: string }>();
const open = defineModel<boolean>('open', { default: false });

const { t } = useTranslation('ext');
const app = useAppStore();
const service = useGovernanceService();
const detail = ref<Record<string, unknown> | null>(null);
const loading = ref(false);

const entries = computed(() =>
  Object.entries(detail.value ?? {})
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .slice(0, 12),
);

watch([open, () => props.owner], async ([isOpen]) => {
  if (!isOpen || !app.settings.chainId) return;
  loading.value = true;
  detail.value = null;
  const result = await service.getProducerDetail(app.settings.chainId, props.owner);
  detail.value = result.json;
  loading.value = false;
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="font-mono">{{ owner }}</DialogTitle>
        <DialogDescription>{{ t('governance_details') }}</DialogDescription>
      </DialogHeader>
      <p v-if="loading" class="text-muted-foreground text-sm">{{ t('overview_loading') }}</p>
      <p v-else-if="entries.length === 0" class="text-muted-foreground text-sm">
        {{ t('governance_details_empty') }}
      </p>
      <dl v-else class="grid max-h-72 grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 overflow-auto text-sm">
        <template v-for="[key, value] in entries" :key="key">
          <dt class="text-muted-foreground">{{ key }}</dt>
          <dd class="break-all">{{ value }}</dd>
        </template>
      </dl>
      <DialogFooter>
        <Button variant="ghost" @click="open = false">{{ t('action_close') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
