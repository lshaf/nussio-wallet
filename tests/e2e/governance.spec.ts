import { expect, test } from './extension';

test('producer list votes and proxies render on jungle4', async ({ appPage: page }) => {
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

  await page.getByRole('link', { name: 'Governance' }).click();
  await expect(page).toHaveURL(/#\/governance$/);
  await expect(page.getByRole('heading', { name: 'Governance' })).toBeVisible();
  await expect(page.getByText('lioninjungle')).toBeVisible({ timeout: 30_000 });

  await page.getByPlaceholder('Search producers').fill('lioninjungle');
  await expect(page.getByText('ohtigertiger')).toHaveCount(0);

  await page.locator('#producer-lioninjungle').click();
  await expect(page.getByText('1 of 30 votes selected')).toBeVisible();
  await page.getByRole('button', { name: 'Save votes' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Ready to sign elsewhere')).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
});
