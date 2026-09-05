import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';

export interface WaxosProvider {
  readonly version: string;
  readonly isWaxosWallet: true;
  login(chainId?: string): Promise<unknown>;
  transact(request: unknown): Promise<unknown>;
  sign(request: string): Promise<unknown>;
}

declare global {
  interface Window {
    waxos?: WaxosProvider;
  }
}

function notImplemented(): Promise<never> {
  return Promise.reject(new Error('not_implemented'));
}

export default defineUnlistedScript(() => {
  if (window.waxos) return;
  const provider: WaxosProvider = Object.freeze({
    version: '0.1.0',
    isWaxosWallet: true,
    login: notImplemented,
    transact: notImplemented,
    sign: notImplemented,
  });
  Object.defineProperty(window, 'waxos', {
    value: provider,
    writable: false,
    configurable: false,
  });
  window.dispatchEvent(new Event('anchor#initialized'));
});
