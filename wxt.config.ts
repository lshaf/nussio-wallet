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
