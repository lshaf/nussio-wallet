import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from './extension';

const PAGE = `<!doctype html>
<html><body style="margin:0;font-family:sans-serif">
<h1>provider probe</h1>
<script>
  window.__call = (method, ...args) =>
    window.nussio[method](...args).then(
      (result) => ({ ok: true, result }),
      (error) => ({ ok: false, error: error.message }),
    );
</script>
</body></html>`;

async function dappServer(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(PAGE);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => server.close() });
    });
  });
}

type CallResult = { ok: boolean; result?: unknown; error?: string };

declare global {
  interface Window {
    __call(method: string, ...args: unknown[]): Promise<CallResult>;
  }
}

test('window.nussio gates on a connection and prompts for login', async ({
  context,
  appPage: page,
}) => {
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

  const dapp = await dappServer();
  const origin = new URL(dapp.url).origin;
  const site = await context.newPage();
  await site.goto(dapp.url);

  expect(await site.evaluate(() => window.nussio?.isNussioWallet)).toBe(true);

  expect(await site.evaluate(() => window.__call('isConnected'))).toEqual({
    ok: true,
    result: false,
  });

  const unknown = await site.evaluate(() =>
    window.postMessage(
      { source: 'nussio-wallet', type: 'provider-call', id: 99, method: 'evil', params: [] },
      '*',
    ),
  );
  expect(unknown).toBeUndefined();

  const gated = await site.evaluate(() =>
    window.__call('transact', { actions: [{ account: 'eosio.token', name: 'transfer' }] }),
  );
  expect(gated).toEqual({ ok: false, error: 'not_connected' });

  const promptPromise = context.waitForEvent('page', { timeout: 30_000 });
  const login = site.evaluate(() => window.__call('login'));
  const prompt = await promptPromise;

  await expect(prompt.getByRole('heading', { name: 'Login request' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(prompt.getByText(`Sent by: ${origin}`)).toBeVisible();

  await prompt.getByRole('button', { name: 'Cancel' }).click();
  expect(await login).toEqual({ ok: false, error: 'rejected' });

  expect(await site.evaluate(() => window.__call('isConnected'))).toEqual({
    ok: true,
    result: false,
  });

  dapp.close();
});
