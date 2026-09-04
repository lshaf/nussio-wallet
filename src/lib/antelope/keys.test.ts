import { describe, expect, it } from 'vitest';
import { isValidPrivateKey, legacyPublicKey, parsePrivateKey, samePublicKey } from './keys';

const wif = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';
const legacy = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV';

describe('keys', () => {
  it('derives the public key from a WIF private key', () => {
    const parsed = parsePrivateKey(wif);
    expect(parsed.wif).toBe(wif);
    expect(parsed.publicKey.startsWith('PUB_K1_')).toBe(true);
    expect(legacyPublicKey(parsed.publicKey, 'EOS')).toBe(legacy);
    expect(legacyPublicKey(parsed.publicKey, 'FIO').startsWith('FIO')).toBe(true);
  });

  it('compares legacy and modern forms as the same key', () => {
    const parsed = parsePrivateKey(wif);
    expect(samePublicKey(parsed.publicKey, legacy)).toBe(true);
    expect(
      samePublicKey(parsed.publicKey, 'EOS5jFvT4h1vqZ1x6dQdKQoNz1JTr5vW5hq1CqHWaRvXj8Y3dGZoP'),
    ).toBe(false);
  });

  it('validates private keys', () => {
    expect(isValidPrivateKey(wif)).toBe(true);
    expect(isValidPrivateKey('not a key')).toBe(false);
  });
});
