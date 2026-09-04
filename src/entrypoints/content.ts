import { defineContentScript } from 'wxt/utils/define-content-script';
import { injectScript } from 'wxt/utils/inject-script';
import { sendMessage } from '@/lib/messaging/protocol';

const REQUEST_SCHEMES = ['esr:', 'esr-anchor:', 'anchor:'];

function requestUriFromEvent(event: MouseEvent): string | undefined {
  const target = event.target as Element | null;
  const anchor = target?.closest?.('a[href]');
  if (!anchor) return undefined;
  const href = anchor.getAttribute('href') ?? '';
  return REQUEST_SCHEMES.some((scheme) => href.startsWith(scheme)) ? href : undefined;
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
