import { defineContentScript } from 'wxt/utils/define-content-script';
import { injectScript } from 'wxt/utils/inject-script';
import { sendMessage } from '@/lib/messaging/protocol';

import { MESSAGE_SOURCE, isRequestUri } from '@/lib/page/link-capture';
import {
  PROVIDER_CALL,
  PROVIDER_RESULT,
  isProviderMethod,
  paramsWithinLimit,
  type ProviderCallMessage,
} from '@/lib/page/provider';

const DEDUPE_MS = 1500;

let lastUri = '';
let lastAt = 0;

function open(uri: string): void {
  const now = Date.now();
  if (uri === lastUri && now - lastAt < DEDUPE_MS) return;
  lastUri = uri;
  lastAt = now;
  void sendMessage('request:open', uri);
}

function reply(id: number, payload: { ok: boolean; result?: unknown; error?: string }): void {
  window.postMessage({ source: MESSAGE_SOURCE, type: PROVIDER_RESULT, id, ...payload }, '*');
}

async function bridgeProviderCall(message: Partial<ProviderCallMessage>): Promise<void> {
  const { id, method } = message;
  if (typeof id !== 'number') return;
  if (!isProviderMethod(method)) {
    reply(id, { ok: false, error: 'unknown_method' });
    return;
  }
  const params = Array.isArray(message.params) ? message.params : [];
  if (!paramsWithinLimit(params)) {
    reply(id, { ok: false, error: 'params_too_large' });
    return;
  }
  try {
    const result = await sendMessage('provider:call', { method, params });
    reply(id, { ok: true, result });
  } catch (error) {
    reply(id, { ok: false, error: error instanceof Error ? error.message : 'provider_error' });
  }
}

function requestUriFromEvent(event: MouseEvent): string | undefined {
  for (const node of event.composedPath()) {
    if (!(node instanceof Element)) continue;
    const anchor = node.closest('a[href]');
    if (!anchor) continue;
    const href = anchor.getAttribute('href') ?? '';
    return isRequestUri(href) ? href : undefined;
  }
  return undefined;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  async main() {
    await injectScript('/inpage.js', { keepInDom: true });

    document.addEventListener(
      'click',
      (event) => {
        const uri = requestUriFromEvent(event);
        if (!uri) return;
        event.preventDefault();
        event.stopPropagation();
        open(uri);
      },
      true,
    );

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data as Partial<ProviderCallMessage> & { uri?: string };
      if (!data || data.source !== MESSAGE_SOURCE) return;
      if (data.type === PROVIDER_CALL) {
        void bridgeProviderCall(data);
        return;
      }
      if (data.type !== 'request') return;
      if (typeof data.uri !== 'string' || !isRequestUri(data.uri)) return;
      open(data.uri);
    });
  },
});
