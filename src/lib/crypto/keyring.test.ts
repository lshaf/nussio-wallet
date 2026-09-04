import { describe, expect, it } from 'vitest';
import {
  decryptKeyring,
  encryptKeyring,
  InvalidPasswordError,
  keyringEnvelopeSchema,
} from './keyring';

const entries = [
  {
    pubkey: 'PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV',
    key: '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3',
  },
];

describe('keyring', () => {
  it('round-trips entries with the right password', async () => {
    const envelope = await encryptKeyring(entries, 'correct horse', 1000);
    expect(keyringEnvelopeSchema.safeParse(envelope).success).toBe(true);
    expect(envelope.kdf.iterations).toBe(1000);
    await expect(decryptKeyring(envelope, 'correct horse')).resolves.toEqual(entries);
  });

  it('rejects a wrong password', async () => {
    const envelope = await encryptKeyring(entries, 'correct horse', 1000);
    await expect(decryptKeyring(envelope, 'wrong')).rejects.toBeInstanceOf(InvalidPasswordError);
  });

  it('produces distinct salt and iv per encryption', async () => {
    const a = await encryptKeyring(entries, 'pw', 1000);
    const b = await encryptKeyring(entries, 'pw', 1000);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
    expect(a.data).not.toBe(b.data);
  });
});
