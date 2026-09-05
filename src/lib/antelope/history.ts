import type { Blockchain, Settings } from '@/lib/storage/schemas';

const endpoints: Record<string, string> = {
  eos: 'https://eos.hyperion.eosrio.io',
  jungle4: 'https://jungle4.cryptolions.io',
  wax: 'https://wax.eosusa.io',
  telos: 'https://telos.eosusa.io',
  proton: 'https://proton.eosusa.io',
  libre: 'https://libre.eosusa.io',
};

export function historyEndpointFor(
  chain: Blockchain,
  settings?: Pick<Settings, 'historyEndpoints'>,
): string | null {
  const custom = settings?.historyEndpoints[chain.chainId];
  if (custom) return custom.replace(/\/$/, '');
  return endpoints[chain.id] ?? null;
}

export function defaultHistoryEndpoint(chain: Blockchain): string | null {
  return endpoints[chain.id] ?? null;
}
