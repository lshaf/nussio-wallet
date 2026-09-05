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

function legacyOrEmpty(publicKey: PublicKey, prefix: string): string {
  try {
    return publicKey.toLegacyString(prefix);
  } catch {
    return '';
  }
}

export type KeyInspection =
  | { kind: 'private'; type: string; wif: string; pvt: string; publicKey: string; legacy: string }
  | { kind: 'public'; type: string; publicKey: string; legacy: string }
  | { kind: 'invalid' };

export function inspectKey(value: string, prefix = 'EOS'): KeyInspection {
  const input = value.trim();
  if (input.length === 0) return { kind: 'invalid' };
  try {
    const privateKey = PrivateKey.from(input);
    const publicKey = privateKey.toPublic();
    return {
      kind: 'private',
      type: String(privateKey.type),
      wif: privateKey.toWif(),
      pvt: String(privateKey),
      publicKey: String(publicKey),
      legacy: legacyOrEmpty(publicKey, prefix),
    };
  } catch {
    /* empty */
  }
  try {
    const publicKey = PublicKey.from(input);
    return {
      kind: 'public',
      type: String(publicKey.type),
      publicKey: String(publicKey),
      legacy: legacyOrEmpty(publicKey, prefix),
    };
  } catch {
    return { kind: 'invalid' };
  }
}
