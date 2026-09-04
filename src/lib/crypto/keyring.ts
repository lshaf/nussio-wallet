import { z } from 'zod';
import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from './encoding';

export const keyEntrySchema = z.object({
  pubkey: z.string().min(1),
  key: z.string().min(1),
});
export type KeyEntry = z.infer<typeof keyEntrySchema>;

export const keyringEnvelopeSchema = z.object({
  v: z.literal(3),
  kdf: z.object({
    name: z.literal('PBKDF2'),
    hash: z.literal('SHA-256'),
    iterations: z.number().int().positive(),
    salt: z.string().min(1),
  }),
  cipher: z.object({
    name: z.literal('AES-GCM'),
    iv: z.string().min(1),
  }),
  data: z.string(),
});
export type KeyringEnvelope = z.infer<typeof keyringEnvelopeSchema>;

export const DEFAULT_KDF_ITERATIONS = 600_000;

export class InvalidPasswordError extends Error {
  constructor() {
    super('invalid_password');
    this.name = 'InvalidPasswordError';
  }
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', utf8ToBytes(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptKeyring(
  entries: KeyEntry[],
  password: string,
  iterations = DEFAULT_KDF_ITERATIONS,
): Promise<KeyringEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const plaintext = utf8ToBytes(JSON.stringify(z.array(keyEntrySchema).parse(entries)));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    v: 3,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: bytesToBase64(salt) },
    cipher: { name: 'AES-GCM', iv: bytesToBase64(iv) },
    data: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptKeyring(
  envelope: KeyringEnvelope,
  password: string,
): Promise<KeyEntry[]> {
  const parsed = keyringEnvelopeSchema.parse(envelope);
  const key = await deriveKey(password, base64ToBytes(parsed.kdf.salt), parsed.kdf.iterations);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(parsed.cipher.iv) },
      key,
      base64ToBytes(parsed.data),
    );
  } catch {
    throw new InvalidPasswordError();
  }
  return z.array(keyEntrySchema).parse(JSON.parse(bytesToUtf8(new Uint8Array(plaintext))));
}
