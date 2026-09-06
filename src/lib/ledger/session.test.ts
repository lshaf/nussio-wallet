import { describe, expect, it } from 'vitest';
import {
  INS_GET_APP_CONFIGURATION,
  INS_GET_PUBLIC_KEY,
  INS_SIGN,
  P1_FIRST,
  P1_MORE,
  type Apdu,
  type ApduSender,
} from './apdu';
import { LedgerSession, fromHex, toHex } from './session';

const LEGACY = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV';

class FakeLedger implements ApduSender {
  readonly sent: Apdu[] = [];
  constructor(private readonly reply: (apdu: Apdu) => Uint8Array) {}
  async send(apdu: Apdu): Promise<Uint8Array> {
    this.sent.push(apdu);
    return this.reply(apdu);
  }
}

function publicKeyResponse(legacy = LEGACY): Uint8Array {
  const address = new TextEncoder().encode(legacy);
  const compressed = new Uint8Array(33).fill(2);
  const out = new Uint8Array(1 + compressed.length + 1 + address.length);
  out[0] = compressed.length;
  out.set(compressed, 1);
  out[1 + compressed.length] = address.length;
  out.set(address, 2 + compressed.length);
  return out;
}

describe('LedgerSession', () => {
  it('reads the app version from the configuration response', async () => {
    const device = new FakeLedger(() => new Uint8Array([0, 1, 4, 2]));
    await expect(new LedgerSession(device).appVersion()).resolves.toBe('1.4.2');
    expect(device.sent[0]?.ins).toBe(INS_GET_APP_CONFIGURATION);
  });

  it('returns the legacy key string the device reports', async () => {
    const device = new FakeLedger(() => publicKeyResponse());
    await expect(new LedgerSession(device).legacyKey("44'/194'/0'/0/1")).resolves.toBe(LEGACY);
    expect(device.sent[0]?.ins).toBe(INS_GET_PUBLIC_KEY);
    expect(device.sent[0]?.p1).toBe(0);
  });

  it('asks the device to display the key when confirming', async () => {
    const device = new FakeLedger(() => publicKeyResponse());
    await new LedgerSession(device).legacyKey("44'/194'/0'/0/0", true);
    expect(device.sent[0]?.p1).toBe(1);
  });

  it('marks the first sign packet and continues the rest', async () => {
    const signature = new Uint8Array(65).fill(9);
    const device = new FakeLedger(() => signature);
    const chunks = [toHex(new Uint8Array(200).fill(1)), toHex(new Uint8Array(30).fill(2))];
    const result = await new LedgerSession(device).sign("44'/194'/0'/0/0", chunks);
    const signing = device.sent.filter((apdu) => apdu.ins === INS_SIGN);
    expect(result).toBe(toHex(signature));
    expect(signing[0]?.p1).toBe(P1_FIRST);
    expect(signing.slice(1).every((apdu) => apdu.p1 === P1_MORE)).toBe(true);
    expect(signing.length).toBeGreaterThan(1);
  });

  it('closes the exchange after a signature so the device leaves its confirmation screen', async () => {
    const device = new FakeLedger((apdu) =>
      apdu.ins === INS_SIGN ? new Uint8Array(65).fill(9) : new Uint8Array([0, 1, 4, 2]),
    );
    await new LedgerSession(device).sign("44'/194'/0'/0/0", [toHex(new Uint8Array(10).fill(1))]);
    expect(device.sent.at(-1)?.ins).toBe(INS_GET_APP_CONFIGURATION);
  });

  it('keeps the signature when the closing exchange fails', async () => {
    let signed = false;
    const device = new FakeLedger((apdu) => {
      if (apdu.ins === INS_SIGN) {
        signed = true;
        return new Uint8Array(65).fill(3);
      }
      if (signed) throw new Error('device_gone');
      return new Uint8Array([0, 1, 4, 2]);
    });
    const result = await new LedgerSession(device).sign("44'/194'/0'/0/0", [
      toHex(new Uint8Array(10).fill(1)),
    ]);
    expect(result).toBe(toHex(new Uint8Array(65).fill(3)));
  });

  it('round-trips bytes through hex', () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, index) => index * 7);
    expect([...fromHex(toHex(bytes))]).toEqual([...bytes]);
  });
});
