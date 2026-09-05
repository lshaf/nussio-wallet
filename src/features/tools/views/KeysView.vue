<script setup lang="ts">
import { ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import KeyGeneratorPanel from '../components/KeyGeneratorPanel.vue';
import KeyList from '../components/KeyList.vue';
import KeyUtilityPanel from '../components/KeyUtilityPanel.vue';

const { t } = useTranslation('ext');
const list = ref<InstanceType<typeof KeyList>>();
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6 md:gap-8">
    <PageHeader :title="t('keys_title')" :eyebrow="t('nav_tools')" />
    <KeyList ref="list" />
    <KeyGeneratorPanel @saved="list?.refresh()" />
    <KeyUtilityPanel />
  </div>
</template>
