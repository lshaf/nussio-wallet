import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useAccountData, useBalances } from '@/composables/useAccountData';
import { formatAsset, parseAsset } from '@/lib/antelope/format';
import { voteEffectiveness, voteWeightValue } from '@/lib/antelope/vote';
import type { Blockchain } from '@/lib/storage/schemas';

function amount(quantity: string | undefined | null): number {
  return quantity ? parseAsset(quantity).amount : 0;
}

export function useAccountOverview(
  chain: MaybeRefOrGetter<Blockchain | undefined>,
  account: MaybeRefOrGetter<string | undefined>,
) {
  const query = useAccountData(
    () => toValue(chain)?.chainId,
    () => toValue(account),
  );
  const balances = useBalances(
    () => toValue(chain)?.chainId,
    () => toValue(account),
  );
  const data = computed(() => query.data.value);

  const liquid = computed(() => amount(data.value?.balance));
  const staked = computed(() =>
    data.value?.selfDelegated
      ? amount(data.value.selfDelegated.cpu) + amount(data.value.selfDelegated.net)
      : 0,
  );
  const delegated = computed(() =>
    data.value?.delegatedToOthers
      ? amount(data.value.delegatedToOthers.cpu) + amount(data.value.delegatedToOthers.net)
      : 0,
  );
  const refunding = computed(() =>
    data.value?.refund ? amount(data.value.refund.cpu) + amount(data.value.refund.net) : 0,
  );
  const rex = computed(() => amount(data.value?.rex?.voteStake) + amount(data.value?.rex?.fund));
  const total = computed(
    () => liquid.value + staked.value + delegated.value + refunding.value + rex.value,
  );

  const effectiveness = computed(() => {
    const voter = data.value?.voter;
    const current = toValue(chain);
    if (!voter || !current) return undefined;
    return voteEffectiveness(
      voter.lastVoteWeight,
      voter.proxiedVoteWeight,
      voter.staked,
      current.voteDecayPeriodWeeks,
    );
  });
  const voteValue = computed(() => {
    const voter = data.value?.voter;
    const current = toValue(chain);
    if (!voter || !current || voter.lastVoteWeight <= 0) return 0;
    return voteWeightValue(
      voter.lastVoteWeight,
      current.voteDecayPeriodWeeks,
      current.tokenPrecision,
    );
  });

  const nonZeroBalances = computed(() =>
    (balances.data.value ?? []).filter((balance) => parseAsset(balance.amount).amount > 0),
  );

  function money(value: number): string {
    const current = toValue(chain);
    return current ? formatAsset(value, current.symbol, current.tokenPrecision) : '';
  }

  return {
    query,
    balances,
    data,
    liquid,
    staked,
    delegated,
    refunding,
    rex,
    total,
    effectiveness,
    voteValue,
    nonZeroBalances,
    money,
  };
}
