import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 1,
  reporter: 'list',
  use: {
    screenshot: 'only-on-failure',
  },
});
