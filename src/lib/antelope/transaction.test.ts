import { describe, expect, it } from 'vitest';
import { ABI, API, APIError, PrivateKey } from '@wharfkit/antelope';
import {
  buildTransaction,
  decodeActions,
  normalizeChainError,
  parseTransactionInput,
  signTransaction,
  unsignedExport,
  type ChainReader,
} from './transaction';

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

const chainId = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d';

const reader: ChainReader = {
  async getInfo() {
    return API.v1.GetInfoResponse.from({
      server_version: '0',
      chain_id: chainId,
      head_block_num: 1000,
      last_irreversible_block_num: 900,
      last_irreversible_block_id:
        '0000038400000000000000000000000000000000000000000000000000000000',
      head_block_id: '000003e800000000000000000000000000000000000000000000000000000000',
      head_block_time: '2030-01-01T00:00:00.000',
      head_block_producer: 'eosio',
      virtual_block_cpu_limit: 0,
      virtual_block_net_limit: 0,
      block_cpu_limit: 0,
      block_net_limit: 0,
    });
  },
  async getAbi() {
    return tokenAbi;
  },
};

const transfer = {
  account: 'eosio.token',
  name: 'transfer',
  authorization: [{ actor: 'alice', permission: 'active' }],
  data: { from: 'alice', to: 'bob', quantity: '1.0000 EOS', memo: 'hi' },
};

describe('buildTransaction', () => {
  it('encodes actions and sets tapos from the last irreversible block', async () => {
    const { transaction, abis } = await buildTransaction(reader, [transfer], 120);
    expect(Number(transaction.ref_block_num)).toBe(900);
    expect(transaction.actions).toHaveLength(1);
    const [decoded] = decodeActions(transaction, abis);
    expect(decoded?.data).toMatchObject({ from: 'alice', to: 'bob', quantity: '1.0000 EOS' });
  });

  it('signs with a private key and keeps cosignatures first', async () => {
    const { transaction } = await buildTransaction(reader, [transfer], 120);
    const key = PrivateKey.generate('K1');
    const cosigner = PrivateKey.generate('K1');
    const cosig = String(cosigner.signDigest(transaction.signingDigest(chainId)));
    const signed = signTransaction(transaction, String(key), chainId, [cosig]);
    expect(signed.signatures).toHaveLength(2);
    expect(String(signed.signatures[0])).toBe(cosig);
  });

  it('exports an unsigned desktop-compatible payload', async () => {
    const { transaction, abis } = await buildTransaction(reader, [transfer], 3600);
    const payload = unsignedExport(transaction, abis) as {
      contracts: { contract: string }[];
      transaction: { transaction: { compression: string; signatures: string[] } };
    };
    expect(payload.contracts[0]?.contract).toBe('eosio.token');
    expect(payload.transaction.transaction.compression).toBe('none');
    expect(payload.transaction.transaction.signatures).toEqual([]);
    const parsed = parseTransactionInput(JSON.stringify(payload));
    expect(parsed.signatures).toEqual([]);
    expect(parsed.transaction.actions).toHaveLength(1);
  });
});

describe('parseTransactionInput', () => {
  it('reads a signed {signatures, transaction} object', async () => {
    const { transaction } = await buildTransaction(reader, [transfer], 120);
    const text = JSON.stringify({
      signatures: ['SIG_K1_x'],
      transaction: JSON.parse(JSON.stringify(transaction)),
    });
    const parsed = parseTransactionInput(text);
    expect(parsed.signatures).toEqual(['SIG_K1_x']);
  });

  it('rejects garbage', () => {
    expect(() => parseTransactionInput('nope')).toThrow('invalid_json');
    expect(() => parseTransactionInput('{"a":1}')).toThrow('invalid_transaction');
  });
});

describe('normalizeChainError', () => {
  function apiError(name: string, message: string): APIError {
    return new APIError('/v1/chain/send_transaction', {
      status: 500,
      headers: {},
      text: '',
      json: {
        code: 500,
        message: 'Internal Service Error',
        error: {
          code: 3080004,
          name,
          what: message,
          details: [{ message, file: '', line_number: 0, method: '' }],
        },
      },
    });
  }

  it('maps cpu errors', () => {
    expect(normalizeChainError(apiError('tx_cpu_usage_exceeded', 'cpu')).kind).toBe('cpu');
  });

  it('maps authorization errors', () => {
    expect(normalizeChainError(apiError('unsatisfied_authorization', 'x')).kind).toBe(
      'authorization',
    );
  });

  it('extracts assertion messages', () => {
    const error = normalizeChainError(
      apiError(
        'eosio_assert_message_exception',
        'assertion failure with message: overdrawn balance',
      ),
    );
    expect(error.kind).toBe('assert');
    expect(error.message).toBe('overdrawn balance');
  });

  it('maps internal markers', () => {
    expect(normalizeChainError(new Error('locked')).kind).toBe('locked');
    expect(normalizeChainError(new Error('Failed to fetch')).kind).toBe('network');
  });
});
