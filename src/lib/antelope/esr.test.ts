import { describe, expect, it } from 'vitest';
import { ABI } from '@wharfkit/antelope';
import { PlaceholderAuth, PlaceholderName, SigningRequest } from '@wharfkit/signing-request';
import {
  forbiddenActions,
  fuelPresentation,
  normalizeRequestUri,
  parseSigningRequest,
  requestUsesPlaceholders,
  requestedSigner,
  zlib,
} from './esr';

const chainId = '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d';

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
const abiProvider = { getAbi: async () => tokenAbi };

async function createRequest(from: string, authorization: { actor: string; permission: string }) {
  const request = await SigningRequest.create(
    {
      chainId,
      action: {
        account: 'eosio.token',
        name: 'transfer',
        authorization: [authorization],
        data: { from, to: 'bob', quantity: '1.0000 EOS', memo: '' },
      },
    },
    { zlib, abiProvider },
  );
  return request.encode();
}

describe('normalizeRequestUri', () => {
  it('maps aliases and bare payloads to esr:', () => {
    expect(normalizeRequestUri('esr-anchor:abc')).toBe('esr:abc');
    expect(normalizeRequestUri('anchor://abc')).toBe('esr:abc');
    expect(normalizeRequestUri('  abc ')).toBe('esr:abc');
    expect(normalizeRequestUri('esr://abc')).toBe('esr:abc');
  });
});

describe('placeholders', () => {
  it('detects placeholder signer', async () => {
    const uri = await createRequest(String(PlaceholderName), {
      actor: String(PlaceholderAuth.actor),
      permission: String(PlaceholderAuth.permission),
    });
    const request = parseSigningRequest(uri);
    const abis = await request.fetchAbis(abiProvider);
    expect(requestUsesPlaceholders(request, abis)).toBe(true);
    expect(requestedSigner(request)).toBeNull();
  });

  it('reports a fixed signer', async () => {
    const uri = await createRequest('alice', { actor: 'alice', permission: 'active' });
    const request = parseSigningRequest(uri);
    const abis = await request.fetchAbis(abiProvider);
    expect(requestUsesPlaceholders(request, abis)).toBe(false);
    expect(requestedSigner(request)).toEqual({ actor: 'alice', permission: 'active' });
  });

  it('parses esr-anchor aliases', async () => {
    const uri = await createRequest('alice', { actor: 'alice', permission: 'active' });
    const request = parseSigningRequest(uri.replace(/^esr:/, 'esr-anchor://'));
    expect(String(request.getChainId())).toBe(chainId);
  });
});

describe('forbiddenActions', () => {
  it('flags authority changes on the system contract', () => {
    const actions = [
      { account: 'eosio', name: 'updateauth', authorization: [], data: {}, hex: '' },
      { account: 'eosio.token', name: 'transfer', authorization: [], data: {}, hex: '' },
    ];
    expect(forbiddenActions(actions, 'eosio')).toEqual(['eosio::updateauth']);
  });
});

describe('fuelPresentation', () => {
  it('detects provider and fee actions', () => {
    const actions = [
      { account: 'greymassnoop', name: 'noop', authorization: [], data: {}, hex: '' },
      {
        account: 'eosio.token',
        name: 'transfer',
        authorization: [],
        data: { to: 'fuel.gm', quantity: '0.0100 EOS' },
        hex: '',
      },
    ];
    expect(fuelPresentation(actions)).toEqual({ provider: true, fee: '0.0100 EOS' });
    expect(fuelPresentation([])).toEqual({ provider: false, fee: null });
  });
});
