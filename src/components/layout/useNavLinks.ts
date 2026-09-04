import { computed, type Component } from 'vue';
import { Gauge, Home, Network, Settings, Wallet } from 'lucide-vue-next';
import { useAppStore } from '@/stores/app.store';

export interface NavLink {
  to: string;
  icon: Component;
  label: string;
  exact?: boolean;
}

export function useNavLinks() {
  const app = useAppStore();
  return computed<NavLink[]>(() => {
    const items: NavLink[] = [
      { to: '/', icon: Home, label: 'nav_home', exact: true },
      { to: '/wallets', icon: Wallet, label: 'nav_wallets' },
    ];
    if (app.currentChain?.stakedResources && app.currentWallet) {
      items.push({
        to: `/account/${app.currentWallet.account}`,
        icon: Gauge,
        label: 'nav_resources',
      });
    }
    items.push(
      { to: '/chains', icon: Network, label: 'nav_chains' },
      { to: '/settings', icon: Settings, label: 'nav_settings' },
    );
    return items;
  });
}
