import { defineContentScript } from 'wxt/utils/define-content-script';
import { injectScript } from 'wxt/utils/inject-script';
import { sendMessage } from '@/lib/messaging/protocol';

import { MESSAGE_SOURCE, isRequestUri } from '@/lib/page/link-capture';

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
      const data = event.data as { source?: string; type?: string; uri?: string } | null;
      if (!data || data.source !== MESSAGE_SOURCE || data.type !== 'request') return;
      if (typeof data.uri !== 'string' || !isRequestUri(data.uri)) return;
      open(data.uri);
    });
  },
});
