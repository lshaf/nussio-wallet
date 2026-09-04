<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import AppMark from '@/components/shared/AppMark.vue';

const { t } = useTranslation('ext');
const route = useRoute();

const steps = ['setup-password', 'setup-chains', 'setup-import'];
const step = computed(() => steps.indexOf(String(route.name)) + 1);
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="flex h-16 items-center justify-between px-5 md:px-8">
      <AppMark />
      <p v-if="step > 0" class="eyebrow num">
        {{ t('setup_step', { step, total: steps.length }) }}
      </p>
    </header>
    <div class="flex flex-1 items-start justify-center px-4 pt-4 pb-12 md:items-center md:pt-0">
      <div class="w-full max-w-xl rise-in">
        <RouterView />
      </div>
    </div>
  </div>
</template>
