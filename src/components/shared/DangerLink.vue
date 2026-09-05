<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { ExternalLink } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAppStore } from '@/stores/app.store';

const props = defineProps<{ href: string; icon?: boolean }>();

const { t } = useTranslation('ext');
const app = useAppStore();
const open = ref(false);

const host = computed(() => {
  try {
    return new URL(props.href).host;
  } catch {
    return props.href;
  }
});

function activate(event: MouseEvent): void {
  if (app.settings.skipLinkModal) return;
  event.preventDefault();
  open.value = true;
}

function proceed(): void {
  open.value = false;
  window.open(props.href, '_blank', 'noopener,noreferrer');
}
</script>

<template>
  <a
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="text-primary inline-flex items-center gap-1.5 hover:underline"
    @click="activate"
  >
    <slot />
    <ExternalLink v-if="icon !== false" class="size-3.5" />
  </a>

  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ t('danger_link_title') }}</DialogTitle>
        <DialogDescription>{{ t('danger_link_description', { host }) }}</DialogDescription>
      </DialogHeader>
      <code class="bg-muted rounded-md p-2 font-mono text-[11px] break-all">{{ href }}</code>
      <DialogFooter>
        <Button variant="ghost" @click="open = false">{{ t('action_cancel') }}</Button>
        <Button @click="proceed">{{ t('danger_link_continue') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
