import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { onMessage } from '@/lib/messaging/protocol';
import { registerServices } from '@/services';
import { ensureSeededChains } from '@/services/chain.service';
import { requestService } from '@/services/request.service';

const HEARTBEAT_ALARM = 'heartbeat';

export default defineBackground(() => {
  registerServices();

  onMessage('request:open', ({ data }) => requestService.open(data));

  browser.runtime.onInstalled.addListener(() => {
    void ensureSeededChains();
  });

  browser.runtime.onStartup.addListener(() => {
    void ensureSeededChains();
  });

  void browser.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== HEARTBEAT_ALARM) return;
  });
});
