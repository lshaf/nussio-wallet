import type { Page } from '@playwright/test';
import { expect, test } from './extension';

const SHOTS = process.env.E2E_SHOTS;

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

test('fresh install walks password → chains → import → home', async ({ appPage: page }) => {
  await expect(page).toHaveURL(/#\/setup$/);
  await expect(page.getByRole('heading', { name: 'Anchor Wallet' })).toBeVisible();
  await shot(page, '01-setup');

  await page.getByRole('button', { name: 'Set up a wallet' }).click();
  await expect(page).toHaveURL(/#\/setup\/password$/);
  await page.locator('#password').fill('correct horse battery');
  await page.locator('#password-confirm').fill('correct horse battery');
  await shot(page, '02-password');
  await page.getByRole('button', { name: 'Set password' }).click();

  await expect(page).toHaveURL(/#\/setup\/chains$/);
  await page.locator('#chain-jungle4').click();
  await expect(page.getByRole('button', { name: 'Enable 1 blockchain' })).toBeEnabled();
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByText('Connected, chain id matches.')).toBeVisible({ timeout: 30_000 });
  await shot(page, '03-chains');
  await page.getByRole('button', { name: 'Enable 1 blockchain' }).click();

  await expect(page).toHaveURL(/#\/setup\/import$/);
  await page.getByRole('tab', { name: 'Watch' }).click();
  await page.locator('#watch-account').fill('eosio');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.getByText('eosio@active')).toBeVisible({ timeout: 30_000 });
  await shot(page, '04-import');
  await page.getByRole('button', { name: 'Import', exact: true }).click();

  await expect(page).toHaveURL(/#\/$/);
  const accountSwitcher = page.getByRole('combobox').filter({ hasText: 'eosio@active' });
  await expect(accountSwitcher).toBeVisible();
  await expect(accountSwitcher).toContainText('Watch');
  await expect(page.getByRole('cell', { name: /EOS$/ }).first()).toBeVisible({ timeout: 30_000 });
  await shot(page, '05-home');

  await page.getByRole('link', { name: 'Resources' }).click();
  await expect(page).toHaveURL(/#\/account\/eosio$/);
  await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible();
  await expect(page.getByText('RAM quota')).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText('Price per KB').locator('xpath=following-sibling::dd[1]'),
  ).toContainText('EOS', { timeout: 30_000 });
  await shot(page, '07-resources');
  await page.getByRole('link', { name: 'Home' }).click();

  await page.getByRole('button', { name: 'Lock' }).click();
  await expect(page.getByRole('button', { name: 'Unlock' })).toBeVisible();
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.locator('#unlock-password').fill('wrong');
  await page.getByRole('button', { name: 'Unlock' }).last().click();
  await expect(page.getByText('The password does not match.')).toBeVisible();
  await page.locator('#unlock-password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Unlock' }).last().click();
  await expect(page.getByRole('button', { name: 'Lock' })).toBeVisible();
  await shot(page, '06-unlocked');
});

test('private key import reports keys with no accounts', async ({ appPage: page }) => {
  await page.getByRole('button', { name: 'Set up a wallet' }).click();
  await page.locator('#password').fill('correct horse battery');
  await page.locator('#password-confirm').fill('correct horse battery');
  await page.getByRole('button', { name: 'Set password' }).click();
  await page.locator('#chain-jungle4').click();
  await page.getByRole('button', { name: 'Enable 1 blockchain' }).click();
  await expect(page).toHaveURL(/#\/setup\/import$/);
  await page.locator('#import-wif').fill('5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3');
  await expect(
    page.getByText('EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'),
  ).toBeVisible();
  await expect(page.getByText(/No accounts found|Accounts matching/)).toBeVisible({
    timeout: 30_000,
  });
});
