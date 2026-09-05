import { expect, test } from './extension';

test('contract tool, ABI cache and history render on jungle4', async ({ appPage: page }) => {
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

  await page.getByRole('link', { name: 'Tools' }).click();
  await page.getByRole('link', { name: /^Smart contracts/ }).click();
  await expect(page).toHaveURL(/#\/tools\/contract$/);
  await page.getByPlaceholder('eosio.token').fill('eosio.token');
  await page.getByRole('button', { name: 'Load' }).click();
  await expect(page.getByRole('tab', { name: 'Actions' })).toBeVisible({ timeout: 30_000 });
  await page.locator('#contract-action').click();
  await page.getByRole('option', { name: 'transfer' }).click();
  await expect(page.locator('#field-quantity')).toBeVisible();
  await expect(page.locator('#field-memo')).toBeVisible();

  await page.getByRole('tab', { name: 'Tables' }).click();
  await page.locator('#contract-scope').fill('eosio');
  await page.getByRole('button', { name: 'Read table' }).click();
  await expect(page.locator('pre')).toContainText('balance', { timeout: 30_000 });

  await page.getByRole('tab', { name: 'Interface' }).click();
  await expect(page.locator('pre')).toContainText('transfer');

  await page.getByRole('link', { name: 'Tools' }).click();
  await page.getByRole('link', { name: /^ABI cache/ }).click();
  await expect(page.getByText('eosio.token')).toBeVisible();
  await page.getByRole('button', { name: 'Clear cache' }).click();
  await expect(page.getByText('Nothing cached yet')).toBeVisible();

  await page.getByRole('link', { name: 'Tools' }).click();
  await page.getByRole('link', { name: /^History/ }).click();
  await expect(page).toHaveURL(/#\/tools\/history$/);
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
  await expect(page.getByText('eosio::').first()).toBeVisible({ timeout: 30_000 });
});
