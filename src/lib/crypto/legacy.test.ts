import CryptoJS from 'crypto-js';
import { describe, expect, it } from 'vitest';
import { InvalidPasswordError } from './keyring';
import { decryptLegacyKeyring } from './legacy';

function desktopEncrypt(data: string, pass: string, iterations = 4500): string {
  const salt = CryptoJS.lib.WordArray.random(128 / 8);
  const key = CryptoJS.PBKDF2(pass, salt, { iterations, keySize: 256 / 4 });
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

describe('legacy desktop keyring', () => {
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
