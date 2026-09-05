import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  Bytes,
  Checksum512,
  PrivateKey,
  PublicKey,
  Serializer,
  UInt64,
  type PrivateKeyType,
} from '@wharfkit/antelope';
import { LinkCreate, SealedMessage } from '@greymass/anchor-link-session-manager';
import { SigningRequest } from '@wharfkit/signing-request';
import { AES_CBC } from 'asmcrypto.js';
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

function sealMessage(message: string, privateKey: PrivateKeyType, publicKey: PublicKey) {
  const key = PrivateKey.from(privateKey);
  const nonce = UInt64.random();
  const secret = key.sharedSecret(publicKey);
  const derived = Checksum512.hash(Serializer.encode({ object: nonce }).appending(secret.array));
  const cbc = new AES_CBC(derived.array.slice(0, 32), derived.array.slice(32, 48));
  const ciphertext = Bytes.from(cbc.encrypt(Bytes.from(message, 'utf8').array));
  const checksum = new DataView(derived.array.buffer).getUint32(0, true);
  return SealedMessage.from({ from: key.toPublic(), nonce, ciphertext, checksum });
}

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

test.skip(!process.env.E2E_SLOW, 'set E2E_SLOW=1 to run the service worker idle test');
test.setTimeout(240_000);

test('idle worker still receives sealed transactions', async ({ context, appPage: page }) => {
  await page.getByRole('button', { name: 'Set up a wallet' }).click();
  await page.locator('#password').fill('correct horse battery');
  await page.locator('#password-confirm').fill('correct horse battery');
  await page.getByRole('button', { name: 'Set password' }).click();
  await page.locator('#chain-jungle4').click();
  await page.getByRole('button', { name: 'Enable 1 blockchain' }).click();
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

  const login = await callbackServer();
  const appKey = PrivateKey.generate('K1');
  const identity = SigningRequest.identity(
    {
      chainId: JUNGLE4,
      callback: { url: login.url, background: true },
      info: { link: LinkCreate.from({ session_name: 'e2eapp', request_key: appKey.toPublic() }) },
    },
    { zlib },
  );

  await page.getByRole('button', { name: 'Broadcast transaction' }).click();
  await page.getByRole('tab', { name: 'Signing request' }).click();
  await page.getByPlaceholder('esr://').fill(identity.encode());
  const loginPromptPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Open request' }).click();
  const loginPrompt = await loginPromptPromise;
  await loginPrompt.getByRole('button', { name: /Login as eosio@active/ }).click();

  const payload = await login.received;
  login.close();
  const channelUrl = payload.link_ch!;
  const walletKey = PublicKey.from(payload.link_key!);
  expect(channelUrl).toMatch(/^https:\/\/cb\.anchor\.link\//);

  const transfer = await SigningRequest.create(
    {
      chainId: JUNGLE4,
      action: {
        account: 'eosio.token',
        name: 'transfer',
        authorization: [{ actor: 'eosio', permission: 'active' }],
        data: { from: 'eosio', to: 'greymassfuel', quantity: '0.0001 EOS', memo: 'session' },
      },
      broadcast: false,
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

  await page.close();
  const idle = Number(process.env.IDLE_SECONDS ?? 75);
  console.log(`waiting ${idle}s for the service worker to go idle`);
  await new Promise((resolve) => setTimeout(resolve, idle * 1000));
  console.log('workers now:', context.serviceWorkers().length);

  const sealed = sealMessage(transfer.encode(true, false, 'esr:'), appKey, walletKey);
  const service = new URL(channelUrl).origin;
  const channel = new URL(channelUrl).pathname.substring(1);

  const signPromptPromise = context.waitForEvent('page', { timeout: 30_000 });
  const delivery = await fetch(`${service}/${channel}`, {
    method: 'POST',
    body: Buffer.from(Serializer.encode({ object: sealed }).array),
    headers: { 'X-Buoy-Wait': '10' },
  });
  expect(delivery.status).toBeLessThan(300);

  const signPrompt = await signPromptPromise;
  signPrompt.on('pageerror', (error) => console.error('[prompt pageerror]', error.message));
  await expect(signPrompt.getByRole('heading', { name: 'Signing request' })).toBeVisible();
  await expect(signPrompt.getByText('eosio.token::transfer').first()).toBeVisible({
    timeout: 30_000,
  });
});
