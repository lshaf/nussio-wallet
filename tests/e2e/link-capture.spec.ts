import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PlaceholderAuth, PlaceholderName, SigningRequest } from '@wharfkit/signing-request';
import { deflateRaw, inflateRaw } from 'pako';
import { expect, test } from './extension';

const JUNGLE4 = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d';

const zlib = {
  deflateRaw: (data: Uint8Array) => deflateRaw(data),
  inflateRaw: (data: Uint8Array) => inflateRaw(data),
};

const PAGE = `<!doctype html>
<html><body style="margin:0;font-family:sans-serif">
<div id="host"></div>
<script>
  const host = document.getElementById('host');
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML =
    '<a id="launch" href="URI" style="display:block;padding:24px;font-size:20px">Launch Anchor</a>';
  window.__anchorRect = () => {
    const rect = root.getElementById('launch').getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  };
</script>
</body></html>`;

async function dappServer(uri: string): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(PAGE.replace('URI', uri));
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => server.close() });
    });
  });
}

test('captures a signing request link inside a closed shadow root', async ({
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

  const request = SigningRequest.identity(
    { chainId: JUNGLE4, callback: { url: 'https://example.invalid/cb', background: true } },
    { zlib },
  );
  const dapp = await dappServer(request.encode());
  const site = await context.newPage();
  await site.goto(dapp.url);

  const point = await site.evaluate(() =>
    (window as unknown as { __anchorRect: () => { x: number; y: number } }).__anchorRect(),
  );
  const promptPromise = context.waitForEvent('page', { timeout: 30_000 });
  await site.mouse.click(point.x, point.y);
  const prompt = await promptPromise;

  await expect(prompt.getByRole('heading', { name: 'Login request' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(prompt.getByText(`Sent by: ${new URL(dapp.url).origin}`)).toBeVisible();
  await expect(site).toHaveURL(dapp.url);
  dapp.close();
});

test('captures a signing request opened with window.open', async ({ context, appPage: page }) => {
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

  const transfer = await SigningRequest.create(
    {
      chainId: JUNGLE4,
      action: {
        account: 'eosio.token',
        name: 'transfer',
        authorization: [PlaceholderAuth],
        data: { from: PlaceholderName, to: 'greymassfuel', quantity: '0.0001 EOS', memo: 'open' },
      },
    },
    {
      zlib,
      abiProvider: {
        getAbi: async () => {
          const response = await fetch('https://jungle4.greymass.com/v1/chain/get_abi', {
            method: 'POST',
            body: JSON.stringify({ account_name: 'eosio.token' }),
          });
          const body = (await response.json()) as { abi: unknown };
          return body.abi as never;
        },
      },
    },
  );
  const dapp = await dappServer(transfer.encode());
  const site = await context.newPage();
  await site.goto(dapp.url);

  const promptPromise = context.waitForEvent('page', { timeout: 30_000 });
  await site.evaluate((uri) => window.open(uri), transfer.encode());
  const prompt = await promptPromise;

  await expect(prompt.getByRole('heading', { name: 'Signing request' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(prompt.getByText('eosio.token::transfer').first()).toBeVisible({ timeout: 30_000 });
  dapp.close();
});
