const EOS_MAINNET = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';

const exchanges: Record<string, string[]> = {
  [EOS_MAINNET]: [
    'binancecleos',
    'huobideposit',
    'okbtothemoon',
    'krakenkraken',
    'bithumbrecv1',
    'bitfinexdep1',
    'gateiowallet',
    'coinbasebase',
    'kucoindoteos',
    'poloniexeos1',
    'bittrexacct1',
    'upbituser',
    'mxcexdeposit',
    'bybitdeposit',
  ],
};

export function exchangeAccountsFor(chainId: string): string[] {
  return exchanges[chainId] ?? [];
}
