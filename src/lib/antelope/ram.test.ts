import { describe, expect, it } from 'vitest';
import {
  ramBytesForTokens,
  ramCostForBytes,
  ramPricePerByte,
  ramProceedsForBytes,
  type RamMarket,
} from './ram';

const market: RamMarket = {
  baseBytes: 58091094024,
  quoteUnits: 118296123357,
  symbol: 'EOS',
  precision: 4,
};

describe('ram market math', () => {
  it('prices a kilobyte close to the chain quote', () => {
    expect(ramPricePerByte(market)).toBeCloseTo(0.0002036, 7);
    expect(ramCostForBytes(market, 1000)).toBeCloseTo(0.2047, 4);
  });

  it('round trips bytes and tokens within the spread', () => {
    const bytes = ramBytesForTokens(market, 1);
    expect(bytes).toBeGreaterThan(4800);
    expect(bytes).toBeLessThan(4920);
    expect(ramCostForBytes(market, bytes)).toBeGreaterThan(0.99);
    expect(ramCostForBytes(market, bytes)).toBeLessThan(1.02);
  });

  it('sells for less than it buys', () => {
    expect(ramProceedsForBytes(market, 10000)).toBeLessThan(ramCostForBytes(market, 10000));
    expect(ramProceedsForBytes(market, 10000)).toBeCloseTo(2.0257, 3);
  });

  it('refuses impossible amounts', () => {
    expect(ramCostForBytes(market, 0)).toBe(0);
    expect(ramCostForBytes(market, market.baseBytes)).toBe(0);
    expect(ramBytesForTokens(market, -1)).toBe(0);
    expect(ramProceedsForBytes(market, 0)).toBe(0);
  });
});
