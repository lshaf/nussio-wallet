<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { ArrowLeft } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import BackupRestore from '@/features/tools/components/BackupRestore.vue';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const router = useRouter();
const app = useAppStore();

async function done(): Promise<void> {
  await app.load();
  await router.push(app.setupRoute ?? '/');
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <p class="eyebrow">{{ t('setup_restore_eyebrow') }}</p>
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('setup_restore_title') }}</h1>
      <p class="text-muted-foreground text-sm">{{ t('setup_restore_subtitle') }}</p>
    </div>
    <BackupRestore @restored="done" />
    <Button variant="ghost" class="self-start" @click="router.push('/setup')">
      <ArrowLeft />
      {{ t('action_back') }}
    </Button>
  </div>
</template>
