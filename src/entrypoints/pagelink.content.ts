import { defineContentScript } from 'wxt/utils/define-content-script';
import { installLinkCapture } from '@/lib/page/link-capture';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    installLinkCapture();
  },
});
