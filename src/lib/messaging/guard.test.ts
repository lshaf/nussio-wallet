import { readdirSync, readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { SERVICE_KEYS } from '@/services';
import {
  installMessagingGuard,
  isExtensionSender,
  isServiceCallAllowed,
  type GuardContext,
} from './guard';

const context: GuardContext = {
  extensionId: 'nussio-id',
  extensionOrigin: 'chrome-extension://nussio-id/',
  services: ['WalletService'],
};

const page = { id: 'nussio-id', url: 'chrome-extension://nussio-id/app.html' };
const contentScript = {
  id: 'nussio-id',
  url: 'https://evil.example/index.html',
  tab: { id: 3 },
};

function call(path: string[] | null, args: unknown[] = []) {
  return { id: 1, timestamp: 1, type: 'proxy-service.WalletService', data: { path, args } };
}

describe('messaging guard', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('accepts extension pages and rejects everything else', () => {
    expect(isExtensionSender(page, context)).toBe(true);
    expect(isExtensionSender(contentScript, context)).toBe(false);
    expect(isExtensionSender({ id: 'other', url: page.url }, context)).toBe(false);
    expect(isExtensionSender(undefined, context)).toBe(false);
  });

  it('lets a normal service call through from an extension page', () => {
    expect(isServiceCallAllowed(call(['unlock']), page, context)).toBe(true);
    expect(isServiceCallAllowed(call(null), page, context)).toBe(true);
  });

  it('blocks service calls from a content script', () => {
    expect(isServiceCallAllowed(call(['unlock']), contentScript, context)).toBe(false);
  });

  it('blocks unknown services and prototype walking', () => {
    const other = { ...call(['unlock']), type: 'proxy-service.SecretService' };
    expect(isServiceCallAllowed(other, page, context)).toBe(false);
    expect(isServiceCallAllowed(call(['constructor', 'constructor']), page, context)).toBe(false);
    expect(isServiceCallAllowed(call(['__proto__']), page, context)).toBe(false);
    expect(isServiceCallAllowed(call(['a', 'b', 'c']), page, context)).toBe(false);
    expect(isServiceCallAllowed(call([]), page, context)).toBe(false);
    expect(isServiceCallAllowed({ ...call(['unlock']), data: 'nope' }, page, context)).toBe(false);
  });

  it('leaves other message types alone', () => {
    const message = { id: 1, timestamp: 1, type: 'request:open', data: 'esr:x' };
    expect(isServiceCallAllowed(message, contentScript, context)).toBe(true);
  });

  it('stops guarded listeners from seeing blocked calls', async () => {
    installMessagingGuard(['WalletService']);
    const listener = vi.fn();
    fakeBrowser.runtime.onMessage.addListener(listener);

    await fakeBrowser.runtime.onMessage.trigger(
      call(['unlock']),
      { id: fakeBrowser.runtime.id, url: 'https://evil.example/' },
      () => undefined,
    );
    expect(listener).not.toHaveBeenCalled();

    await fakeBrowser.runtime.onMessage.trigger(
      call(['unlock']),
      { id: fakeBrowser.runtime.id, url: fakeBrowser.runtime.getURL('/app.html') },
      () => undefined,
    );
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('guards every registered service key', () => {
    const found = readdirSync('src/services')
      .filter((file) => file.endsWith('.service.ts'))
      .flatMap((file) => {
        const source = readFileSync(`src/services/${file}`, 'utf8');
        const match = /const SERVICE_KEY = '([^']+)'/.exec(source);
        return match ? [match[1]!] : [];
      })
      .sort();
    expect([...SERVICE_KEYS].sort()).toEqual(found);
  });
});
