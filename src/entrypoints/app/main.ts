import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import '@/assets/styles.css';
import { setupI18n } from '@/lib/i18n';
import { startupLocale } from '@/lib/i18n/startup';
import { followSystemTheme } from '@/lib/theme';
import App from './App.vue';
import { router } from './router';

async function bootstrap(): Promise<void> {
  followSystemTheme();
  const app = createApp(App);
  app.use(createPinia());
  app.use(VueQueryPlugin);
  app.use(router);
  await setupI18n(app, await startupLocale());
  app.mount('#app');
}

void bootstrap();
