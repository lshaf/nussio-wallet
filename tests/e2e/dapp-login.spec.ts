import { expect, test } from './extension';

const KEY = process.env.WAX_TEST_KEY;
const ACCOUNT = process.env.WAX_TEST_ACCOUNT ?? 'nussiowallet';
const SITE = 'https://wax-test.atomichub.io';
const ANCHOR_BUTTON = { x: 622, y: 221 };
const LAUNCH_LINK = { x: 640, y: 542 };

test.skip(!KEY, 'set WAX_TEST_KEY to log in to a real dApp');

test('logs in to atomichub testnet through the prompt', async ({ context, appPage: page }) => {
  test.setTimeout(180_000);

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

  const site = await context.newPage();
  await site.setViewportSize({ width: 1280, height: 720 });
  await site.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await site.waitForTimeout(5_000);

  const accept = site.getByRole('button', { name: /Accept All/i });
  if (await accept.count()) await accept.first().click();
  await site.getByRole('button', { name: 'Login', exact: true }).first().click();
  await site.waitForTimeout(4_000);

  await site.mouse.click(ANCHOR_BUTTON.x, ANCHOR_BUTTON.y);
  await site.waitForTimeout(8_000);

  const promptPromise = context.waitForEvent('page', { timeout: 60_000 });
  await site.mouse.click(LAUNCH_LINK.x, LAUNCH_LINK.y);
  const prompt = await promptPromise;
  await prompt.waitForLoadState('domcontentloaded');

  await expect(prompt.getByRole('heading', { name: 'Login request' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(prompt.getByText(`Sent by: ${SITE}`)).toBeVisible();
  await expect(prompt.getByText('Login to atomichub')).toBeVisible();

  await prompt.getByRole('button', { name: new RegExp(`^Login as ${ACCOUNT}`) }).click();
  await site.waitForTimeout(20_000);
  await expect(site.locator('body')).toContainText(ACCOUNT);

  await page.goto(`${page.url().split('#')[0]}#/settings`);
  await expect(page.getByText('atomichub').first()).toBeVisible({ timeout: 30_000 });
});
