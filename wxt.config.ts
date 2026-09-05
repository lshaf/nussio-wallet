import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { version } from './package.json';

export default defineConfig({
  srcDir: 'src',
  publicDir: 'src/public',
  outDir: 'dist',
  modules: ['@wxt-dev/module-vue'],
  imports: false,
  vite: () => ({
    plugins: [tailwindcss()],
    define: { __EXT_VERSION__: JSON.stringify(version) },
  }),
  manifest: ({ browser }) => ({
    name: 'Nussio Wallet',
    description: 'Antelope wallet and signing request authenticator for EOS, WAX, Telos and more',
    permissions: [
      'storage',
      'alarms',
      'idle',
      'contextMenus',
      'clipboardWrite',
      ...(browser === 'firefox' ? [] : ['sidePanel']),
    ],
    host_permissions: ['<all_urls>'],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'nussio-wallet@nussio.app',
              strict_min_version: '142.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
    web_accessible_resources: [{ resources: ['inpage.js'], matches: ['<all_urls>'] }],
    action: { default_title: 'Nussio Wallet' },
    ...(browser === 'firefox'
      ? {}
      : {
          content_security_policy: {
            extension_pages: "script-src 'self'; object-src 'self'; frame-ancestors 'none'",
          },
        }),
    ...(browser === 'firefox' ? {} : { side_panel: { default_path: 'app.html' } }),
  }),
});
