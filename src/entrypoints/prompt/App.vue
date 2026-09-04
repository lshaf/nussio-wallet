<script setup lang="ts">
import { onMounted, ref } from 'vue';
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
  <div class="bg-background text-foreground flex h-screen flex-col">
    <header class="flex h-16 items-center justify-between border-b px-6">
      <h1 class="font-semibold">Signing Request</h1>
      <span class="text-muted-foreground text-xs">{{ request?.status ?? 'loading' }}</span>
    </header>
    <main class="flex-1 overflow-auto p-6">
      <pre class="text-muted-foreground text-xs break-all whitespace-pre-wrap">{{
        request?.uri
      }}</pre>
    </main>
    <footer class="flex h-20 items-center justify-end gap-2 border-t px-6">
      <button
        type="button"
        class="bg-secondary text-secondary-foreground rounded-md px-3 py-2 text-sm font-medium"
        @click="cancel"
      >
        Cancel
      </button>
    </footer>
  </div>
</template>
