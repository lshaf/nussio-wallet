import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { isSigningRequestUri } from '@/lib/antelope/esr';
import { onMessage } from '@/lib/messaging/protocol';
import { createRateLimiter, originOf } from '@/lib/messaging/rate-limit';
import { settingsItem } from '@/lib/storage/items';
import { registerServices } from '@/services';
import { ensureSeededChains } from '@/services/chain.service';
import { handleProviderCall } from '@/services/provider.service';
import { requestService } from '@/services/request.service';
import { ensureConnected, sessionService } from '@/services/session.service';
import { walletService } from '@/services/wallet.service';

const HEARTBEAT_ALARM = 'heartbeat';
const OPEN_LIMIT = 5;
const OPEN_WINDOW_MS = 10_000;

const openLimiter = createRateLimiter({ limit: OPEN_LIMIT, windowMs: OPEN_WINDOW_MS });
const providerLimiter = createRateLimiter({ limit: OPEN_LIMIT, windowMs: OPEN_WINDOW_MS });
const MIN_IDLE_SECONDS = 15;
const CONTEXT_MENU_ID = 'anchor-open-request';

async function applyIdleTimeout(): Promise<void> {
  const { idleTimeoutMinutes } = await settingsItem.getValue();
  if (idleTimeoutMinutes <= 0) return;
  browser.idle.setDetectionInterval(Math.max(MIN_IDLE_SECONDS, idleTimeoutMinutes * 60));
}

async function openIfAllowed(
  uri: string,
  requester: string | null = null,
): Promise<{ id: string }> {
  const settings = await settingsItem.getValue();
  if (!settings.allowSigningRequests) return { id: '' };
  try {
    return await requestService.open(uri, requester);
  } catch {
    return { id: '' };
  }
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

function restrictSessionStorage(): void {
  const session = browser.storage.session as unknown as {
    setAccessLevel?: (options: { accessLevel: string }) => Promise<void>;
  };
  void session.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => undefined);
}

export default defineBackground(() => {
  restrictSessionStorage();
  registerServices();

  onMessage('request:open', ({ data, sender }) => {
    const requester = originOf(sender?.url);
    if (!openLimiter.allow(requester)) return { id: '' };
    return openIfAllowed(data, requester === 'unknown' ? null : requester);
  });

  onMessage('provider:call', ({ data, sender }) => {
    const origin = originOf(sender?.url);
    if (origin === 'unknown') throw new Error('unknown_origin');
    if (!providerLimiter.allow(origin)) throw new Error('rate_limited');
    return handleProviderCall(data.method, data.params, origin);
  });

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
