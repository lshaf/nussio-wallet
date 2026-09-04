import { defineExtensionMessaging } from '@webext-core/messaging';

export interface ProviderCall {
  origin: string;
  method: string;
  params: unknown[];
}

export interface ProtocolMap {
  'request:open': (uri: string) => { id: string };
  'provider:call': (call: ProviderCall) => unknown;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
