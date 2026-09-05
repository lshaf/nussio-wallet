<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { MoreHorizontal } from 'lucide-vue-next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavLinks } from './useNavLinks';

const VISIBLE = 4;

const { t } = useTranslation('ext');
const route = useRoute();
const all = useNavLinks();

const primary = computed(() =>
  all.value.length > VISIBLE + 1 ? all.value.slice(0, VISIBLE) : all.value,
);
const overflow = computed(() => (all.value.length > VISIBLE + 1 ? all.value.slice(VISIBLE) : []));
const overflowActive = computed(() =>
  overflow.value.some((link) => route.path === link.to || route.path.startsWith(`${link.to}/`)),
);
</script>

<template>
  <nav
    class="bg-card/95 fixed inset-x-0 bottom-0 z-20 flex border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
  >
    <RouterLink
      v-for="link in primary"
      :key="link.to"
      :to="link.to"
      class="text-muted-foreground flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium"
      active-class="text-primary"
      :exact-active-class="link.exact ? 'text-primary' : undefined"
    >
      <component :is="link.icon" class="size-5" />
      {{ t(link.label) }}
    </RouterLink>

    <DropdownMenu v-if="overflow.length > 0">
      <DropdownMenuTrigger
        class="text-muted-foreground flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium"
        :class="overflowActive ? 'text-primary' : ''"
        :aria-label="t('nav_more')"
      >
        <MoreHorizontal class="size-5" />
        {{ t('nav_more') }}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" class="mb-1 w-48">
        <DropdownMenuItem v-for="link in overflow" :key="link.to" as-child>
          <RouterLink :to="link.to" class="flex items-center gap-2">
            <component :is="link.icon" class="size-4" />
            {{ t(link.label) }}
          </RouterLink>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </nav>
</template>
