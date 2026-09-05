import { expect, test } from './extension';

test('narrow window reaches governance and name bidding', async ({ appPage: page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
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
  await expect(page).toHaveURL(/#\/$/);

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Governance' }).click();
  await expect(page).toHaveURL(/#\/governance$/);
  await expect(page.getByRole('heading', { name: 'Governance' })).toBeVisible();

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('menuitem', { name: 'Tools' }).click();
  await expect(page.getByRole('link', { name: /^Name bidding/ })).toBeVisible();
  await page.getByRole('link', { name: /^Name bidding/ }).click();
  await expect(page).toHaveURL(/#\/tools\/bidname$/);
  await expect(page.getByRole('heading', { name: 'Name bidding' })).toBeVisible();
});
