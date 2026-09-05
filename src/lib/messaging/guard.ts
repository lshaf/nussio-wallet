import { browser } from 'wxt/browser';

export const PROXY_PREFIX = 'proxy-service.';

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_PATH_LENGTH = 2;

export interface MessageSender {
  id?: string;
  url?: string;
  origin?: string;
  tab?: unknown;
}

export interface GuardContext {
  extensionId: string;
  extensionOrigin: string;
  services: string[];
}

export function isExtensionSender(
  sender: MessageSender | undefined,
  context: GuardContext,
): boolean {
  if (!sender || sender.id !== context.extensionId) return false;
  const url = sender.url ?? '';
  return url.startsWith(context.extensionOrigin);
}

export function isServiceCallAllowed(
  message: unknown,
  sender: MessageSender | undefined,
  context: GuardContext,
): boolean {
  if (typeof message !== 'object' || message === null) return true;
  const type = (message as { type?: unknown }).type;
  if (typeof type !== 'string' || !type.startsWith(PROXY_PREFIX)) return true;
  if (!isExtensionSender(sender, context)) return false;
  if (!context.services.includes(type.slice(PROXY_PREFIX.length))) return false;

  const data = (message as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return false;
  const { path, args } = data as { path?: unknown; args?: unknown };
  if (path !== undefined && path !== null) {
    if (!Array.isArray(path) || path.length === 0 || path.length > MAX_PATH_LENGTH) return false;
    if (path.some((segment) => typeof segment !== 'string' || FORBIDDEN_SEGMENTS.has(segment)))
      return false;
  }
  return args === undefined || Array.isArray(args);
}

type Listener = (message: unknown, sender: MessageSender, sendResponse: unknown) => unknown;

export function installMessagingGuard(services: string[]): GuardContext {
  const context: GuardContext = {
    extensionId: browser.runtime.id,
    extensionOrigin: browser.runtime.getURL('/'),
    services,
  };
  const events = browser.runtime.onMessage as unknown as {
    addListener(listener: Listener): void;
    __nussioGuarded?: boolean;
  };
  if (events.__nussioGuarded) return context;
  const original = events.addListener.bind(events);
  events.addListener = (listener: Listener) => {
    original((message, sender, sendResponse) => {
      if (!isServiceCallAllowed(message, sender, context)) return undefined;
      return listener(message, sender, sendResponse);
    });
  };
  events.__nussioGuarded = true;
  return context;
}
