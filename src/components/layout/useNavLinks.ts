import { computed, type Component } from 'vue';
import {
  Gauge,
  Home,
  Landmark,
  Network,
  SendHorizontal,
  Settings,
  Wallet,
  Wrench,
} from 'lucide-vue-next';
import { useAppStore } from '@/stores/app.store';

export interface NavLink {
  to: string;
  icon: Component;
  label: string;
  exact?: boolean;
  optional?: boolean;
}

export function useNavLinks() {
  const app = useAppStore();
  return computed<NavLink[]>(() => {
    const items: NavLink[] = [{ to: '/', icon: Home, label: 'nav_home', exact: true }];
    if (app.currentWallet) items.push({ to: '/send', icon: SendHorizontal, label: 'nav_send' });
    items.push({ to: '/wallets', icon: Wallet, label: 'nav_wallets' });
    if (app.currentChain?.stakedResources && app.currentWallet) {
      items.push({
        to: `/account/${app.currentWallet.account}`,
        icon: Gauge,
        label: 'nav_resources',
        optional: true,
      });
    }
    if (app.currentChain?.stakedResources && app.currentWallet) {
      items.push({
        to: '/governance',
        icon: Landmark,
        label: 'nav_governance',
        optional: true,
      });
    }
    items.push(
      { to: '/tools', icon: Wrench, label: 'nav_tools' },
      { to: '/chains', icon: Network, label: 'nav_chains', optional: true },
      { to: '/settings', icon: Settings, label: 'nav_settings' },
    );
    return items;
  });
}
