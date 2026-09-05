import type { App } from 'vue';
import i18next, { type Resource } from 'i18next';
import I18NextVue from 'i18next-vue';
import sprintf from 'i18next-sprintf-postprocessor';

const files = import.meta.glob<Record<string, string>>('../../locales/*/ext.json', {
  eager: true,
  import: 'default',
});

function buildResources(): { resources: Resource; namespaces: string[] } {
  const resources: Resource = {};
  const namespaces = new Set<string>();
  for (const [path, messages] of Object.entries(files)) {
    const match = /locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
    const lng = match?.[1];
    const ns = match?.[2];
    if (!lng || !ns) continue;
    resources[lng] ??= {};
    resources[lng][ns] = messages;
    namespaces.add(ns);
  }
  return { resources, namespaces: [...namespaces] };
}

const NATIVE_NAMES: Record<string, string> = {
  'de-DE': 'Deutsch',
  'el-GR': 'Ελληνικά',
  'en-US': 'English',
  'es-ES': 'Español',
  'et-EE': 'Eesti',
  'fr-FR': 'Français',
  'id-ID': 'Bahasa Indonesia',
  'it-IT': 'Italiano',
  'ja-JP': '日本語',
  'ko-KR': '한국어',
  'ru-RU': 'Русский',
  'zh-CN': '中文',
};

export interface LocaleOption {
  code: string;
  label: string;
}

export function availableLocales(): LocaleOption[] {
  const { resources } = buildResources();
  return Object.keys(resources)
    .map((code) => ({ code, label: NATIVE_NAMES[code] ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function resolveLocale(preferred: string | undefined, codes: string[]): string {
  if (!preferred) return 'en-US';
  if (codes.includes(preferred)) return preferred;
  const base = preferred.split('-')[0]?.toLowerCase();
  const match = codes.find((code) => code.split('-')[0]?.toLowerCase() === base);
  return match ?? 'en-US';
}

export async function setLanguage(lng: string): Promise<void> {
  if (i18next.isInitialized && i18next.language !== lng) await i18next.changeLanguage(lng);
}

export async function setupI18n(app: App, lng: string): Promise<void> {
  const { resources, namespaces } = buildResources();
  if (!i18next.isInitialized) {
    await i18next.use(sprintf).init({
      lng,
      fallbackLng: 'en-US',
      resources,
      ns: namespaces,
      defaultNS: 'ext',
      postProcess: 'sprintf',
      interpolation: { escapeValue: false },
    });
  } else if (i18next.language !== lng) {
    await i18next.changeLanguage(lng);
  }
  app.use(I18NextVue, { i18next });
}

export { i18next };
