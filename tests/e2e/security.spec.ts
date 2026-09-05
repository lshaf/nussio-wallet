import { expect, test } from './extension';

test('permissions, name bidding and account creation on jungle4', async ({ appPage: page }) => {
  await page.getByRole('button', { name: 'Set up a wallet' }).click();
  await page.locator('#password').fill('correct horse battery');
  await page.locator('#password-confirm').fill('correct horse battery');
  await page.getByRole('button', { name: 'Set password' }).click();

  await page.locator('#chain-jungle4').click();
  await page.getByRole('button', { name: 'Enable 1 blockchain' }).click();
  await page.getByRole('tab', { name: 'Watch' }).click();
  await page.locator('#watch-account').fill('teamgreymass');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.getByText('teamgreymass@active')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Import', exact: true }).click();

  await page.getByRole('link', { name: 'Tools' }).click();
  await page.getByRole('link', { name: 'Permissions' }).click();
  await expect(page.getByText('owner').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Threshold 1').first()).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).first().click();
  const editor = page.getByRole('dialog');
  await expect(editor.getByText(/^Edit /)).toBeVisible();
  await editor.locator('#permission-threshold').fill('9');
  await expect(
    editor.getByText('The weights never reach the threshold, so nobody could sign.'),
  ).toBeVisible();
  await editor.locator('#permission-threshold').fill('1');
  await editor.getByRole('button', { name: 'Update permission' }).click();
  const result = page.getByRole('dialog');
  await expect(result.getByText('Ready to sign elsewhere')).toBeVisible({ timeout: 30_000 });
  await result.getByRole('button', { name: 'Close', exact: true }).first().click();

  await page.getByRole('link', { name: 'Tools' }).click();
  await page.getByRole('link', { name: 'Name bidding' }).click();
  await page.locator('#bid-name').fill('eosio');
  await expect(page.getByText('That name already exists')).toBeVisible({ timeout: 30_000 });
  await page.locator('#bid-name').fill('zzzz');
  await expect(page.getByText(/No bids yet|Auction is open/)).toBeVisible({ timeout: 30_000 });

  await page.getByRole('link', { name: 'Tools' }).click();
  await page.getByRole('link', { name: /^Create account/ }).click();
  await page.locator('#create-name').fill('nussiotest12');
  await expect(page.getByText('Name is available')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Generate keys' }).click();
  await expect(page.locator('#create-owner')).toHaveValue(/^PUB_K1_/);
  await page.getByRole('button', { name: 'Create account' }).last().click();
  const created = page.getByRole('dialog');
  await expect(created.getByText('Ready to sign elsewhere')).toBeVisible({ timeout: 30_000 });
});
