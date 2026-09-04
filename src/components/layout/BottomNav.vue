<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { useNavLinks } from './useNavLinks';

const { t } = useTranslation('ext');
const all = useNavLinks();
const links = computed(() =>
  all.value.length > 5 ? all.value.filter((link) => link.to !== '/chains') : all.value,
);
</script>

<template>
  <nav
    class="bg-card/95 fixed inset-x-0 bottom-0 z-20 flex border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
  >
    <RouterLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="text-muted-foreground flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium"
      active-class="text-primary"
      :exact-active-class="link.exact ? 'text-primary' : undefined"
    >
      <component :is="link.icon" class="size-5" />
      {{ t(link.label) }}
    </RouterLink>
  </nav>
</template>
