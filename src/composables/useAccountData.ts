import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useAccountService } from '@/composables/useServices';
import { useRefreshInterval } from './useRefreshInterval';

type Maybe = MaybeRefOrGetter<string | null | undefined>;

export function useAccountData(chainId: Maybe, account: Maybe) {
  const accountService = useAccountService();
  const interval = useRefreshInterval();
  return useQuery(
    computed(() => {
      const chain = toValue(chainId);
      const name = toValue(account);
      return {
        queryKey: ['account', chain, name],
        queryFn: () => accountService.getAccountData(chain!, name!),
        enabled: Boolean(chain && name),
        refetchInterval: interval.value,
        staleTime: 10_000,
      };
    }),
  );
}

export function useBalances(chainId: Maybe, account: Maybe) {
  const accountService = useAccountService();
  const interval = useRefreshInterval();
  return useQuery(
    computed(() => {
      const chain = toValue(chainId);
      const name = toValue(account);
      return {
        queryKey: ['balances', chain, name],
        queryFn: () => accountService.getBalances(chain!, name!),
        enabled: Boolean(chain && name),
        refetchInterval: interval.value,
        staleTime: 10_000,
      };
    }),
  );
}
