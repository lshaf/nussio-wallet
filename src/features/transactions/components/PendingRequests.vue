<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { BellRing } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { useRequestService } from '@/composables/useServices';
import { pendingRequestsItem } from '@/lib/storage/items';
import type { PendingRequest } from '@/lib/storage/schemas';

const { t } = useTranslation('ext');
const service = useRequestService();
const pending = ref<PendingRequest[]>([]);
let unwatch: (() => void) | undefined;

function active(list: PendingRequest[]): PendingRequest[] {
  return list.filter((entry) => !['done', 'error', 'cancelled'].includes(entry.status));
}

onMounted(async () => {
  pending.value = active(await service.list());
  unwatch = pendingRequestsItem.watch((value) => {
    pending.value = active(value);
  });
});

onBeforeUnmount(() => unwatch?.());
</script>

<template>
  <div
    v-if="pending.length > 0"
    class="border-warning/40 bg-warning/10 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm"
  >
    <BellRing class="text-warning size-4 shrink-0" />
    <span class="flex-1">{{ t('pending_requests', { count: pending.length }) }}</span>
    <Button size="sm" variant="outline" @click="service.focus(pending[0]!.id)">{{
      t('pending_review')
    }}</Button>
  </div>
</template>
