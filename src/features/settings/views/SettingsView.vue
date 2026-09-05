<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { RouterLink } from 'vue-router';
import ChangePasswordDialog from '@/components/dialogs/ChangePasswordDialog.vue';
import { ChevronRight, Network } from 'lucide-vue-next';
import DangerLink from '@/components/shared/DangerLink.vue';
import PageHeader from '@/components/shared/PageHeader.vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { browser } from 'wxt/browser';
import { useSettingsService } from '@/composables/useServices';
import { availableLocales } from '@/lib/i18n';
import type { Settings } from '@/lib/storage/schemas';
import { useAppStore } from '@/stores/app.store';
import ExplorerPanel from '../components/ExplorerPanel.vue';
import LinkServicePanel from '../components/LinkServicePanel.vue';
import SessionsPanel from '../components/SessionsPanel.vue';
import SitesPanel from '../components/SitesPanel.vue';

const { t } = useTranslation('ext');
const router = useRouter();
const app = useAppStore();
const settingsService = useSettingsService();

const locales = availableLocales();
const idleOptions = [0, 5, 15, 30, 60];
const refreshOptions = [0, 10, 30, 60, 120, 300];
const resetText = ref('');
const passwordOpen = ref(false);
const passwordChanged = ref(false);
const version = browser.runtime.getManifest().version;

type BooleanSetting = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

const toggles: { section: string; items: { key: BooleanSetting; label: string }[] }[] = [
  {
    section: 'settings_interface',
    items: [
      { key: 'advancedOptions', label: 'settings_advanced' },
      { key: 'displayTestNetworks', label: 'settings_testnets' },
      { key: 'skipLinkModal', label: 'settings_skip_link' },
      { key: 'displayResourcesAvailable', label: 'settings_resources_available' },
    ],
  },
  {
    section: 'settings_wallet',
    items: [
      { key: 'allowSigningRequests', label: 'settings_signing_requests' },
      { key: 'allowSiteConnections', label: 'settings_site_connections' },
      { key: 'promptCloseOnComplete', label: 'settings_close_on_complete' },
      { key: 'transactionFees', label: 'settings_fees' },
    ],
  },
  {
    section: 'settings_developer',
    items: [{ key: 'allowDangerousTransactions', label: 'settings_dangerous' }],
  },
];

function setToggle(key: BooleanSetting, value: boolean | 'indeterminate'): void {
  void app.updateSettings({ [key]: value === true });
}

function setLanguageSetting(value: unknown): void {
  if (typeof value === 'string') void app.updateSettings({ lang: value, langChosen: true });
}

function setNumber(key: 'idleTimeoutMinutes' | 'refreshRateSeconds', value: unknown): void {
  if (typeof value === 'string') void app.updateSettings({ [key]: Number(value) });
}

