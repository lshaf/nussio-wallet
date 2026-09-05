import { describe, expect, it } from 'vitest';
import { Checksum256, PrivateKey, Transaction } from '@wharfkit/antelope';
import { INS_GET_PUBLIC_KEY, INS_SIGN, type Apdu } from './apdu';
import { DEFAULT_PATH, LedgerAntelope, pathAt, type ApduSender } from './device';

const JUNGLE4 = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d';
const KEY = PrivateKey.from('5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3');

function transaction() {
  return Transaction.from({
    expiration: '2026-09-06T00:00:00',
    ref_block_num: 1234,
    ref_block_prefix: 56789,
    max_net_usage_words: 0,
    max_cpu_usage_ms: 0,
    delay_sec: 0,
    context_free_actions: [],
    actions: [
      {
        account: 'eosio.token',
        name: 'transfer',
        authorization: [{ actor: 'nussiowallet', permission: 'active' }],
        data: 'ab'.repeat(16),
      },
    ],
    transaction_extensions: [],
  });
}

class FakeLedger implements ApduSender {
  readonly sent: Apdu[] = [];
  constructor(private readonly reply: (apdu: Apdu) => Uint8Array) {}
  async send(apdu: Apdu): Promise<Uint8Array> {
    this.sent.push(apdu);
    return this.reply(apdu);
  }
}

describe('ledger device', () => {
  it('turns the legacy key the device reports into a modern public key', async () => {
    const legacy = new TextEncoder().encode(KEY.toPublic().toLegacyString());
    const device = new LedgerAntelope(
      new FakeLedger(
        () => new Uint8Array([65, ...new Uint8Array(65).fill(4), legacy.length, ...legacy]),
      ),
    );
    const account = await device.getAccount();
    expect(account.path).toBe(DEFAULT_PATH);
    expect(account.publicKey).toBe(String(KEY.toPublic()));
    expect(account.legacy.startsWith('EOS')).toBe(true);
  });

  it('asks for one key per derivation index', async () => {
    expect(pathAt(3)).toBe("44'/194'/0'/0/3");
    const legacy = new TextEncoder().encode(KEY.toPublic().toLegacyString());
    const sender = new FakeLedger(
      () => new Uint8Array([65, ...new Uint8Array(65).fill(4), legacy.length, ...legacy]),
    );
    const device = new LedgerAntelope(sender);
    await device.getAccount(pathAt(1));
    expect(sender.sent[0]!.ins).toBe(INS_GET_PUBLIC_KEY);
  });

  it('rebuilds a signature the device returns so it verifies against the digest', async () => {
    const tx = transaction();
    const digest = tx.signingDigest(Checksum256.from(JUNGLE4));
    const real = KEY.signDigest(digest);
    const raw = real.data.array;
    expect(raw.length).toBe(65);

    const sender = new FakeLedger(() => raw);
    const device = new LedgerAntelope(sender);
    const signature = await device.signTransaction(DEFAULT_PATH, JUNGLE4, tx);

    expect(String(signature)).toBe(String(real));
    expect(signature.verifyDigest(digest, KEY.toPublic())).toBe(true);
    expect(sender.sent.every((apdu) => apdu.ins === INS_SIGN)).toBe(true);
    expect(sender.sent.length).toBeGreaterThan(1);
  });

  it('reads the app version', async () => {
    const device = new LedgerAntelope(new FakeLedger(() => Uint8Array.from([0, 1, 7, 0])));
    expect(await device.appVersion()).toBe('1.7.0');
  });
});
