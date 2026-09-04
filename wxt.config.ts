import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  publicDir: 'src/public',
  outDir: 'dist',
  modules: ['@wxt-dev/module-vue'],
  imports: false,
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: ({ browser }) => ({
    name: 'Anchor Extension',
    description: 'Antelope wallet and signing request authenticator',
    permissions: [
      'storage',
      'alarms',
      'idle',
      'contextMenus',
      'tabs',
      'clipboardWrite',
      ...(browser === 'firefox' ? [] : ['sidePanel']),
    ],
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [{ resources: ['inpage.js'], matches: ['<all_urls>'] }],
    action: { default_title: 'Anchor' },
    ...(browser === 'firefox' ? {} : { side_panel: { default_path: 'app.html' } }),
  }),
});
