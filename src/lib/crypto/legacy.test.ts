import CryptoJS from 'crypto-js';
import { describe, expect, it } from 'vitest';
import { InvalidPasswordError } from './keyring';
import { decryptLegacyKeyring, encryptLegacyKeyring } from './legacy';

function desktopEncrypt(data: string, pass: string, iterations = 4500): string {
  const salt = CryptoJS.lib.WordArray.random(128 / 8);
  const key = CryptoJS.PBKDF2(pass, salt, {
    iterations,
    keySize: 256 / 4,
    hasher: CryptoJS.algo.SHA1,
  });
  const iv = CryptoJS.lib.WordArray.random(128 / 8);
  const encrypted = CryptoJS.AES.encrypt(data, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return salt.toString() + iv.toString() + encrypted.toString();
}

const entries = [
  {
    key: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3',
    pubkey: 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV',
  },
];

const desktopBlob =
  '943097df2a25c91e29fcd69baa8f0ece5cb14d5871d92eecb91ae163de18b0f2' +
  'KYYRLBYbadQpGyoQwv6xQHD1BKNgwzRdOz3jYs5qeScy1Sz6Zyd7sKC2n1bIapFedAIGWSW95dGoRmLMKctIccReFPW0WryrgFF' +
  '+Wu4mVCueX2ZEuX8Jr4IFl0sloUrUUb6JE/zkGP59AFOhlosUqQW0U9TztwSfoJGxj1fe9tIQIWDPvMISkhnKOePZFsPq';

describe('legacy desktop keyring', () => {
  it('decrypts a fixed blob from crypto-js 3.x defaults', async () => {
    await expect(decryptLegacyKeyring(desktopBlob, 'hunter2', 100)).resolves.toEqual(entries);
  });

  it('re-encrypts in a form desktop can read back', async () => {
    const blob = await encryptLegacyKeyring(entries, 'hunter2', 100);
    await expect(decryptLegacyKeyring(blob, 'hunter2', 100)).resolves.toEqual(entries);
    expect(blob.slice(0, 64)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('decrypts a blob produced by the desktop algorithm', async () => {
    const blob = desktopEncrypt(JSON.stringify(entries), 'hunter2', 100);
    await expect(decryptLegacyKeyring(blob, 'hunter2', 100)).resolves.toEqual(entries);
  });

  it('rejects a wrong password', async () => {
    const blob = desktopEncrypt(JSON.stringify(entries), 'hunter2', 100);
    await expect(decryptLegacyKeyring(blob, 'nope', 100)).rejects.toBeInstanceOf(
      InvalidPasswordError,
    );
  });
});
