import { describe, expect, it } from 'vitest';
import {
  CLA,
  INS_SIGN,
  P1_FIRST,
  P1_MORE,
  encodePath,
  parseAppConfiguration,
  parsePublicKey,
  parseSignature,
  pathComponents,
  publicKeyApdu,
  signApdus,
} from './apdu';

const DEFAULT_PATH = "44'/194'/0'/0/0";

const hex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

describe('bip32 paths', () => {
  it('hardens the segments that carry a quote', () => {
    expect(pathComponents(DEFAULT_PATH)).toEqual([0x8000002c, 0x800000c2, 0x80000000, 0, 0]);
    expect(pathComponents("m/44'/194'/0'/0/0")).toEqual(pathComponents(DEFAULT_PATH));
    expect(pathComponents('44h/194h/0h/0/0')).toEqual(pathComponents(DEFAULT_PATH));
  });

  it('rejects paths the device would reject', () => {
    expect(() => pathComponents('')).toThrow('empty_path');
    expect(() => pathComponents("44'/x/0")).toThrow('invalid_path_segment');
    expect(() => pathComponents("44'/-1/0")).toThrow('invalid_path_segment');
  });

  it('writes the component count then big endian words', () => {
    expect(hex(encodePath(DEFAULT_PATH))).toBe('058000002c800000c28000000000000000' + '00000000');
    expect(encodePath(DEFAULT_PATH).length).toBe(21);
  });

  it('builds the public key request', () => {
    const apdu = publicKeyApdu(DEFAULT_PATH);
    expect(apdu.cla).toBe(CLA);
    expect(apdu.ins).toBe(0x02);
    expect(apdu.p1).toBe(0);
    expect(publicKeyApdu(DEFAULT_PATH, true).p1).toBe(1);
  });
});

describe('responses', () => {
  it('reads the uncompressed key and the legacy string', () => {
    const key = new Uint8Array(65).fill(0x04);
    const legacy = new TextEncoder().encode('EOS6MRy');
    const response = new Uint8Array([65, ...key, legacy.length, ...legacy]);
    const parsed = parsePublicKey(response);
    expect(parsed.publicKey).toBe('04'.repeat(65));
    expect(parsed.legacy).toBe('EOS6MRy');
  });

  it('reads the app version', () => {
    expect(parseAppConfiguration(Uint8Array.from([0, 1, 4, 2]))).toBe('1.4.2');
    expect(() => parseAppConfiguration(Uint8Array.from([0]))).toThrow('short_response');
  });

  it('keeps only the 65 signature bytes', () => {
    const response = new Uint8Array(70).fill(7);
    expect(parseSignature(response).length).toBe(65);
    expect(() => parseSignature(new Uint8Array(10))).toThrow('short_response');
  });
});

describe('sign apdus', () => {
  it('marks the first frame FIRST and the rest MORE', () => {
    const apdus = signApdus(DEFAULT_PATH, [new Uint8Array(10).fill(1)]);
    expect(apdus).toHaveLength(1);
    expect(apdus[0]!.p1).toBe(P1_FIRST);
    expect(apdus[0]!.ins).toBe(INS_SIGN);

    const many = signApdus(DEFAULT_PATH, [new Uint8Array(400).fill(1)]);
    expect(many[0]!.p1).toBe(P1_FIRST);
    expect(many.slice(1).every((apdu) => apdu.p1 === P1_MORE)).toBe(true);
  });

  it('prefixes the path on the first frame only and never exceeds the slice size', () => {
    const apdus = signApdus(DEFAULT_PATH, [new Uint8Array(400).fill(1)]);
    expect(hex(apdus[0]!.data).startsWith(hex(encodePath(DEFAULT_PATH)))).toBe(true);
    for (const apdu of apdus) expect(apdu.data.length).toBeLessThanOrEqual(150);
    const carried = apdus.reduce((sum, apdu) => sum + apdu.data.length, 0);
    expect(carried).toBe(400 + encodePath(DEFAULT_PATH).length);
  });

  it('packs the chunks into one stream so the tail reaches the device before it prompts', () => {
    const chunks = [new Uint8Array(10).fill(1), new Uint8Array(10).fill(2)];
    const apdus = signApdus(DEFAULT_PATH, chunks);
    const path = encodePath(DEFAULT_PATH);
    expect(apdus).toHaveLength(1);
    expect(hex(apdus[0]!.data)).toBe(hex(path) + '01'.repeat(10) + '02'.repeat(10));
  });

  it('fills every frame before opening the next one', () => {
    const chunks = [new Uint8Array(200).fill(1), new Uint8Array(40).fill(2)];
    const apdus = signApdus(DEFAULT_PATH, chunks);
    const room = 150 - encodePath(DEFAULT_PATH).length;
    expect(apdus[0]!.data.length).toBe(150);
    expect(apdus[1]!.data.length).toBe(240 - room);
    expect(apdus.at(-1)!.data.at(-1)).toBe(2);
  });

  it('still sends a frame for an empty chunk', () => {
    const apdus = signApdus(DEFAULT_PATH, [new Uint8Array(0)]);
    expect(apdus).toHaveLength(1);
    expect(apdus[0]!.data.length).toBe(encodePath(DEFAULT_PATH).length);
  });
});
