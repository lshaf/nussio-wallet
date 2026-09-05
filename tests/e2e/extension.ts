import path from 'node:path';
import { chromium, test as base, type BrowserContext, type Page } from '@playwright/test';

const EXTENSION_PATH = path.resolve('dist/chrome-mv3');
const CHANNEL = process.env.E2E_CHANNEL ?? 'chromium';
const EXECUTABLE = process.env.E2E_BROWSER_PATH;

export const test = base.extend<{ context: BrowserContext; extensionId: string; appPage: Page }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      ...(EXECUTABLE ? { executablePath: EXECUTABLE } : { channel: CHANNEL }),
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(worker.url().split('/')[2]!);
  },
  appPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    page.on('pageerror', (error) => console.error('[pageerror]', error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') console.error('[console]', message.text());
    });
    await page.goto(`chrome-extension://${extensionId}/app.html`);
    await use(page);
  },
});

export const expect = test.expect;
