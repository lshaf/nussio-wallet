import { computed } from 'vue';
import { useAppStore } from '@/stores/app.store';

export function useRefreshInterval() {
  const app = useAppStore();
  return computed<number | false>(() =>
    app.settings.refreshRateSeconds > 0 ? app.settings.refreshRateSeconds * 1000 : false,
  );
}
