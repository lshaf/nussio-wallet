import { describe, expect, it } from 'vitest';
import {
  MAX_PARAMS_BYTES,
  PROVIDER_METHODS,
  isProviderMethod,
  paramsWithinLimit,
} from './provider';

describe('provider protocol', () => {
  it('accepts only the published methods', () => {
    for (const method of PROVIDER_METHODS) expect(isProviderMethod(method)).toBe(true);
    for (const method of [
      'evil',
      '__proto__',
      'constructor',
      'prototype',
      'toString',
      'hasOwnProperty',
      '',
      'LOGIN',
      42,
      null,
      undefined,
      { method: 'login' },
    ]) {
      expect(isProviderMethod(method)).toBe(false);
    }
  });

  it('rejects params that are oversized or not serialisable', () => {
    expect(paramsWithinLimit([{ memo: 'x'.repeat(64) }])).toBe(true);
    expect(paramsWithinLimit([{ memo: 'x'.repeat(MAX_PARAMS_BYTES) }])).toBe(false);

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(paramsWithinLimit([circular])).toBe(false);
    expect(paramsWithinLimit([{ amount: 1n }])).toBe(false);
  });
});
