export const CLA = 0xd4;
export const INS_GET_PUBLIC_KEY = 0x02;
export const INS_SIGN = 0x04;
export const INS_GET_APP_CONFIGURATION = 0x06;
export const P1_NON_CONFIRM = 0x00;
export const P1_CONFIRM = 0x01;
export const P1_FIRST = 0x00;
export const P1_MORE = 0x80;
export const P2_NONE = 0x00;

const SLICE_SIZE = 150;
const SIGNATURE_BYTES = 65;

export interface Apdu {
  cla: number;
  ins: number;
  p1: number;
  p2: number;
  data: Uint8Array;
}

export function pathComponents(path: string): number[] {
  const trimmed = path.replace(/^m\//, '').trim();
  if (trimmed.length === 0) throw new Error('empty_path');
  return trimmed.split('/').map((segment) => {
    const hardened = segment.endsWith("'") || segment.endsWith('h');
    const digits = hardened ? segment.slice(0, -1) : segment;
    if (!/^\d+$/.test(digits)) throw new Error(`invalid_path_segment:${segment}`);
    const index = Number(digits);
    if (index > 0x7fffffff) throw new Error(`invalid_path_segment:${segment}`);
    return hardened ? index + 0x80000000 : index;
  });
}

export function encodePath(path: string): Uint8Array {
  const components = pathComponents(path);
  const out = new Uint8Array(1 + components.length * 4);
  const view = new DataView(out.buffer);
  out[0] = components.length;
  components.forEach((value, index) => view.setUint32(1 + index * 4, value, false));
  return out;
}

export function publicKeyApdu(path: string, confirm = false): Apdu {
  return {
    cla: CLA,
    ins: INS_GET_PUBLIC_KEY,
    p1: confirm ? P1_CONFIRM : P1_NON_CONFIRM,
    p2: P2_NONE,
    data: encodePath(path),
  };
}

export function appConfigurationApdu(): Apdu {
  return { cla: CLA, ins: INS_GET_APP_CONFIGURATION, p1: 0, p2: 0, data: new Uint8Array(0) };
}

export function parsePublicKey(response: Uint8Array): { publicKey: string; legacy: string } {
  const publicKeyLength = response[0];
  if (publicKeyLength === undefined) throw new Error('short_response');
  const addressLength = response[1 + publicKeyLength];
  if (addressLength === undefined) throw new Error('short_response');
  const publicKey = [...response.slice(1, 1 + publicKeyLength)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const start = 1 + publicKeyLength + 1;
  const legacy = new TextDecoder().decode(response.slice(start, start + addressLength));
  return { publicKey, legacy };
}

export function parseAppConfiguration(response: Uint8Array): string {
  if (response.length < 4) throw new Error('short_response');
  return `${response[1]}.${response[2]}.${response[3]}`;
}

export function signApdus(path: string, chunks: Uint8Array[]): Apdu[] {
  const encodedPath = encodePath(path);
  const payloads: Uint8Array[] = [];
  let first = true;

  for (const chunk of chunks) {
    let offset = 0;
    do {
      const room = first ? SLICE_SIZE - encodedPath.length : SLICE_SIZE;
      const size = Math.min(room, chunk.length - offset);
      const slice = chunk.slice(offset, offset + size);
      if (first) {
        const payload = new Uint8Array(encodedPath.length + slice.length);
        payload.set(encodedPath, 0);
        payload.set(slice, encodedPath.length);
        payloads.push(payload);
        first = false;
      } else {
        payloads.push(slice);
      }
      offset += size;
    } while (offset < chunk.length);
  }

  return payloads.map((data, index) => ({
    cla: CLA,
    ins: INS_SIGN,
    p1: index === 0 ? P1_FIRST : P1_MORE,
    p2: P2_NONE,
    data,
  }));
}

export function parseSignature(response: Uint8Array): Uint8Array {
  if (response.length < SIGNATURE_BYTES) throw new Error('short_response');
  return response.slice(0, SIGNATURE_BYTES);
}
