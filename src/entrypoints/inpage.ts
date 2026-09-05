import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { MESSAGE_SOURCE, installLinkCapture } from '@/lib/page/link-capture';
import {
  PROVIDER_CALL,
  PROVIDER_RESULT,
  type ProviderMethod,
  type ProviderResultMessage,
} from '@/lib/page/provider';

export interface LoginResult {
  chainId: string;
  actor: string;
  permission: string;
}

export interface TransactResult {
  chainId: string;
  transactionId?: string;
  blockNum?: number;
  signatures: string[];
}

export interface TransactArgs {
  action?: unknown;
  actions?: unknown[];
  transaction?: unknown;
  broadcast?: boolean;
  chainId?: string;
}

export interface NussioProvider {
  readonly version: string;
  readonly isNussioWallet: true;
  login(chainId?: string): Promise<LoginResult>;
  transact(args: TransactArgs | string): Promise<TransactResult>;
  sign(request: string): Promise<TransactResult>;
  disconnect(): Promise<boolean>;
  isConnected(): Promise<boolean>;
}

declare global {
  interface Window {
    nussio?: NussioProvider;
  }
}

const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
let nextId = 0;

function onResult(event: MessageEvent): void {
  if (event.source !== window) return;
  const data = event.data as Partial<ProviderResultMessage> | null;
  if (!data || data.source !== MESSAGE_SOURCE || data.type !== PROVIDER_RESULT) return;
  if (typeof data.id !== 'number') return;
  const entry = pending.get(data.id);
  if (!entry) return;
  pending.delete(data.id);
  if (data.ok) entry.resolve(data.result);
  else entry.reject(new Error(typeof data.error === 'string' ? data.error : 'provider_error'));
}

function call<T>(method: ProviderMethod, params: unknown[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    window.postMessage({ source: MESSAGE_SOURCE, type: PROVIDER_CALL, id, method, params }, '*');
  });
}

export default defineUnlistedScript(() => {
  installLinkCapture();

  if (window.nussio) return;
  window.addEventListener('message', onResult);

  const provider: NussioProvider = Object.freeze({
    version: '0.1.0',
    isNussioWallet: true,
    login: (chainId?: string) => call<LoginResult>('login', chainId === undefined ? [] : [chainId]),
    transact: (args: TransactArgs | string) => call<TransactResult>('transact', [args]),
    sign: (request: string) => call<TransactResult>('sign', [request]),
    disconnect: () => call<boolean>('disconnect', []),
    isConnected: () => call<boolean>('isConnected', []),
  });
  Object.defineProperty(window, 'nussio', {
    value: provider,
    writable: false,
    configurable: false,
  });
});
