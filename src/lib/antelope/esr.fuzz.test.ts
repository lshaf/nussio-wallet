import { describe, expect, it } from 'vitest';
import { deflateRaw } from 'pako';
import { MAX_INFLATED_BYTES, MAX_REQUEST_LENGTH, parseSigningRequest, zlib } from './esr';

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

describe('signing request parser hardening', () => {
  it('refuses malformed payloads instead of hanging', () => {
    const payloads = [
      'esr:',
      'esr://',
      'esr:!!!!',
      'esr:AAAAAAAAAAAAAAAA',
      'esr:gmNgY',
      'anchor://not-base64$$$',
      'esr:' + 'A'.repeat(1024),
      'esr:' + base64url(new Uint8Array([1, 2, 3, 4, 5])),
      'esr:' + base64url(new Uint8Array(64).fill(255)),
    ];
    for (const payload of payloads) {
      expect(() => parseSigningRequest(payload)).toThrow();
    }
  });

  it('refuses a request longer than the cap', () => {
    const long = `esr:${'A'.repeat(MAX_REQUEST_LENGTH)}`;
    expect(() => parseSigningRequest(long)).toThrow('request_too_large');
  });

  it('refuses a compression bomb before decoding it', () => {
    const bomb = deflateRaw(new Uint8Array(MAX_INFLATED_BYTES * 2), { level: 9 });
    expect(bomb.length).toBeLessThan(4096);
    expect(() => zlib.inflateRaw(bomb)).toThrow('request_too_large');
  });

  it('still inflates a normal payload', () => {
    const data = new Uint8Array(256).fill(7);
    expect(zlib.inflateRaw(deflateRaw(data))).toEqual(data);
  });
});
