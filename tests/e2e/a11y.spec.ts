import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './extension';

const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const SETTLE_MS = 400;

async function violations(page: Page) {
  await page.waitForTimeout(SETTLE_MS);
  const result = await new AxeBuilder({ page }).withTags(RULES).analyze();
  return result.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    }));
}

test('key screens pass serious accessibility checks', async ({ appPage: page }) => {
  expect(await violations(page)).toEqual([]);

  await page.getByRole('button', { name: 'Set up a wallet' }).click();
  await page.locator('#password').fill('correct horse battery');
  await page.locator('#password-confirm').fill('correct horse battery');
  expect(await violations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Set password' }).click();

  await page.locator('#chain-jungle4').click();
  expect(await violations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Enable 1 blockchain' }).click();

  await page.getByRole('tab', { name: 'Watch' }).click();
  await page.locator('#watch-account').fill('eosio');
  await page.getByRole('button', { name: 'Find' }).click();
  await expect(page.getByText('eosio@active')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('cell', { name: /EOS$/ }).first()).toBeVisible({ timeout: 30_000 });
  expect(await violations(page)).toEqual([]);

  await page.getByRole('link', { name: 'Send', exact: true }).click();
  expect(await violations(page)).toEqual([]);

  await page.getByRole('link', { name: 'Tools' }).click();
  expect(await violations(page)).toEqual([]);

  await page.getByRole('link', { name: 'Settings' }).click();
  expect(await violations(page)).toEqual([]);

  await page.getByRole('button', { name: 'Change password' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
