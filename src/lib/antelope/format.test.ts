import { describe, expect, it } from 'vitest';
import {
  formatAsset,
  formatBytes,
  formatMicroseconds,
  parseAsset,
  percentage,
  sumAssets,
} from './format';

describe('format', () => {
  it('parses and formats assets', () => {
    expect(parseAsset('12.3450 EOS')).toEqual({ amount: 12.345, symbol: 'EOS', precision: 4 });
    expect(formatAsset(12.345, 'EOS', 4)).toBe('12.3450 EOS');
    expect(sumAssets(['1.0000 EOS', '2.5000 EOS'])).toEqual({
      amount: 3.5,
      symbol: 'EOS',
      precision: 4,
    });
    expect(sumAssets([])).toBeUndefined();
  });

  it('formats bytes and microseconds', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.00 KB');
    expect(formatBytes(3 * 1024 ** 2)).toBe('3.00 MB');
    expect(formatMicroseconds(1500)).toBe('1.50 ms');
    expect(formatMicroseconds(2_500_000)).toBe('2.50 s');
  });

  it('clamps percentages', () => {
    expect(percentage(50, 200)).toBe(25);
    expect(percentage(500, 200)).toBe(100);
    expect(percentage(1, 0)).toBe(0);
  });
});
