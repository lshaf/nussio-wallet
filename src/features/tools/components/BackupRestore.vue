<script setup lang="ts">
import { ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { FileUp, Upload } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DataList from '@/components/shared/DataList.vue';
import { useBackupService } from '@/composables/useServices';
import type { BackupImportResult, BackupPreview } from '@/services/backup.service';
import { useAppStore } from '@/stores/app.store';

const emit = defineEmits<{ restored: [BackupImportResult] }>();

const { t } = useTranslation('ext');
const app = useAppStore();
const service = useBackupService();

const input = ref<HTMLInputElement>();
const filename = ref('');
const content = ref('');
const preview = ref<BackupPreview>();
const backupPassword = ref('');
const walletPassword = ref('');
const busy = ref(false);
const error = ref('');
const result = ref<BackupImportResult>();

async function pick(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  error.value = '';
  result.value = undefined;
  filename.value = file.name;
  content.value = await file.text();
  try {
    preview.value = await service.inspect(content.value);
  } catch {
    preview.value = undefined;
    error.value = t('backup_error_file');
  }
}

async function submit(): Promise<void> {
  if (!content.value || backupPassword.value.length === 0) return;
  busy.value = true;
  error.value = '';
  try {
    const restored = await service.restore(
      content.value,
      backupPassword.value,
      app.status.initialized ? walletPassword.value : undefined,
    );
    result.value = restored;
    backupPassword.value = '';
    walletPassword.value = '';
    await app.load();
    emit('restored', restored);
  } catch {
    error.value = t('backup_error_password');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="eyebrow">{{ t('backup_import_title') }}</h2>
    <form class="bg-card flex flex-col gap-4 rounded-lg border p-4" @submit.prevent="submit">
      <p class="text-muted-foreground text-sm">{{ t('backup_import_description') }}</p>

      <input
        ref="input"
        type="file"
        accept="application/json,.json"
        class="sr-only"
        @change="pick"
      />
      <div class="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" @click="input?.click()">
          <FileUp />
          {{ t('backup_import_choose') }}
        </Button>
        <span v-if="filename" class="text-muted-foreground truncate font-mono text-xs">{{
          filename
        }}</span>
      </div>

      <DataList
        v-if="preview"
        :items="[
          { label: t('backup_preview_chains'), value: String(preview.chains) },
          { label: t('backup_preview_wallets'), value: String(preview.wallets) },
          { label: t('backup_preview_keys'), value: String(preview.keys) },
          { label: t('backup_preview_contacts'), value: String(preview.contacts) },
          { label: t('backup_preview_tokens'), value: String(preview.customTokens) },
        ]"
      />

      <template v-if="preview">
        <div class="flex flex-col gap-2">
          <Label for="restore-backup-password">{{ t('backup_file_password_label') }}</Label>
          <Input
            id="restore-backup-password"
            v-model="backupPassword"
            type="password"
            autocomplete="off"
          />
        </div>
        <div v-if="app.status.initialized" class="flex flex-col gap-2">
          <Label for="restore-wallet-password">{{ t('backup_wallet_password_label') }}</Label>
          <Input
            id="restore-wallet-password"
            v-model="walletPassword"
            type="password"
            autocomplete="off"
          />
          <p class="text-muted-foreground text-xs">{{ t('backup_merge_hint') }}</p>
        </div>
        <p v-else class="text-muted-foreground text-xs">{{ t('backup_fresh_hint') }}</p>
      </template>

      <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
      <p v-else-if="result" class="text-positive text-sm">
        {{
          t('backup_import_done', {
            wallets: result.wallets,
            keys: result.keys,
            chains: result.chains,
          })
        }}
      </p>

      <Button
        type="submit"
        class="self-start"
        :disabled="busy || !preview || backupPassword.length === 0"
      >
        <Upload />
        {{ t('backup_import_action') }}
      </Button>
    </form>
  </section>
</template>
