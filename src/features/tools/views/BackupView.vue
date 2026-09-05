<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import BackupExport from '../components/BackupExport.vue';
import BackupRestore from '../components/BackupRestore.vue';

const { t } = useTranslation('ext');
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6 md:gap-8">
    <PageHeader :title="t('backup_title')" :eyebrow="t('nav_tools')" />
    <BackupExport />
    <BackupRestore />
  </div>
</template>
