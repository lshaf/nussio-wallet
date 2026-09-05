import { z } from 'zod';
import { InvalidPasswordError, keyEntrySchema, type KeyEntry } from './keyring';

export const LEGACY_KDF_ITERATIONS = 4500;

const legacyEntrySchema = z.object({ key: z.string().min(1), pubkey: z.string().min(1) });

export async function decryptLegacyKeyring(
  blob: string,
  password: string,
  iterations = LEGACY_KDF_ITERATIONS,
): Promise<KeyEntry[]> {
  const { default: CryptoJS } = await import('crypto-js');
  const salt = CryptoJS.enc.Hex.parse(blob.slice(0, 32));
  const iv = CryptoJS.enc.Hex.parse(blob.slice(32, 64));
  const ciphertext = blob.slice(64);
  const key = CryptoJS.PBKDF2(password, salt, {
    iterations,
    keySize: 64,
    hasher: CryptoJS.algo.SHA1,
  });
  let text: string;
  try {
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    text = decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    throw new InvalidPasswordError();
  }
  if (!text) throw new InvalidPasswordError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidPasswordError();
  }
  return z
    .array(legacyEntrySchema)
    .parse(parsed)
    .map((entry) => keyEntrySchema.parse({ pubkey: entry.pubkey, key: entry.key }));
}

export async function encryptLegacyKeyring(
  entries: KeyEntry[],
  password: string,
  iterations = LEGACY_KDF_ITERATIONS,
): Promise<string> {
  const { default: CryptoJS } = await import('crypto-js');
  const salt = CryptoJS.lib.WordArray.random(16);
  const iv = CryptoJS.lib.WordArray.random(16);
  const key = CryptoJS.PBKDF2(password, salt, {
    iterations,
    keySize: 64,
    hasher: CryptoJS.algo.SHA1,
  });
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(entries), key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return salt.toString() + iv.toString() + encrypted.toString();
}
