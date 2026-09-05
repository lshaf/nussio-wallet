import {
  Checksum256,
  Serializer,
  UInt8,
  UInt32,
  VarUInt,
  type ABISerializableObject,
  type Action,
  type Transaction,
} from '@wharfkit/antelope';

const OCTET_STRING = 0x04;
const CHAIN_ID_BYTES = 32;

export function berLength(length: number): Uint8Array {
  if (length < 0x80) return Uint8Array.from([length]);
  const bytes: number[] = [];
  let value = length;
  while (value > 0) {
    bytes.unshift(value & 0xff);
    value = Math.floor(value / 256);
  }
  return Uint8Array.from([0x80 | bytes.length, ...bytes]);
}

export function berOctetString(payload: Uint8Array): Uint8Array {
  const header = berLength(payload.length);
  const out = new Uint8Array(1 + header.length + payload.length);
  out[0] = OCTET_STRING;
  out.set(header, 1);
  out.set(payload, 1 + header.length);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function field(object: ABISerializableObject): Uint8Array {
  return berOctetString(Serializer.encode({ object }).array);
}

function varuint(value: number): Uint8Array {
  return field(VarUInt.from(value));
}

function actionChunk(action: Action): Uint8Array {
  const parts = [field(action.account), field(action.name)];
  parts.push(varuint(action.authorization.length));
  for (const auth of action.authorization) {
    parts.push(field(auth.actor), field(auth.permission));
  }
  const data = action.data.array;
  parts.push(varuint(data.length), berOctetString(data));
  return concat(parts);
}

export function ledgerChunks(chainId: string, transaction: Transaction): Uint8Array[] {
  if (transaction.context_free_actions.length > 0) throw new Error('context_free_actions');
  if (transaction.transaction_extensions.length > 0) throw new Error('transaction_extensions');

  const header = concat([
    berOctetString(Checksum256.from(chainId).array),
    field(UInt32.from(transaction.expiration.value)),
    field(transaction.ref_block_num),
    field(transaction.ref_block_prefix),
    varuint(0),
    field(UInt8.from(transaction.max_cpu_usage_ms)),
    varuint(Number(transaction.delay_sec)),
    varuint(0),
    varuint(transaction.actions.length),
  ]);

  const footer = concat([varuint(0), berOctetString(new Uint8Array(CHAIN_ID_BYTES))]);

  return [header, ...transaction.actions.map(actionChunk), footer];
}
