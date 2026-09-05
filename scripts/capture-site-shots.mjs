import path from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { deflateRaw, inflateRaw } from 'pako';
import { PlaceholderAuth, PlaceholderName, SigningRequest } from '@wharfkit/signing-request';

const EXTENSION_PATH = path.resolve('dist/chrome-mv3');
const OUT = path.resolve(process.env.SHOTS_DIR ?? 'site/screenshots');
const PASSWORD = 'correct horse battery';
const ACCOUNT = 'greymassfuel';
const JUNGLE4 = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d';
const WIDE = { width: 1160, height: 760 };
const NARROW = { width: 380, height: 620 };
const PROMPT = { width: 380, height: 520 };
const SHORT = { width: 1160, height: 700 };
const COMPACT = { width: 1160, height: 560 };

const zlib = { deflateRaw, inflateRaw };

async function transferRequest() {
  const request = await SigningRequest.create(
    {
      chainId: JUNGLE4,
      action: {
        account: 'eosio.token',
        name: 'transfer',
        authorization: [PlaceholderAuth],
        data: { from: PlaceholderName, to: 'teamgreymass', quantity: '1.0000 EOS', memo: 'coffee' },
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

async function shot(page, name, viewport) {
  if (viewport) await page.setViewportSize(viewport);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('captured', name);
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const context = await chromium.launchPersistentContext('', {
    channel: process.env.E2E_CHANNEL ?? 'chromium',
    colorScheme: 'dark',
    deviceScaleFactor: 2,
    viewport: WIDE,
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
  await page.getByRole('button', { name: 'Validate' }).click();
  await page.getByText('Connected, chain id matches.').waitFor({ timeout: 30_000 });
  await shot(page, 'setup-chains');
  await page.getByRole('button', { name: 'Enable 1 blockchain' }).click();

  await page.getByRole('tab', { name: 'Watch' }).click();
  await page.locator('#watch-account').fill(ACCOUNT);
  await page.getByRole('button', { name: 'Find' }).click();
  await page.getByText(`${ACCOUNT}@active`).waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.waitForURL(/#\/$/);
  await page.getByRole('cell', { name: /EOS$/ }).first().waitFor({ timeout: 30_000 });
  await shot(page, 'home');
  await shot(page, 'home-narrow', NARROW);
  await page.setViewportSize(WIDE);

  await page.getByRole('link', { name: 'Resources' }).click();
  await page.getByText('RAM quota').waitFor({ timeout: 30_000 });
  await shot(page, 'resources', SHORT);
  await page.setViewportSize(WIDE);

  await page.getByRole('link', { name: 'Send', exact: true }).click();
  await page.locator('#send-to').fill('teamgreymass');
  await page.locator('#send-quantity').fill('1');
  await page.locator('#send-memo').fill('invoice 2043');
  await page.getByText(/available$/).waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByText('Review transfer').waitFor();
  await shot(page, 'send-review', COMPACT);
  await page.setViewportSize(WIDE);

  await page.getByRole('link', { name: 'Tools' }).click();
  await page.waitForURL(/#\/tools$/);
  await shot(page, 'tools', SHORT);
  await page.setViewportSize(WIDE);

  await page.getByRole('link', { name: 'Home' }).click();
  const uri = await transferRequest();
  await page.getByRole('button', { name: 'Broadcast transaction' }).click();
  await page.getByRole('tab', { name: 'Signing request' }).click();
  await page.getByPlaceholder('esr://').fill(uri);
  const promptPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Open request' }).click();
  const prompt = await promptPromise;
  await prompt.getByText('eosio.token::transfer').first().waitFor({ timeout: 30_000 });
  await shot(prompt, 'prompt', PROMPT);

  await context.close();
}

await main();
