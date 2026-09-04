import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import '@/assets/styles.css';
import { setupI18n } from '@/lib/i18n';
import App from './App.vue';

async function bootstrap(): Promise<void> {
  const app = createApp(App);
  app.use(createPinia());
  app.use(VueQueryPlugin);
  await setupI18n(app, 'en-US');
  app.mount('#app');
}

void bootstrap();
