import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { installLinkCapture } from '@/lib/page/link-capture';

export interface NussioProvider {
  readonly version: string;
  readonly isNussioWallet: true;
  login(chainId?: string): Promise<unknown>;
  transact(request: unknown): Promise<unknown>;
  sign(request: string): Promise<unknown>;
}

declare global {
  interface Window {
    nussio?: NussioProvider;
  }
}

function notImplemented(): Promise<never> {
  return Promise.reject(new Error('not_implemented'));
}

export default defineUnlistedScript(() => {
  installLinkCapture();

  if (window.nussio) return;
  const provider: NussioProvider = Object.freeze({
    version: '0.1.0',
    isNussioWallet: true,
    login: notImplemented,
    transact: notImplemented,
    sign: notImplemented,
  });
  Object.defineProperty(window, 'nussio', {
    value: provider,
    writable: false,
    configurable: false,
  });
});
