import { expect, test } from './extension';

const KEY = process.env.WAX_TEST_KEY;
const ACCOUNT = process.env.WAX_TEST_ACCOUNT ?? 'nussiowallet';

test.skip(!KEY, 'set WAX_TEST_KEY to run a real signature against WAX Testnet');

test('signs and broadcasts a real transfer on wax testnet', async ({ appPage: page }) => {
  test.setTimeout(120_000);

  await page.getByRole('button', { name: 'Set up a wallet' }).click();
  await page.locator('#password').fill('correct horse battery');
  await page.locator('#password-confirm').fill('correct horse battery');
  await page.getByRole('button', { name: 'Set password' }).click();
  await page.locator('#chain-wax-testnet').click();
  await page.getByRole('button', { name: 'Enable 1 blockchain' }).click();

  await page.locator('#import-wif').fill(KEY!);
  await expect(page.getByText(`${ACCOUNT}@active`)).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Import', exact: true }).click();

  const elevate = page.getByRole('dialog', { name: 'Authorization required' });
  await expect(elevate).toBeVisible({ timeout: 15_000 });
  await elevate.getByRole('textbox').fill('correct horse battery');
  await elevate.getByRole('button', { name: 'Confirm' }).click();
  await expect(page).toHaveURL(/#\/$/, { timeout: 30_000 });

  await page.goto(`${page.url().split('#')[0]}#/send`);
  await page.locator('#send-to').fill('eosio');
  await page.locator('#send-quantity').fill('0.00000001');
  await page.locator('#send-memo').fill('nussio live test');
  await page.getByRole('button', { name: 'Review' }).click();

  const send = page.getByRole('button', { name: /^(Send|Confirm)/ });
  await expect(send).toBeEnabled({ timeout: 15_000 });
  await send.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  await expect(dialog.getByText('Transaction sent')).toBeVisible({ timeout: 90_000 });
  await expect(dialog.getByText(/^[0-9a-f]{64}$/)).toBeVisible();
});
