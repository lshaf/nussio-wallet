import { PrivateKey, PublicKey } from '@wharfkit/antelope';

export interface ParsedPrivateKey {
  privateKey: PrivateKey;
  publicKey: string;
  wif: string;
}

export function parsePrivateKey(value: string): ParsedPrivateKey {
  const privateKey = PrivateKey.from(value.trim());
  return {
    privateKey,
    publicKey: String(privateKey.toPublic()),
    wif: privateKey.toWif(),
  };
}

export function isValidPrivateKey(value: string): boolean {
  try {
    parsePrivateKey(value);
    return true;
  } catch {
    return false;
  }
}

export function normalizePublicKey(value: string): string {
  return String(PublicKey.from(value.trim()));
}

export function legacyPublicKey(value: string, prefix = 'EOS'): string {
  return PublicKey.from(value).toLegacyString(prefix);
}

export function samePublicKey(a: string, b: string): boolean {
  try {
    return PublicKey.from(a).equals(PublicKey.from(b));
  } catch {
    return false;
  }
}
