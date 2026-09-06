import {
  appConfigurationApdu,
  parseAppConfiguration,
  parsePublicKey,
  parseSignature,
  publicKeyApdu,
  signApdus,
  type ApduSender,
} from './apdu';

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class LedgerSession {
  constructor(private readonly sender: ApduSender) {}

  async appVersion(): Promise<string> {
    return parseAppConfiguration(await this.sender.send(appConfigurationApdu()));
  }

  async legacyKey(path: string, confirm = false): Promise<string> {
    return parsePublicKey(await this.sender.send(publicKeyApdu(path, confirm))).legacy;
  }

  async sign(path: string, chunks: string[]): Promise<string> {
    const apdus = signApdus(
      path,
      chunks.map((chunk) => fromHex(chunk)),
    );
    let response: Uint8Array = new Uint8Array(0);
    for (const apdu of apdus) response = await this.sender.send(apdu);
    const signature = toHex(parseSignature(response));
    await this.release();
    return signature;
  }

  async release(): Promise<void> {
    try {
      await this.sender.send(appConfigurationApdu());
    } catch {
      return;
    }
  }
}
