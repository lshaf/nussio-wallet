import { deflateRaw, inflateRaw } from 'pako';
import { PlaceholderAuth, PlaceholderName, SigningRequest } from '@wharfkit/signing-request';
import { expect, test } from './extension';

const JUNGLE4 = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d';

const zlib = {
  deflateRaw: (data: Uint8Array) => deflateRaw(data),
  inflateRaw: (data: Uint8Array) => inflateRaw(data),
};

async function transferRequest(): Promise<string> {
  const request = await SigningRequest.create(
    {
      chainId: JUNGLE4,
      action: {
        account: 'eosio.token',
        name: 'transfer',
        authorization: [PlaceholderAuth],
        data: { from: PlaceholderName, to: 'greymassfuel', quantity: '0.0001 EOS', memo: 'e2e' },
      },
      callback: { url: 'https://example.invalid/callback', background: true },
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
  return request.encode();
}

test('pasted signing request opens the prompt and exports unsigned for a watch wallet', async ({
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

  const uri = await transferRequest();
  await page.getByRole('button', { name: 'Broadcast transaction' }).click();
  await page.getByRole('tab', { name: 'Signing request' }).click();
  await page.getByPlaceholder('esr://').fill(uri);
  const promptPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Open request' }).click();
  const prompt = await promptPromise;
  prompt.on('pageerror', (error) => console.error('[prompt pageerror]', error.message));

  await expect(prompt.getByRole('heading', { name: 'Signing request' })).toBeVisible();
  await expect(prompt.getByText('eosio.token::transfer').first()).toBeVisible({ timeout: 30_000 });
  await expect(prompt.getByRole('combobox', { name: 'Sign as' })).toContainText('eosio@active');
  await expect(prompt.getByText('example.invalid').first()).toBeVisible();
  if (process.env.E2E_SHOTS)
    await prompt.screenshot({ path: `${process.env.E2E_SHOTS}/09-prompt-review.png` });
  await prompt.getByRole('button', { name: 'Export unsigned' }).click();
  await expect(prompt.getByText(/^esr:/)).toBeVisible({ timeout: 30_000 });
  await expect(prompt.getByRole('button', { name: 'Download JSON' })).toBeVisible();
  if (process.env.E2E_SHOTS)
    await prompt.screenshot({ path: `${process.env.E2E_SHOTS}/10-prompt-unsigned.png` });

  await expect(page.getByText(/signing request is waiting/)).toBeVisible();
  await prompt.close();
  await expect(page.getByText(/signing request is waiting/)).toBeHidden({ timeout: 10_000 });
});
