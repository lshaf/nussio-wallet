import path from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { deflateRaw, inflateRaw } from 'pako';
import { PlaceholderAuth, PlaceholderName, SigningRequest } from '@wharfkit/signing-request';

const EXTENSION_PATH = path.resolve('dist/chrome-mv3');
const OUT = path.resolve(process.env.SHOTS_DIR ?? 'store/screenshots');
const PASSWORD = 'correct horse battery';
const ACCOUNTS = ['greymassfuel', 'teamgreymass'];
const JUNGLE4 = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d';
const STORE = { width: 1280, height: 800 };
const PROMPT = { width: 420, height: 505 };

const zlib = { deflateRaw, inflateRaw };

async function transferRequest() {
  const request = await SigningRequest.create(
    {
      chainId: JUNGLE4,
      action: {
        account: 'eosio.token',
        name: 'transfer',
        authorization: [PlaceholderAuth],
        data: {
          from: PlaceholderName,
          to: 'teamgreymass',
          quantity: '25.0000 EOS',
          memo: 'invoice 2043',
        },
      },
      callback: { url: 'https://app.example.com/callback', background: true },
    },
    {
      zlib,
      abiProvider: {
        getAbi: async () => {
          const response = await fetch('https://jungle4.greymass.com/v1/chain/get_abi', {
            method: 'POST',
            body: JSON.stringify({ account_name: 'eosio.token' }),
          });
          const body = await response.json();
          return body.abi;
        },
      },
    },
  );
  return request.encode();
}

async function shot(page, name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('captured', name, `${STORE.width}x${STORE.height}`);
}

async function framed(context, page, name) {
  await page.waitForTimeout(700);
  const inner = await page.screenshot();
  const canvas = await context.newPage();
  await canvas.setViewportSize(STORE);
  await canvas.setContent(`<style>
    html,body{margin:0;height:100%}
    body{display:grid;place-items:center;background:radial-gradient(circle at 50% 30%,#16233f,#0a1220 70%)}
    img{width:${PROMPT.width}px;border-radius:12px;box-shadow:0 30px 70px rgba(0,0,0,.55)}
  </style><img src="data:image/png;base64,${inner.toString('base64')}">`);
  await canvas.waitForTimeout(400);
  await canvas.screenshot({ path: path.join(OUT, `${name}.png`) });
  await canvas.close();
  console.log('captured', name, `${STORE.width}x${STORE.height}`);
}

async function importWatch(page, extensionId, account) {
  await page.goto(`chrome-extension://${extensionId}/app.html#/setup/import`);
  await page.getByRole('tab', { name: 'Watch' }).click();
  await page.locator('#watch-account').fill(account);
  await page.getByRole('button', { name: 'Find' }).click();
  await page.getByText(`${account}@active`).waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.waitForURL(/#\/$/, { timeout: 30_000 });
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const context = await chromium.launchPersistentContext('', {
    channel: process.env.E2E_CHANNEL ?? 'chromium',
    colorScheme: 'dark',
    deviceScaleFactor: 1,
    viewport: STORE,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const extensionId = worker.url().split('/')[2];

  const page = await context.newPage();
  page.on('pageerror', (error) => console.error('[pageerror]', error.message));
  await page.goto(`chrome-extension://${extensionId}/app.html`);

  await page.getByRole('button', { name: 'Set up a wallet' }).click();
  await page.locator('#password').fill(PASSWORD);
  await page.locator('#password-confirm').fill(PASSWORD);
  await page.getByRole('button', { name: 'Set password' }).click();
  await page.locator('#chain-jungle4').click();
  await page.getByRole('button', { name: 'Enable 1 blockchain' }).click();

  for (const account of ACCOUNTS) await importWatch(page, extensionId, account);

  await page.goto(`chrome-extension://${extensionId}/app.html#/`);
  await page.getByRole('cell', { name: /EOS$/ }).first().waitFor({ timeout: 30_000 });
  await shot(page, '01-overview');

  const uri = await transferRequest();
  await page.getByRole('button', { name: 'Broadcast transaction' }).click();
  await page.getByRole('tab', { name: 'Signing request' }).click();
  await page.getByPlaceholder('esr://').fill(uri);
  const promptPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Open request' }).click();
  const prompt = await promptPromise;
  await prompt.setViewportSize(PROMPT);
  await prompt.getByText('eosio.token::transfer').first().waitFor({ timeout: 30_000 });
  await framed(context, prompt, '02-prompt');
  await prompt.close();

  await page.goto(`chrome-extension://${extensionId}/app.html#/account/${ACCOUNTS[0]}`);
  await page.getByText('RAM quota').waitFor({ timeout: 30_000 });
  await shot(page, '03-resources');

  await page.goto(`chrome-extension://${extensionId}/app.html#/governance`);
  await page.getByText('lioninjungle').first().waitFor({ timeout: 30_000 });
  for (const producer of ['lioninjungle', 'ohtigertiger', 'dabbleronion']) {
    const box = page.locator(`#producer-${producer}`);
    if (await box.count()) await box.click();
  }
  await shot(page, '04-governance');

  await page.goto(`chrome-extension://${extensionId}/app.html#/tools`);
  await page.waitForURL(/#\/tools$/);
  await shot(page, '05-tools');

  await context.close();
  await writeFile(
    path.join(OUT, 'README.md'),
    `# Store screenshots\n\n1280x800 PNG, regenerate with \`pnpm shots:store\`.\n`,
  );
}

await main();
