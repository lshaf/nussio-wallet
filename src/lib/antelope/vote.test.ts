import { describe, expect, it } from 'vitest';
import { voteEffectiveness, voteWeightMultiplier, voteWeightValue } from './vote';

describe('vote weight', () => {
  const now = 946_684_800 + 52 * 7 * 24 * 3600;

  it('doubles after one period', () => {
    expect(voteWeightMultiplier(52, now)).toBeCloseTo(2, 6);
  });

  it('computes effectiveness against a fresh vote', () => {
    const staked = 10_000;
    const fresh = staked * voteWeightMultiplier(52, now);
    expect(voteEffectiveness(fresh, 0, staked, 52, now)).toBeCloseTo(100, 6);
    expect(voteEffectiveness(fresh / 2, 0, staked, 52, now)).toBeCloseTo(50, 6);
    expect(voteEffectiveness(0, 0, staked, 52, now)).toBeUndefined();
  });

  it('converts weight back to tokens', () => {
    const staked = 12_345;
    const weight = staked * voteWeightMultiplier(52, now);
    expect(voteWeightValue(weight, 52, 4, now)).toBeCloseTo(1.2345, 6);
  });
});
