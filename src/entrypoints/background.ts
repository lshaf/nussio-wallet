import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { isSigningRequestUri } from '@/lib/antelope/esr';
import { onMessage } from '@/lib/messaging/protocol';
import { settingsItem } from '@/lib/storage/items';
import { registerServices } from '@/services';
import { ensureSeededChains } from '@/services/chain.service';
import { requestService } from '@/services/request.service';
import { ensureConnected, sessionService } from '@/services/session.service';
import { walletService } from '@/services/wallet.service';

const HEARTBEAT_ALARM = 'heartbeat';
const MIN_IDLE_SECONDS = 15;
const CONTEXT_MENU_ID = 'anchor-open-request';

async function applyIdleTimeout(): Promise<void> {
  const { idleTimeoutMinutes } = await settingsItem.getValue();
  if (idleTimeoutMinutes <= 0) return;
  browser.idle.setDetectionInterval(Math.max(MIN_IDLE_SECONDS, idleTimeoutMinutes * 60));
}

async function openIfAllowed(uri: string): Promise<{ id: string }> {
  const settings = await settingsItem.getValue();
  if (!settings.allowSigningRequests) return { id: '' };
  return requestService.open(uri);
}

function installContextMenu(): void {
  browser.contextMenus.removeAll(() => {
    browser.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Open with Nussio Wallet',
      contexts: ['link', 'selection'],
    });
  });
}

export default defineBackground(() => {
  registerServices();

  onMessage('request:open', ({ data }) => openIfAllowed(data));

  browser.runtime.onInstalled.addListener(() => {
    void ensureSeededChains();
    installContextMenu();
  });

  browser.runtime.onStartup.addListener(() => {
    void ensureSeededChains();
    void requestService.updateBadge();
  });

  void ensureConnected();
  let linkUrl: string | undefined;
  settingsItem.watch((settings, previous) => {
    linkUrl ??= previous?.anchorLinkServiceUrl;
    if (settings.anchorLinkServiceUrl !== linkUrl) {
      linkUrl = settings.anchorLinkServiceUrl;
      void sessionService.restart();
    }
  });

  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId !== CONTEXT_MENU_ID) return;
    const candidate = info.linkUrl ?? info.selectionText ?? '';
    if (isSigningRequestUri(candidate)) void openIfAllowed(candidate.trim());
  });

  browser.windows.onRemoved.addListener((windowId) => {
    void requestService.windowClosed(windowId);
  });

  void applyIdleTimeout();
  void requestService.updateBadge();
  settingsItem.watch(() => {
    void applyIdleTimeout();
  });

  browser.idle.onStateChanged.addListener((state) => {
    if (state === 'active') return;
    void settingsItem.getValue().then((settings) => {
      if (settings.idleTimeoutMinutes > 0) return walletService.lock();
    });
  });

  void browser.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== HEARTBEAT_ALARM) return;
    void ensureConnected();
  });
});
