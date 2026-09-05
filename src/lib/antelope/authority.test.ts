import { describe, expect, it } from 'vitest';
import { buildAuthority, checkAuthority } from './authority';

const keyA = 'PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63';
const keyB = 'EOS6bpUsTAT7gLuPNV9mVhYgHVdRZfQ1A6ZeFmgwvGEtZLfMum8r1';

describe('authority', () => {
  it('sorts keys and accounts the way updateauth expects', () => {
    const built = buildAuthority({
      threshold: 2,
      keys: [
        { key: keyB, weight: 1 },
        { key: keyA, weight: 1 },
      ],
      accounts: [
        { actor: 'zzzzzzzzzzzz', permission: 'active', weight: 1 },
        { actor: 'aaaaaaaaaaaa', permission: 'active', weight: 1 },
      ],
    }) as {
      threshold: number;
      keys: { key: string }[];
      accounts: { permission: { actor: string } }[];
    };
    expect(built.threshold).toBe(2);
    expect(built.keys).toHaveLength(2);
    expect(built.accounts[0]!.permission.actor).toBe('aaaaaaaaaaaa');
    expect(built.keys[0]!.key).not.toBe(built.keys[1]!.key);
  });

  it('rejects authorities nobody can satisfy', () => {
    expect(
      checkAuthority({ threshold: 0, keys: [{ key: keyA, weight: 1 }], accounts: [] }),
    ).toEqual({ code: 'threshold' });
    expect(checkAuthority({ threshold: 1, keys: [], accounts: [] })).toEqual({ code: 'empty' });
    expect(
      checkAuthority({ threshold: 3, keys: [{ key: keyA, weight: 1 }], accounts: [] }),
    ).toEqual({ code: 'unreachable' });
    expect(
      checkAuthority({ threshold: 1, keys: [{ key: 'nope', weight: 1 }], accounts: [] }),
    ).toMatchObject({ code: 'key' });
    expect(
      checkAuthority({
        threshold: 1,
        keys: [
          { key: keyA, weight: 1 },
          { key: keyA, weight: 1 },
        ],
        accounts: [],
      }),
    ).toMatchObject({ code: 'duplicate' });
  });

  it('accepts a workable authority', () => {
    expect(
      checkAuthority({
        threshold: 2,
        keys: [{ key: keyA, weight: 1 }],
        accounts: [{ actor: 'teamgreymass', permission: 'active', weight: 1 }],
      }),
    ).toBeNull();
  });
});
