import { browser } from 'wxt/browser';
import { settingsItem } from '@/lib/storage/items';
import { availableLocales, resolveLocale } from './index';

export async function startupLocale(): Promise<string> {
  const settings = await settingsItem.getValue().catch(() => null);
  const codes = availableLocales().map((locale) => locale.code);
  if (settings?.langChosen) return resolveLocale(settings.lang, codes);
  let uiLanguage: string;
  try {
    uiLanguage = browser.i18n?.getUILanguage?.() ?? '';
  } catch {
    uiLanguage = '';
  }
  return resolveLocale(uiLanguage || settings?.lang, codes);
}
