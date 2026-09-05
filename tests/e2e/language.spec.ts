import { expect, test } from './extension';

test('language switcher lists locales and keeps the choice', async ({ appPage: page }) => {
  await page.getByRole('button', { name: 'Set up a wallet' }).click();
  await page.locator('#password').fill('correct horse battery');
  await page.locator('#password-confirm').fill('correct horse battery');
  await page.getByRole('button', { name: 'Set password' }).click();
  await page.locator('#chain-jungle4').click();
  await page.getByRole('button', { name: 'Enable 1 blockchain' }).click();
  await page.getByRole('tab', { name: 'Watch' }).click();
  await page.locator('#watch-account').fill('eosio');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.getByText('eosio@active')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Import', exact: true }).click();

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByText('Interface language')).toBeVisible();
  await page.locator('#setting-language').click();
  await expect(page.getByRole('option', { name: 'English' })).toBeVisible();
  await page.getByRole('option', { name: 'Bahasa Indonesia' }).click();

  await expect(page.getByRole('heading', { name: 'Pengaturan' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Beranda' })).toBeVisible();
  await expect(page.getByText('Bahasa antarmuka')).toBeVisible();

  const stored = await page.evaluate(async () => {
    const value = await chrome.storage.local.get('settings');
    return value.settings as { lang?: string; langChosen?: boolean } | undefined;
  });
  expect(stored?.lang).toBe('id-ID');
  expect(stored?.langChosen).toBe(true);

  await page.reload();
  await expect(page.getByRole('link', { name: 'Alat' })).toBeVisible();
  await page.getByRole('link', { name: 'Kirim' }).click();
  await expect(page.getByRole('heading', { name: 'Kirim token' })).toBeVisible();
});

declare const chrome: {
  storage: { local: { get(key: string): Promise<Record<string, unknown>> } };
};
