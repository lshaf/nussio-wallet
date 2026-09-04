import type { App } from 'vue';
import i18next, { type Resource } from 'i18next';
import I18NextVue from 'i18next-vue';
import sprintf from 'i18next-sprintf-postprocessor';

const files = import.meta.glob<Record<string, string>>('../../locales/*/*.json', {
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

export async function setupI18n(app: App, lng: string): Promise<void> {
  const { resources, namespaces } = buildResources();
  if (!i18next.isInitialized) {
    await i18next.use(sprintf).init({
      lng,
      fallbackLng: 'en-US',
      resources,
      ns: namespaces,
      defaultNS: 'global',
      postProcess: 'sprintf',
      interpolation: { escapeValue: false },
    });
  } else if (i18next.language !== lng) {
    await i18next.changeLanguage(lng);
  }
  app.use(I18NextVue, { i18next });
}

export { i18next };
