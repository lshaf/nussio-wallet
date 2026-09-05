<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useTimeAgo } from '@vueuse/core';
import { Download, ShieldAlert } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBackupService } from '@/composables/useServices';
import type { BackupFormat } from '@/services/backup.service';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();
const service = useBackupService();

const password = ref('');
const format = ref<BackupFormat>('nussio');
const busy = ref(false);
const error = ref('');
const done = ref(0);

const lastBackup = computed(() => app.settings.lastBackupAt ?? 0);
const ago = useTimeAgo(lastBackup);

async function submit(): Promise<void> {
  if (password.value.length === 0) return;
  busy.value = true;
  error.value = '';
  try {
    const file = await service.createExport(password.value, format.value);
    const blob = new Blob([file.content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    link.click();
    URL.revokeObjectURL(url);
    password.value = '';
    done.value = file.keyCount;
    await app.load();
  } catch {
    error.value = t('backup_error_password');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="eyebrow">{{ t('backup_export_title') }}</h2>
    <form class="bg-card flex flex-col gap-4 rounded-lg border p-4" @submit.prevent="submit">
      <p class="text-muted-foreground text-sm">{{ t('backup_export_description') }}</p>
      <p class="text-muted-foreground text-xs">
        {{ lastBackup > 0 ? t('backup_last', { ago }) : t('backup_never') }}
      </p>

      <fieldset class="flex flex-col gap-2">
        <legend class="eyebrow mb-2">{{ t('backup_format_label') }}</legend>
        <label
          v-for="option in ['nussio', 'desktop'] as BackupFormat[]"
          :key="option"
          class="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"
          :class="format === option ? 'border-primary bg-primary/5' : ''"
        >
          <input
            v-model="format"
            type="radio"
            name="backup-format"
            class="accent-primary mt-0.5"
            :value="option"
          />
          <span class="flex flex-col">
            <span class="font-medium">{{ t(`backup_format_${option}`) }}</span>
            <span class="text-muted-foreground text-xs">{{
              t(`backup_format_${option}_hint`)
            }}</span>
          </span>
        </label>
      </fieldset>

      <div
        v-if="format === 'desktop'"
        class="border-warning/40 bg-warning/10 flex gap-2 rounded-md border p-3 text-xs"
      >
        <ShieldAlert class="text-warning size-4 shrink-0" />
        <span>{{ t('backup_format_desktop_warning') }}</span>
      </div>

      <div class="flex flex-col gap-2">
        <Label for="backup-password">{{ t('backup_password_label') }}</Label>
        <Input id="backup-password" v-model="password" type="password" autocomplete="off" />
      </div>

      <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
      <p v-else-if="done > 0" class="text-positive text-sm">
        {{ t('backup_export_done', { count: done }) }}
      </p>

      <Button type="submit" class="self-start" :disabled="busy || password.length === 0">
        <Download />
        {{ t('backup_export_action') }}
      </Button>
    </form>
  </section>
</template>
