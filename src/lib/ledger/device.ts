import { Bytes, KeyType, PublicKey, Signature, type Transaction } from '@wharfkit/antelope';
import {
  appConfigurationApdu,
  parseAppConfiguration,
  parsePublicKey,
  parseSignature,
  publicKeyApdu,
  signApdus,
  type Apdu,
} from './apdu';
import { ledgerChunks } from './serialize';

export const DEFAULT_PATH = "44'/194'/0'/0/0";

export interface ApduSender {
  send(apdu: Apdu): Promise<Uint8Array>;
}

export interface LedgerAccount {
  path: string;
  publicKey: string;
  legacy: string;
}

export function pathAt(index: number): string {
  return `44'/194'/0'/0/${index}`;
}

export class LedgerAntelope {
  private readonly sender: ApduSender;

  constructor(sender: ApduSender) {
    this.sender = sender;
  }

  async appVersion(): Promise<string> {
    return parseAppConfiguration(await this.sender.send(appConfigurationApdu()));
  }

  async getAccount(path = DEFAULT_PATH, confirm = false): Promise<LedgerAccount> {
    const response = await this.sender.send(publicKeyApdu(path, confirm));
    const { legacy } = parsePublicKey(response);
    return { path, publicKey: String(PublicKey.from(legacy)), legacy };
  }

  async signTransaction(
    path: string,
    chainId: string,
    transaction: Transaction,
  ): Promise<Signature> {
    const apdus = signApdus(path, ledgerChunks(chainId, transaction));
    let response: Uint8Array = new Uint8Array(0);
    for (const apdu of apdus) response = await this.sender.send(apdu);
    return new Signature(KeyType.K1, Bytes.from(parseSignature(response)));
  }
}
