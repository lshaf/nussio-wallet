import { describe, expect, it } from 'vitest';
import { createRateLimiter, originOf } from './rate-limit';

describe('rate limiter', () => {
  it('allows a burst then blocks until the window slides', () => {
    let clock = 0;
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now: () => clock });
    expect([limiter.allow('a'), limiter.allow('a'), limiter.allow('a')]).toEqual([
      true,
      true,
      true,
    ]);
    expect(limiter.allow('a')).toBe(false);

    clock = 500;
    expect(limiter.allow('a')).toBe(false);
    expect(limiter.allow('b')).toBe(true);

    clock = 1001;
    expect(limiter.allow('a')).toBe(true);
  });

  it('reads the origin from a sender url', () => {
    expect(originOf('https://dapp.example/path?x=1')).toBe('https://dapp.example');
    expect(originOf('not a url')).toBe('unknown');
    expect(originOf(undefined)).toBe('unknown');
  });
});
