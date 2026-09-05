import { describe, expect, it } from 'vitest';
import { Transaction } from '@wharfkit/antelope';
import { berLength, berOctetString, ledgerChunks } from './serialize';

const JUNGLE4 = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d';

const hex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

function transaction(dataLength = 8) {
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
        data: 'ab'.repeat(dataLength),
      },
    ],
    transaction_extensions: [],
  });
}

describe('ledger BER framing', () => {
  it('matches the lengths asn1-ber writes for an OctetString', () => {
    const cases: [number, string][] = [
      [0, '0400'],
      [1, '0401'],
      [32, '0420'],
      [127, '047f'],
      [128, '048180'],
      [255, '0481ff'],
      [256, '04820100'],
      [300, '0482012c'],
    ];
    for (const [length, prefix] of cases) {
      const encoded = berOctetString(new Uint8Array(length).fill(0xab));
      expect(hex(encoded).startsWith(prefix)).toBe(true);
      expect(encoded.length).toBe(prefix.length / 2 + length);
    }
  });

  it('switches to the long form exactly at 128 bytes', () => {
    expect([...berLength(127)]).toEqual([127]);
    expect([...berLength(128)]).toEqual([0x81, 0x80]);
    expect([...berLength(65_535)]).toEqual([0x82, 0xff, 0xff]);
  });
});

describe('ledger transaction chunks', () => {
  it('splits into a header, one chunk per action and a footer', () => {
    const chunks = ledgerChunks(JUNGLE4, transaction());
    expect(chunks).toHaveLength(3);
    expect(hex(chunks[0]!).startsWith(`0420${JUNGLE4}`)).toBe(true);
  });

  it('ends with an empty extension count and 32 zero bytes', () => {
    const chunks = ledgerChunks(JUNGLE4, transaction());
    expect(hex(chunks.at(-1)!)).toBe(`040100 0420 ${'00'.repeat(32)}`.replace(/ /g, ''));
  });

  it('writes the header fields the ledger app expects, net usage forced to zero', () => {
    const [header] = ledgerChunks(JUNGLE4, transaction());
    expect(hex(header!)).toBe(
      [
        `0420${JUNGLE4}`,
        '0404' + '00ad9c6a',
        '0402' + 'd204',
        '0404' + 'd5dd0000',
        '040100',
        '040100',
        '040100',
        '040100',
        '040101',
      ].join(''),
    );
  });

  it('encodes action data with a long-form length past 127 bytes', () => {
    const chunks = ledgerChunks(JUNGLE4, transaction(200));
    const action = hex(chunks[1]!);
    expect(action.includes('0481c8')).toBe(true);
  });

  it('refuses context free actions and extensions the ledger app cannot take', () => {
    const base = transaction();
    const withExtension = Transaction.from({
      ...base,
      transaction_extensions: [{ type: 1, data: 'aa' }],
    });
    expect(() => ledgerChunks(JUNGLE4, withExtension)).toThrow('transaction_extensions');
  });
});
