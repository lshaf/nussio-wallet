import { SigningRequest, type ZlibProvider } from '@wharfkit/signing-request';
import { Serializer, type ABI, type Transaction } from '@wharfkit/antelope';
import { deflateRaw, inflateRaw } from 'pako';

export const zlib: ZlibProvider = {
  deflateRaw: (data) => deflateRaw(data),
  inflateRaw: (data) => inflateRaw(data),
};

const SCHEMES = ['esr:', 'esr-anchor:', 'anchor:', 'eosio:'];

export function isSigningRequestUri(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return SCHEMES.some((scheme) => trimmed.startsWith(scheme));
}

export async function encodeTransactionRequest(
  transaction: Transaction,
  chainId: string,
  abis: Record<string, ABI>,
): Promise<string> {
  const request = await SigningRequest.create(
    {
      chainId,
      transaction: Serializer.objectify(transaction) as Parameters<
        typeof SigningRequest.create
      >[0]['transaction'],
    },
    {
      zlib,
      abiProvider: {
        getAbi: async (account) => {
          const abi = abis[String(account)];
          if (!abi) throw new Error(`missing abi for ${String(account)}`);
          return abi;
        },
      },
    },
  );
  return request.encode(true, false);
}
