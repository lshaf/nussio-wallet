<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppMark from '@/components/shared/AppMark.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRequestService } from '@/composables/useServices';
import type { PendingRequest } from '@/lib/storage/schemas';

const requestService = useRequestService();
const request = ref<PendingRequest | undefined>();
const requestId = new URLSearchParams(window.location.search).get('id') ?? '';

async function cancel(): Promise<void> {
  if (requestId) await requestService.cancel(requestId);
  window.close();
}

onMounted(async () => {
  request.value = await requestService.get(requestId);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') void cancel();
  });
});
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="bg-card flex h-14 items-center justify-between border-b px-5">
      <div class="flex items-center gap-3">
        <AppMark size="sm" :wordmark="false" />
        <h1 class="font-semibold">Signing request</h1>
      </div>
      <Badge variant="secondary">{{ request?.status ?? 'loading' }}</Badge>
    </header>
    <main class="flex-1 overflow-auto p-5">
      <p class="eyebrow mb-2">Request</p>
      <pre
        class="bg-card text-muted-foreground rounded-lg border p-3 font-mono text-xs break-all whitespace-pre-wrap"
        >{{ request?.uri }}</pre>
    </main>
    <footer class="bg-card flex h-16 items-center justify-end gap-2 border-t px-5">
      <Button variant="outline" @click="cancel">Cancel</Button>
    </footer>
  </div>
</template>
