import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from './extension';

test('key tools, contacts and a backup round trip', async ({ appPage: page }) => {
  await page.getByRole('button', { name: 'Set up a wallet' }).click();
  await page.locator('#password').fill('correct horse battery');
  await page.locator('#password-confirm').fill('correct horse battery');
  await page.getByRole('button', { name: 'Set password' }).click();

  await page.locator('#chain-jungle4').click();
  await page.getByRole('button', { name: 'Enable 1 blockchain' }).click();

  await expect(page).toHaveURL(/#\/setup\/import$/);
  await page.getByRole('tab', { name: 'Watch' }).click();
  await page.locator('#watch-account').fill('eosio');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.getByText('eosio@active')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);

  await page.getByRole('link', { name: 'Tools' }).click();
  await expect(page).toHaveURL(/#\/tools$/);
  await expect(page.getByText('Never')).toBeVisible();

  await page.getByRole('link', { name: 'Manage keys' }).click();
  await expect(page.getByText('No keys stored yet')).toBeVisible();
  await page.getByRole('button', { name: 'Generate keypair' }).click();
  const publicKey = await page.locator('code').first().innerText();
  expect(publicKey).toMatch(/^PUB_K1_/);
  await page.getByRole('button', { name: 'Save to wallet' }).click();
  await page.locator('#confirm-password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();
  await expect(page.getByText('Not used by any wallet')).toBeVisible();

  await page.locator('#key-utility').fill(publicKey);
  await expect(page.getByText('Valid key')).toBeVisible();
  await page.locator('#key-utility').fill('nonsense');
  await expect(page.getByText('Not a valid key')).toBeVisible();

  await page.getByRole('button', { name: 'Show key' }).first().click();
  await page.locator('#reveal-password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Show key' }).last().click();
  await expect(page.getByRole('dialog').locator('code')).toContainText(/^5|^PVT_K1_/);
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click();

  await page.getByRole('link', { name: 'Tools' }).click();
  await page.getByRole('link', { name: 'Contacts' }).click();
  await page.getByRole('button', { name: 'Add contact' }).click();
  await page.locator('#contact-account').fill('greymassfuel');
  await page.locator('#contact-label').fill('Fuel');
  await page.locator('#contact-memo').fill('thanks for the fuel');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Fuel', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Send', exact: true }).click();
  await page.locator('#send-to').fill('greymassfuel');
  await expect(page.locator('#send-memo')).toHaveValue('thanks for the fuel');

  await page.getByRole('link', { name: 'Tools' }).click();
  await page.getByRole('link', { name: 'Backup and restore' }).click();
  await page.locator('#backup-password').fill('correct horse battery');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export backup' }).click(),
  ]);
  const directory = await mkdtemp(path.join(tmpdir(), 'nussio-backup-'));
  const file = path.join(directory, download.suggestedFilename());
  await download.saveAs(file);
  await expect(page.getByText('Backup saved with 1 key.')).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByText('Wallets').locator('xpath=following-sibling::dd[1]')).toHaveText('1');
  await page.locator('#restore-backup-password').fill('correct horse battery');
  await page.locator('#restore-wallet-password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Restore backup' }).click();
  await expect(page.getByText(/Restored 1 wallets/)).toBeVisible();

  await page.getByRole('link', { name: 'Tools' }).click();
  await expect(page.getByText('Never')).toHaveCount(0);
});

test('resource rental and RAM dialogs price live on jungle4', async ({ appPage: page }) => {
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

  await page.getByRole('link', { name: 'Resources' }).click();
  await expect(page.getByText('RAM quota')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('PowerUp per ms').first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'PowerUp' }).first().click();
  const powerup = page.getByRole('dialog');
  await expect(powerup.getByText('PowerUp CPU')).toBeVisible();
  await powerup.locator('#rent-amount').fill('50');
  await expect(powerup.getByText(/costs about .* EOS/)).toBeVisible({ timeout: 30_000 });
  await powerup.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Buy', exact: true }).click();
  const ram = page.getByRole('dialog');
  await expect(ram.getByText('Buy RAM')).toBeVisible();
  await ram.locator('#ram-amount').fill('4096');
  await expect(ram.getByText(/costs about .* EOS/)).toBeVisible({ timeout: 30_000 });
  await ram.getByRole('tab', { name: 'By EOS' }).click();
  await ram.locator('#ram-amount').fill('1');
  await expect(ram.getByText(/costs about 1\.0000 EOS/)).toBeVisible({ timeout: 30_000 });
  await ram.getByRole('button', { name: 'Cancel' }).click();
});
