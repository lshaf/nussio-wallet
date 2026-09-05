import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PrivateKey } from '@wharfkit/antelope';
import { LinkCreate } from '@greymass/anchor-link-session-manager';
import { SigningRequest } from '@wharfkit/signing-request';
import { deflateRaw, inflateRaw } from 'pako';
import { expect, test } from './extension';

declare const chrome: {
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
};

const JUNGLE4 = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d';
const DEV_KEY = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';

const zlib = {
  deflateRaw: (data: Uint8Array) => deflateRaw(data),
  inflateRaw: (data: Uint8Array) => inflateRaw(data),
};

function callbackServer(): Promise<{
  url: string;
  received: Promise<Record<string, string>>;
  close: () => void;
}> {
  return new Promise((resolve) => {
    let deliver: (body: Record<string, string>) => void = () => undefined;
    const received = new Promise<Record<string, string>>((done) => (deliver = done));
    const server = http.createServer((request, response) => {
      let body = '';
      request.on('data', (chunk: Buffer) => (body += chunk.toString()));
      request.on('end', () => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{}');
        deliver(JSON.parse(body) as Record<string, string>);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}/callback`, received, close: () => server.close() });
    });
  });
}

test('identity login returns link fields and records a session', async ({
  context,
  appPage: page,
}) => {
  await page.getByRole('button', { name: 'Set up a wallet' }).click();
  await page.locator('#password').fill('correct horse battery');
  await page.locator('#password-confirm').fill('correct horse battery');
  await page.getByRole('button', { name: 'Set password' }).click();
  await page.locator('#chain-jungle4').click();
  await page.getByRole('button', { name: 'Enable 1 blockchain' }).click();
  await expect(page).toHaveURL(/#\/setup\/import$/);

  await page.evaluate(async () => {
    const stored = (await chrome.storage.local.get('settings')) as {
      settings?: Record<string, unknown>;
    };
    await chrome.storage.local.set({ settings: { ...stored.settings, advancedOptions: true } });
  });
  await page.getByRole('tab', { name: 'Manual' }).click();
  await page.locator('#manual-account').fill('eosio');
  await page.locator('#manual-permission').fill('active');
  await page.locator('#manual-wif').fill(DEV_KEY);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.locator('#confirm-password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page).toHaveURL(/#\/$/);

  const server = await callbackServer();
  const appKey = PrivateKey.generate('K1');
  const request = SigningRequest.identity(
    {
      chainId: JUNGLE4,
      callback: { url: server.url, background: true },
      info: { link: LinkCreate.from({ session_name: 'e2eapp', request_key: appKey.toPublic() }) },
    },
    { zlib },
  );
  const uri = request.encode();

  await page.getByRole('button', { name: 'Broadcast transaction' }).click();
  await page.getByRole('tab', { name: 'Signing request' }).click();
  await page.getByPlaceholder('esr://').fill(uri);
  const promptPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Open request' }).click();
  const prompt = await promptPromise;
  prompt.on('pageerror', (error) => console.error('[prompt pageerror]', error.message));

  await expect(prompt.getByRole('heading', { name: 'Login request' })).toBeVisible();
  await expect(prompt.getByRole('heading', { name: 'Login to e2eapp' })).toBeVisible();
  await prompt.getByRole('button', { name: /Login as eosio@active/ }).click();

  const payload = await server.received;
  server.close();
  expect(payload.sa).toBe('eosio');
  expect(payload.sp).toBe('active');
  expect(payload.cid).toBe(JUNGLE4);
  expect(payload.sig).toMatch(/^SIG_K1_/);
  expect(payload.link_name).toBe('Nussio Wallet');
  expect(payload.link_key).toMatch(/^PUB_K1_/);
  expect(payload.link_ch).toMatch(/^https:\/\/cb\.anchor\.link\/[0-9a-f-]{36}$/);
  expect(JSON.parse(payload.link_meta!)).toEqual({ sameDevice: false });

  await page.goto(page.url().replace(/#.*$/, '#/settings'));
  await expect(page.getByText('e2eapp')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('eosio@active').first()).toBeVisible();
  if (process.env.E2E_SHOTS) {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByText('Connected apps').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/11-sessions.png` });
  }
});
