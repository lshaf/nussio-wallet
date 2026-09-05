import { defineContentScript } from 'wxt/utils/define-content-script';
import { injectScript } from 'wxt/utils/inject-script';
import { sendMessage } from '@/lib/messaging/protocol';

const REQUEST_SCHEMES = ['esr:', 'esr-anchor:', 'anchor:'];

function requestUriFromEvent(event: MouseEvent): string | undefined {
  for (const node of event.composedPath()) {
    if (!(node instanceof Element)) continue;
    const anchor = node.closest('a[href]');
    if (!anchor) continue;
    const href = anchor.getAttribute('href') ?? '';
    return REQUEST_SCHEMES.some((scheme) => href.toLowerCase().startsWith(scheme))
      ? href
      : undefined;
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
        void sendMessage('request:open', uri);
      },
      true,
    );
  },
});
