import { createProxyService, registerService } from '@webext-core/proxy-service';
import { browser } from 'wxt/browser';
import { settingsItem } from '@/lib/storage/items';
import { settingsSchema, type Settings } from '@/lib/storage/schemas';

export interface SettingsService {
  get(): Promise<Settings>;
  update(patch: Partial<Settings>): Promise<Settings>;
  resetApplication(): Promise<void>;
}

const SERVICE_KEY = 'SettingsService';

export const settingsService: SettingsService = {
  async get() {
    return settingsSchema.parse(await settingsItem.getValue());
  },

  async update(patch) {
    const current = await settingsItem.getValue();
    const next = settingsSchema.parse({ ...current, ...patch });
    await settingsItem.setValue(next);
    return next;
  },

  async resetApplication() {
    await browser.storage.session.clear();
    await browser.storage.local.clear();
  },
};

export function registerSettingsService(): void {
  registerService(SERVICE_KEY, settingsService);
}

export function useSettingsService(): SettingsService {
  return createProxyService<SettingsService>(SERVICE_KEY);
}
