import { describe, expect, it } from 'vitest';
import { builtinChains } from './chains';
import { defaultExplorer, explorerOptions, transactionUrl } from './explorers';

const id = 'a'.repeat(64);

function chainFor(name: string) {
  const chain = builtinChains.find((entry) => entry.id === name);
  if (!chain) throw new Error(`missing chain ${name}`);
  return chain;
}

describe('block explorers', () => {
  it('defaults WAX to waxblock and keeps the other options', () => {
    const options = explorerOptions(chainFor('wax'));
    expect(options.map((option) => option.id)).toEqual(['waxblock', 'unicove', 'bloks']);
    expect(transactionUrl(chainFor('wax'), id)).toBe(`https://waxblock.io/transaction/${id}`);
    expect(defaultExplorer(chainFor('wax-testnet'))).toBe(
      'https://testnet.waxblock.io/transaction/{id}',
    );
  });

  it('leaves other chains on unicove and honours an override', () => {
    expect(explorerOptions(chainFor('eos')).map((option) => option.id)).toEqual([
      'unicove',
      'bloks',
    ]);
    const chain = chainFor('eos');
    expect(
      transactionUrl(chain, id, {
        blockExplorers: { [chain.chainId]: 'https://example.com/tx/{id}' },
      }),
    ).toBe(`https://example.com/tx/${id}`);
  });
});
