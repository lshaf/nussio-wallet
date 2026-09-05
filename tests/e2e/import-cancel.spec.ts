import { expect, test } from './extension';

test('import screen offers cancel once a wallet exists', async ({ appPage: page }) => {
  await page.getByRole('button', { name: 'Set up a wallet' }).click();
  await page.locator('#password').fill('correct horse battery');
  await page.locator('#password-confirm').fill('correct horse battery');
  await page.getByRole('button', { name: 'Set password' }).click();
  await page.locator('#chain-jungle4').click();
  await page.getByRole('button', { name: 'Enable 1 blockchain' }).click();

  await expect(page).toHaveURL(/#\/setup\/import$/);
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);

  await page.getByRole('tab', { name: 'Watch' }).click();
  await page.locator('#watch-account').fill('eosio');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.getByText('eosio@active')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);

  await page.getByRole('link', { name: 'Wallets' }).click();
  await page.getByRole('button', { name: 'Import account' }).first().click();
  await expect(page).toHaveURL(/#\/setup\/import$/);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/#\/$/);
});
