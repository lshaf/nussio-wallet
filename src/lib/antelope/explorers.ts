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

const bloks: Record<string, string> = {
  eos: 'https://bloks.io',
  jungle4: 'https://jungle4.bloks.io',
  telos: 'https://telos.bloks.io',
  'telos-testnet': 'https://telos-test.bloks.io',
  wax: 'https://wax.bloks.io',
  'wax-testnet': 'https://wax-test.bloks.io',
  proton: 'https://proton.bloks.io',
  libre: 'https://libre.bloks.io',
};

export interface ExplorerOption {
  id: string;
  label: string;
  template: string;
}

export const CUSTOM_EXPLORER = 'custom';

export function explorerOptions(chain: Blockchain): ExplorerOption[] {
  const options: ExplorerOption[] = [];
  const slug = unicove[chain.id];
  if (slug)
    options.push({
      id: 'unicove',
      label: 'Unicove',
      template: `https://unicove.com/${slug}/transaction/{id}`,
    });
  const bloksHost = bloks[chain.id];
  if (bloksHost)
    options.push({ id: 'bloks', label: 'bloks.io', template: `${bloksHost}/transaction/{id}` });
  return options;
}

export function defaultExplorer(chain: Blockchain): string | null {
  return explorerOptions(chain)[0]?.template ?? null;
}

export function transactionUrl(
  chain: Blockchain,
  transactionId: string,
  settings?: Pick<Settings, 'blockExplorers'>,
): string | null {
  const template = settings?.blockExplorers[chain.chainId] ?? defaultExplorer(chain);
  return template ? template.replace('{id}', transactionId) : null;
}
