import { expect, test } from './extension';

test('wax and proton respect their chain quirks', async ({ appPage: page }) => {
  await page.getByRole('button', { name: 'Set up a wallet' }).click();
  await page.locator('#password').fill('correct horse battery');
  await page.locator('#password-confirm').fill('correct horse battery');
  await page.getByRole('button', { name: 'Set password' }).click();

  await page.locator('#chain-wax').click();
  await page.locator('#chain-proton').click();
  await page.getByRole('button', { name: 'Enable 2 blockchains' }).click();

  await expect(page).toHaveURL(/#\/setup\/import$/);
  await page.getByRole('tab', { name: 'Watch' }).click();
  await page.locator('#watch-account').fill('eosio');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.getByText('eosio@active')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);

  await expect(page.getByText(/\d+\.\d{8} WAX/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Resources' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Governance' })).toBeVisible();

  await page.getByRole('link', { name: 'Tools' }).click();
  await expect(page.getByRole('link', { name: /^Name bidding/ })).toBeVisible();

  await page.getByRole('link', { name: 'Resources' }).click();
  await expect(page.getByText('RAM quota')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'PowerUp' }).first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: 'Rent', exact: true })).toHaveCount(0);

  const chainSwitcher = page.getByRole('combobox').filter({ hasText: 'WAX' });
  await chainSwitcher.click();
  await page.getByRole('option', { name: /Proton/ }).click();

  await expect(page).toHaveURL(/#\/setup\/import$/);
  await page.getByRole('tab', { name: 'Watch' }).click();
  await page.locator('#watch-account').fill('eosio');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.getByText('eosio@active')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);

  await expect(page.getByText(/\d+\.\d{4} XPR/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/ SYS/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Resources' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Governance' })).toHaveCount(0);
});
