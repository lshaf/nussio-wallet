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
        {
          path: 'restore',
          name: 'setup-restore',
          component: () => import('@/features/onboarding/views/SetupRestoreView.vue'),
        },
      ],
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppShell.vue'),
      children: [
        { path: '', name: 'home', component: () => import('@/features/home/views/HomeView.vue') },
        {
          path: 'send',
          name: 'send',
          component: () => import('@/features/wallet/views/SendView.vue'),
        },
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
          path: 'governance',
          name: 'governance',
          component: () => import('@/features/governance/views/GovernanceView.vue'),
        },
        {
          path: 'tools',
          name: 'tools',
          component: () => import('@/features/tools/views/ToolsView.vue'),
        },
        {
          path: 'tools/backup',
          name: 'tools-backup',
          component: () => import('@/features/tools/views/BackupView.vue'),
        },
        {
          path: 'tools/keys',
          name: 'tools-keys',
          component: () => import('@/features/tools/views/KeysView.vue'),
        },
        {
          path: 'tools/contacts',
          name: 'tools-contacts',
          component: () => import('@/features/tools/views/ContactsView.vue'),
        },
        {
          path: 'tools/tokens',
          name: 'tools-tokens',
          component: () => import('@/features/tools/views/TokensView.vue'),
        },
        {
          path: 'tools/pending',
          name: 'tools-pending',
          component: () => import('@/features/tools/views/PendingView.vue'),
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
