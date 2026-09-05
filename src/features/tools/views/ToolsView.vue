<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import {
  ChevronRight,
  Coins,
  Contact,
  DatabaseBackup,
  Gavel,
  KeyRound,
  ListChecks,
  ShieldCheck,
  UserPlus,
} from 'lucide-vue-next';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Badge } from '@/components/ui/badge';
import { pendingItem, pendingRequestsItem } from '@/lib/storage/items';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();

const pendingAccounts = ref(0);
const pendingSignings = ref(0);
const unwatch: (() => void)[] = [];

const pendingCount = computed(() => pendingAccounts.value + pendingSignings.value);
const backupDue = computed(() => app.settings.lastBackupAt === null);

const tools = computed(() => [
  {
    to: '/tools/backup',
    icon: DatabaseBackup,
    title: t('backup_title'),
    hint: t('tools_backup_hint'),
    badge: backupDue.value ? t('backup_never_badge') : '',
  },
  { to: '/tools/keys', icon: KeyRound, title: t('keys_title'), hint: t('tools_keys_hint') },
  {
    to: '/tools/permissions',
    icon: ShieldCheck,
    title: t('permissions_title'),
    hint: t('tools_permissions_hint'),
  },
  {
    to: '/tools/create-account',
    icon: UserPlus,
    title: t('create_direct_title'),
    hint: t('tools_create_hint'),
  },
  {
    to: '/tools/contacts',
    icon: Contact,
    title: t('contacts_title'),
    hint: t('tools_contacts_hint'),
  },
  { to: '/tools/tokens', icon: Coins, title: t('tokens_title'), hint: t('tools_tokens_hint') },
  ...(app.currentChain?.features.includes('bidname')
    ? [{ to: '/tools/bidname', icon: Gavel, title: t('bid_title'), hint: t('tools_bid_hint') }]
    : []),
  {
    to: '/tools/pending',
    icon: ListChecks,
    title: t('pending_title'),
    hint: t('tools_pending_hint'),
    badge: pendingCount.value > 0 ? String(pendingCount.value) : '',
  },
]);

onMounted(async () => {
  pendingAccounts.value = (await pendingItem.getValue()).accounts.length;
  pendingSignings.value = (await pendingRequestsItem.getValue()).filter(
    (entry) => !['done', 'error', 'cancelled'].includes(entry.status),
  ).length;
  unwatch.push(
    pendingItem.watch((value) => {
      pendingAccounts.value = value.accounts.length;
    }),
    pendingRequestsItem.watch((value) => {
      pendingSignings.value = value.filter(
        (entry) => !['done', 'error', 'cancelled'].includes(entry.status),
      ).length;
    }),
  );
});

onBeforeUnmount(() => unwatch.forEach((stop) => stop()));
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-5 md:gap-6">
    <PageHeader :title="t('tools_title')" />
    <div class="bg-card divide-y rounded-lg border">
      <RouterLink
        v-for="tool in tools"
        :key="tool.to"
        :to="tool.to"
        class="hover:bg-accent/50 flex items-center gap-3 px-4 py-3.5 transition-colors first:rounded-t-lg last:rounded-b-lg"
      >
        <component :is="tool.icon" class="text-muted-foreground size-5 shrink-0" />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="text-sm font-medium">{{ tool.title }}</span>
          <span class="text-muted-foreground text-xs">{{ tool.hint }}</span>
        </span>
        <Badge v-if="tool.badge" variant="secondary">{{ tool.badge }}</Badge>
        <ChevronRight class="text-muted-foreground size-4 shrink-0" />
      </RouterLink>
    </div>
  </div>
</template>
