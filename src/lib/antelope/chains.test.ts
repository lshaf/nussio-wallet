import { describe, expect, it } from 'vitest';
import { builtinChains, findBuiltinChain } from './chains';

describe('builtin chains', () => {
  it('has unique ids and chain ids', () => {
    const ids = new Set(builtinChains.map((chain) => chain.id));
    const chainIds = new Set(builtinChains.map((chain) => chain.chainId));
    expect(ids.size).toBe(builtinChains.length);
    expect(chainIds.size).toBe(builtinChains.length);
  });

  it('finds EOS mainnet with defaults applied', () => {
    const eos = findBuiltinChain(
      'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
    );
    expect(eos?.symbol).toBe('EOS');
    expect(eos?.tokenPrecision).toBe(4);
    expect(eos?.features).toContain('greymassfuel');
  });
});
