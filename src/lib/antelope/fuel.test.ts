import { describe, expect, it } from 'vitest';
import { ABI, Action, Serializer, Transaction } from '@wharfkit/antelope';
import { blockchainSchema } from '@/lib/storage/schemas';
import {
  FuelValidationError,
  expectedFuelActions,
  fuelEndpointFor,
  requestFuel,
  validateFuelTransaction,
} from './fuel';

const tokenAbi = ABI.from({
  version: 'eosio::abi/1.1',
  types: [],
  variants: [],
  tables: [],
  ricardian_clauses: [],
  structs: [
    {
      name: 'transfer',
      base: '',
      fields: [
        { name: 'from', type: 'name' },
        { name: 'to', type: 'name' },
        { name: 'quantity', type: 'asset' },
        { name: 'memo', type: 'string' },
      ],
    },
  ],
  actions: [{ name: 'transfer', type: 'transfer', ricardian_contract: '' }],
});

const signer = { actor: 'alice', permission: 'active' };

function transfer(from: string, to: string, quantity: string, memo = ''): Action {
  return Action.from(
    {
      account: 'eosio.token',
      name: 'transfer',
      authorization: [{ actor: from, permission: 'active' }],
      data: { from, to, quantity, memo },
    },
    tokenAbi,
  );
}

const noop = Action.from({
  account: 'greymassnoop',
  name: 'noop',
  authorization: [{ actor: 'greymassfuel', permission: 'cosign' }],
  data: '',
});

function tx(actions: Action[]): Transaction {
  return Transaction.from({
    expiration: '2030-01-01T00:00:00',
    ref_block_num: 1,
    ref_block_prefix: 2,
    actions,
  });
}

describe('validateFuelTransaction', () => {
  const original = tx([transfer('alice', 'bob', '1.0000 EOS', 'hi')]);

  it('accepts noop prepended free transaction', () => {
    const modified = tx([noop, ...original.actions]);
    expect(() => validateFuelTransaction(original, modified, signer)).not.toThrow();
  });

  it('rejects when noop is missing', () => {
    const modified = tx([transfer('alice', 'bob', '1.0000 EOS', 'hi')]);
    expect(() => validateFuelTransaction(original, modified, signer)).toThrow(FuelValidationError);
  });

  it('rejects modified action data', () => {
    const modified = tx([noop, transfer('alice', 'bob', '2.0000 EOS', 'hi')]);
    expect(() => validateFuelTransaction(original, modified, signer)).toThrow(/action_mismatch/);
  });

  it('rejects extra appended actions', () => {
    const modified = tx([noop, ...original.actions, transfer('alice', 'eve', '9.0000 EOS')]);
    expect(() => validateFuelTransaction(original, modified, signer)).toThrow(/action_count/);
  });

  it('accepts a fee transfer to fuel.gm paid by the signer', () => {
    const fee = transfer('alice', 'fuel.gm', '0.0100 EOS', 'fee');
    const modified = tx([noop, fee, ...original.actions]);
    expect(() => validateFuelTransaction(original, modified, signer, true)).not.toThrow();
    expect(expectedFuelActions(modified, true)).toBe(2);
  });

  it('rejects a fee sent elsewhere', () => {
    const fee = transfer('alice', 'eve', '0.0100 EOS', 'fee');
    const modified = tx([noop, fee, ...original.actions]);
    expect(() => validateFuelTransaction(original, modified, signer, true)).toThrow(/fee_receiver/);
  });
});

describe('fuelEndpointFor', () => {
  it('returns null without the feature', () => {
    const chain = blockchainSchema.parse({
      id: 'x',
      chainId: 'a'.repeat(64),
      name: 'X',
      node: 'https://x.greymass.com',
      symbol: 'X',
    });
    expect(fuelEndpointFor(chain)).toBeNull();
  });

  it('uses a greymass node when the chain is unknown', () => {
    const chain = blockchainSchema.parse({
      id: 'x',
      chainId: 'b'.repeat(64),
      name: 'X',
      node: 'https://custom.greymass.com/',
      symbol: 'X',
      features: ['greymassfuel'],
    });
    expect(fuelEndpointFor(chain)).toBe('https://custom.greymass.com');
  });
});

describe('requestFuel', () => {
  const original = tx([transfer('alice', 'bob', '1.0000 EOS')]);

  it('parses a free cosigned response', async () => {
    const fetchFn = (async () =>
      new Response(
        JSON.stringify({
          code: 200,
          data: {
            request: ['transaction', Serializer.objectify(tx([noop, ...original.actions]))],
            signatures: ['SIG_K1_test'],
          },
        }),
      )) as typeof fetch;
    const quote = await requestFuel('https://fuel.test', 'esr:abc', signer, fetchFn);
    expect(quote.kind).toBe('free');
    if (quote.kind === 'free') expect(quote.signatures).toEqual(['SIG_K1_test']);
  });

  it('parses a fee response', async () => {
    const fetchFn = (async () =>
      new Response(
        JSON.stringify({
          code: 402,
          data: {
            request: ['transaction', Serializer.objectify(tx([noop, ...original.actions]))],
            signatures: [],
            fee: '0.0100 EOS',
            costs: { cpu: '0.0100 EOS' },
          },
        }),
        { status: 402 },
      )) as typeof fetch;
    const quote = await requestFuel('https://fuel.test', 'esr:abc', signer, fetchFn);
    expect(quote.kind).toBe('fee');
    if (quote.kind === 'fee') expect(quote.fee).toBe('0.0100 EOS');
  });

  it('reports unavailable on network failure', async () => {
    const fetchFn = (async () => {
      throw new Error('Failed to fetch');
    }) as typeof fetch;
    const quote = await requestFuel('https://fuel.test', 'esr:abc', signer, fetchFn);
    expect(quote.kind).toBe('unavailable');
  });
});
