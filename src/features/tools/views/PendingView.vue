<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { useTimeAgo } from '@vueuse/core';
import { DatabaseBackup } from 'lucide-vue-next';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Button } from '@/components/ui/button';
import PendingRequests from '@/features/transactions/components/PendingRequests.vue';
import { useAppStore } from '@/stores/app.store';
import CreateAccountRequest from '../components/CreateAccountRequest.vue';
import PendingAccountList from '../components/PendingAccountList.vue';

const BACKUP_STALE_MS = 30 * 24 * 60 * 60 * 1000;

const { t } = useTranslation('ext');
const app = useAppStore();
const list = ref<InstanceType<typeof PendingAccountList>>();

const lastBackup = computed(() => app.settings.lastBackupAt ?? 0);
const ago = useTimeAgo(lastBackup);
const backupDue = computed(
  () => lastBackup.value === 0 || Date.now() - lastBackup.value > BACKUP_STALE_MS,
);
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-5 md:gap-6">
    <PageHeader :title="t('pending_title')" :eyebrow="t('nav_tools')" />

    <PendingRequests />

    <div
      v-if="backupDue"
      class="bg-card flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
    >
      <DatabaseBackup class="text-muted-foreground size-4 shrink-0" />
      <span class="flex-1">{{
        lastBackup > 0 ? t('backup_reminder_stale', { ago }) : t('backup_reminder_never')
      }}</span>
      <Button size="sm" variant="outline" as-child>
        <RouterLink to="/tools/backup">{{ t('backup_export_action') }}</RouterLink>
      </Button>
    </div>

    <PendingAccountList ref="list" />
    <CreateAccountRequest @created="list?.refresh()" />
  </div>
</template>
