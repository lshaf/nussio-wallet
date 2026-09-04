import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';

export interface AnchorProvider {
  readonly version: string;
  readonly isAnchorExtension: true;
  login(chainId?: string): Promise<unknown>;
  transact(request: unknown): Promise<unknown>;
  sign(request: string): Promise<unknown>;
}

declare global {
  interface Window {
    anchor?: AnchorProvider;
  }
}

function notImplemented(): Promise<never> {
  return Promise.reject(new Error('not_implemented'));
}

export default defineUnlistedScript(() => {
  if (window.anchor) return;
  const provider: AnchorProvider = Object.freeze({
    version: '0.1.0',
    isAnchorExtension: true,
    login: notImplemented,
    transact: notImplemented,
    sign: notImplemented,
  });
  Object.defineProperty(window, 'anchor', {
    value: provider,
    writable: false,
    configurable: false,
  });
  window.dispatchEvent(new Event('anchor#initialized'));
});
