import type { Blockchain, Settings } from '@/lib/storage/schemas';

const unicove: Record<string, string> = {
  eos: 'eos',
  jungle4: 'jungle4',
  telos: 'telos',
  'telos-testnet': 'telostestnet',
  wax: 'wax',
  'wax-testnet': 'waxtestnet',
  proton: 'proton',
  libre: 'libre',
};

export function transactionUrl(
  chain: Blockchain,
  transactionId: string,
  settings?: Pick<Settings, 'blockExplorers'>,
): string | null {
  const custom = settings?.blockExplorers[chain.chainId];
  if (custom) return custom.replace('{id}', transactionId);
  const slug = unicove[chain.id];
  return slug ? `https://unicove.com/${slug}/transaction/${transactionId}` : null;
}