async function reset(): Promise<void> {
  if (resetText.value !== 'RESET') return;
  await settingsService.resetApplication();
  await app.load();
  await router.push('/setup');
}
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6 md:gap-8">
    <PageHeader :title="t('settings_title')" />

    <RouterLink
      to="/chains"
      class="bg-card flex items-center gap-3 rounded-lg border px-4 py-3 text-sm md:hidden"
    >
      <Network class="text-muted-foreground size-4" />
      <span class="flex-1 font-medium">{{ t('nav_chains') }}</span>
      <ChevronRight class="text-muted-foreground size-4" />
    </RouterLink>

    <section class="flex flex-col gap-3">
      <h2 class="eyebrow">{{ t('settings_language') }}</h2>
      <div
        class="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
      >
        <Label for="setting-language">{{ t('settings_language_label') }}</Label>
        <Select :model-value="app.settings.lang" @update:model-value="setLanguageSetting">
          <SelectTrigger id="setting-language" class="w-44" size="sm">
            <span class="truncate text-sm">{{
              locales.find((locale) => locale.code === app.settings.lang)?.label ??
              app.settings.lang
            }}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="locale in locales" :key="locale.code" :value="locale.code">{{
              locale.label
            }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>

    <section v-for="group in toggles" :key="group.section" class="flex flex-col gap-3">
      <h2 class="eyebrow">{{ t(group.section) }}</h2>
      <div class="bg-card divide-y rounded-lg border">
        <label
          v-for="item in group.items"
          :key="item.key"
          :for="`setting-${item.key}`"
          class="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm"
        >
          <Checkbox
            :id="`setting-${item.key}`"
            :model-value="app.settings[item.key]"
            @update:model-value="(value) => setToggle(item.key, value)"
          />
          <span>{{ t(item.label) }}</span>
        </label>
        <div
          v-if="group.section === 'settings_wallet'"
          class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <Label for="setting-idle">{{ t('settings_idle') }}</Label>
          <Select
            :model-value="String(app.settings.idleTimeoutMinutes)"
            @update:model-value="(value) => setNumber('idleTimeoutMinutes', value)"
          >
            <SelectTrigger id="setting-idle" class="w-44" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="minutes in idleOptions" :key="minutes" :value="String(minutes)">
                {{
                  minutes === 0
                    ? t('settings_idle_never')
                    : t('settings_idle_minutes', { count: minutes })
                }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="eyebrow">{{ t('settings_connection') }}</h2>
      <div class="bg-card divide-y rounded-lg border">
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Label for="setting-refresh">{{ t('settings_refresh') }}</Label>
          <Select
            :model-value="String(app.settings.refreshRateSeconds)"
            @update:model-value="(value) => setNumber('refreshRateSeconds', value)"
          >
            <SelectTrigger id="setting-refresh" class="w-44" size="sm"
              ><SelectValue
            /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="seconds in refreshOptions" :key="seconds" :value="String(seconds)">
                {{
                  seconds === 0
                    ? t('settings_refresh_off')
                    : t('settings_refresh_seconds', { count: seconds })
                }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Label for="setting-link-url">{{ t('settings_link_url') }}</Label>
          <Input
            id="setting-link-url"
            class="w-full font-mono sm:w-64"
            :model-value="app.settings.anchorLinkServiceUrl"
            @change="
              (event: Event) =>
                app.updateSettings({
                  anchorLinkServiceUrl: (event.target as HTMLInputElement).value,
                })
            "
          />
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="eyebrow">{{ t('settings_security') }}</h2>
      <div class="bg-card flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="text-sm font-medium">{{ t('password_change_title') }}</span>
          <span class="text-muted-foreground text-xs">{{ t('password_change_hint') }}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          :disabled="!app.status.initialized"
          @click="passwordOpen = true"
          >{{ t('password_change_action') }}</Button
        >
      </div>
      <p v-if="passwordChanged" class="text-positive text-sm">{{ t('password_change_done') }}</p>
    </section>

    <ExplorerPanel />

    <SitesPanel />
    <SessionsPanel />
    <LinkServicePanel />

    <section class="flex flex-col gap-3">
      <h2 class="eyebrow">{{ t('settings_about') }}</h2>
      <div class="bg-card flex flex-col gap-2 rounded-lg border p-4 text-sm">
        <p class="font-medium">{{ t('app_title') }}</p>
        <p class="text-muted-foreground num">{{ t('about_version', { version }) }}</p>
        <p class="text-muted-foreground">{{ t('about_license') }}</p>
        <p class="text-muted-foreground">{{ t('about_credit') }}</p>
        <DangerLink href="https://github.com/greymass/anchor" class="self-start text-sm">{{
          t('about_credit_link')
        }}</DangerLink>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="eyebrow text-destructive">{{ t('settings_danger') }}</h2>
      <div class="border-destructive/40 bg-card flex flex-col gap-3 rounded-lg border p-4">
        <p class="text-muted-foreground text-sm">{{ t('settings_reset_description') }}</p>
        <div class="flex flex-wrap gap-2">
          <Input
            v-model="resetText"
            class="w-full font-mono sm:w-52"
            :placeholder="t('settings_reset_confirm')"
          />
          <Button variant="destructive" :disabled="resetText !== 'RESET'" @click="reset">{{
            t('action_reset')
          }}</Button>
        </div>
      </div>
    </section>
    <ChangePasswordDialog v-model:open="passwordOpen" @changed="passwordChanged = true" />
  </div>
</template>
