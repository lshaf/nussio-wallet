<script setup lang="ts">
import { watch } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app.store';
import BottomNav from './BottomNav.vue';
import SideNav from './SideNav.vue';
import TopBar from './TopBar.vue';

const app = useAppStore();
const router = useRouter();

watch(
  () => app.setupRoute,
  (route) => {
    if (route) void router.push(route);
  },
);
</script>

<template>
  <div class="flex min-h-screen">
    <SideNav />
    <div class="flex min-w-0 flex-1 flex-col">
      <TopBar />
      <main class="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 md:p-8 md:pb-12">
        <RouterView />
      </main>
    </div>
    <BottomNav />
  </div>
</template>
