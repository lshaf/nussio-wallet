<script setup lang="ts">
import { RouterView } from 'vue-router';
import BottomNav from './BottomNav.vue';
import SideNav from './SideNav.vue';
import TopBar from './TopBar.vue';
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
