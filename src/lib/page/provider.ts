export const PROVIDER_METHODS = ['login', 'transact', 'sign', 'disconnect', 'isConnected'] as const;

export type ProviderMethod = (typeof PROVIDER_METHODS)[number];

export const PROVIDER_CALL = 'provider-call';
export const PROVIDER_RESULT = 'provider-result';
export const MAX_PARAMS_BYTES = 32_768;

export interface ProviderCallMessage {
  source: string;
  type: typeof PROVIDER_CALL;
  id: number;
  method: string;
  params: unknown[];
}

export interface ProviderResultMessage {
  source: string;
  type: typeof PROVIDER_RESULT;
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export function isProviderMethod(value: unknown): value is ProviderMethod {
  return typeof value === 'string' && (PROVIDER_METHODS as readonly string[]).includes(value);
}

export function paramsWithinLimit(params: unknown[]): boolean {
  try {
    return JSON.stringify(params).length <= MAX_PARAMS_BYTES;
  } catch {
    return false;
  }
}
