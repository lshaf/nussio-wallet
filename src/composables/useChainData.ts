import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useChainService, useResourcesService } from '@/composables/useServices';

type Maybe = MaybeRefOrGetter<string | null | undefined>;

export function useChainInfo(chainId: Maybe) {
  const chainService = useChainService();
  return useQuery(
    computed(() => {
      const chain = toValue(chainId);
      return {
        queryKey: ['chain-info', chain],
        queryFn: () => chainService.getInfo(chain!),
        enabled: Boolean(chain),
        refetchInterval: 30_000,
        retry: 1,
      };
    }),
  );
}

export function useRamPrice(chainId: Maybe) {
  const chainService = useChainService();
  return useQuery(
    computed(() => {
      const chain = toValue(chainId);
      return {
        queryKey: ['ram-price', chain],
        queryFn: () => chainService.getRamPrice(chain!),
        enabled: Boolean(chain),
        refetchInterval: 60_000,
      };
    }),
  );
}

export function useResourceState(chainId: Maybe, sample?: Maybe) {
  const resourcesService = useResourcesService();
  return useQuery(
    computed(() => {
      const chain = toValue(chainId);
      const account = toValue(sample) ?? undefined;
      return {
        queryKey: ['resource-state', chain, account],
        queryFn: () => resourcesService.getState(chain!, account),
        enabled: Boolean(chain),
        refetchInterval: 60_000,
        retry: 1,
      };
    }),
  );
}

export function usePriceFeed(chainId: Maybe) {
  const chainService = useChainService();
  return useQuery(
    computed(() => {
      const chain = toValue(chainId);
      return {
        queryKey: ['price-feed', chain],
        queryFn: () => chainService.getPriceFeed(chain!),
        enabled: Boolean(chain),
        refetchInterval: 120_000,
      };
    }),
  );
}
