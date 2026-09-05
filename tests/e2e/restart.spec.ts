import { expect, test } from './extension';

test('state survives a service worker restart', async ({ context, appPage: page, extensionId }) => {
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

  const cdp = await context.newCDPSession(page);
  const { targetInfos } = await cdp.send('Target.getTargets');
  const worker = targetInfos.find(
    (target) => target.type === 'service_worker' && target.url.includes(extensionId),
  );
  expect(worker).toBeDefined();
  await cdp.send('Target.closeTarget', { targetId: worker!.targetId });
  await expect.poll(() => context.serviceWorkers().length).toBeGreaterThanOrEqual(0);

  const reopened = await context.newPage();
  await reopened.goto(`chrome-extension://${extensionId}/app.html`);
  await expect(reopened).toHaveURL(/#\/$/);
  await expect(reopened.getByRole('combobox').filter({ hasText: 'eosio@active' })).toBeVisible();
  await expect(reopened.getByRole('button', { name: 'Lock' })).toBeVisible();
  await expect(reopened.getByRole('cell', { name: /EOS$/ }).first()).toBeVisible({
    timeout: 30_000,
  });

  await reopened.getByRole('button', { name: 'Lock' }).click();
  await expect(reopened.getByRole('button', { name: 'Unlock' })).toBeVisible();
});
