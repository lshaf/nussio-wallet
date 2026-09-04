import { createRouter, createWebHashHistory } from 'vue-router';
import { useAppStore } from '@/stores/app.store';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/setup',
      component: () => import('@/components/layout/SetupShell.vue'),
      children: [
        {
          path: '',
          name: 'setup',
          component: () => import('@/features/onboarding/views/SetupInitView.vue'),
        },
        {
          path: 'password',
          name: 'setup-password',
          component: () => import('@/features/onboarding/views/SetupPasswordView.vue'),
        },
        {
          path: 'chains',
          name: 'setup-chains',
          component: () => import('@/features/onboarding/views/SetupChainsView.vue'),
        },
        {
          path: 'import',
          name: 'setup-import',
          component: () => import('@/features/onboarding/views/SetupImportView.vue'),
        },
      ],
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppShell.vue'),
      children: [
        { path: '', name: 'home', component: () => import('@/features/home/views/HomeView.vue') },
        {
          path: 'wallets',
          name: 'wallets',
          component: () => import('@/features/wallets/views/WalletsView.vue'),
        },
        {
          path: 'account/:name',
          name: 'account',
          component: () => import('@/features/resources/views/AccountView.vue'),
        },
        {
          path: 'chains',
          name: 'chains',
          component: () => import('@/features/chains/views/ChainsView.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/features/settings/views/SettingsView.vue'),
        },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const app = useAppStore();
  await app.ready();
  if (to.path.startsWith('/setup')) return true;
  return app.setupRoute ?? true;
});
