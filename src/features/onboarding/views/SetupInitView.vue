<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { ArrowRight, Upload } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const router = useRouter();
const app = useAppStore();

function start(): void {
  void router.push(app.status.initialized ? '/setup/chains' : '/setup/password');
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <div class="flex flex-col gap-3">
      <p class="eyebrow">{{ t('setup_welcome_eyebrow') }}</p>
      <h1 class="display-num text-4xl font-semibold tracking-tight md:text-5xl">
        {{ t('setup_welcome_title') }}
      </h1>
      <p class="text-muted-foreground max-w-md text-base">{{ t('setup_welcome_subtitle') }}</p>
    </div>
    <div class="flex flex-col gap-3">
      <Button size="lg" class="w-full justify-between" @click="start">
        {{ t('setup_welcome_start') }}
        <ArrowRight />
      </Button>
      <div class="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
        <div class="flex flex-col">
          <span class="text-sm font-medium">{{ t('setup_welcome_backup_title') }}</span>
          <span class="text-muted-foreground text-xs">{{ t('setup_welcome_backup_soon') }}</span>
        </div>
        <Button variant="outline" size="sm" disabled>
          <Upload />
          {{ t('action_import') }}
        </Button>
      </div>
    </div>
  </div>
</template>
