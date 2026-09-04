<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import AppMark from '@/components/shared/AppMark.vue';
import { useNavLinks } from './useNavLinks';

const { t } = useTranslation('ext');
const links = useNavLinks();
</script>

<template>
  <aside class="bg-card hidden w-60 shrink-0 flex-col border-r md:flex">
    <div class="flex h-16 items-center px-5">
      <AppMark />
    </div>
    <nav class="flex flex-col gap-0.5 px-3">
      <RouterLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
        active-class="bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
        :exact-active-class="link.exact ? 'bg-primary/10 text-primary' : undefined"
      >
        <component :is="link.icon" class="size-4" />
        {{ t(link.label) }}
      </RouterLink>
    </nav>
  </aside>
</template>
