import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { onMessage } from '@/lib/messaging/protocol';
import { settingsItem } from '@/lib/storage/items';
import { registerServices } from '@/services';
import { ensureSeededChains } from '@/services/chain.service';
import { requestService } from '@/services/request.service';
import { walletService } from '@/services/wallet.service';

const HEARTBEAT_ALARM = 'heartbeat';
const MIN_IDLE_SECONDS = 15;

async function applyIdleTimeout(): Promise<void> {
  const { idleTimeoutMinutes } = await settingsItem.getValue();
  if (idleTimeoutMinutes <= 0) return;
  browser.idle.setDetectionInterval(Math.max(MIN_IDLE_SECONDS, idleTimeoutMinutes * 60));
}

export default defineBackground(() => {
  registerServices();

  onMessage('request:open', ({ data }) => requestService.open(data));

  browser.runtime.onInstalled.addListener(() => {
    void ensureSeededChains();
  });

  browser.runtime.onStartup.addListener(() => {
    void ensureSeededChains();
  });

  void applyIdleTimeout();
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
  });
});
