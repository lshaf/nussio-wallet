import { APIClient, FetchProvider } from '@wharfkit/antelope';

const clients = new Map<string, APIClient>();

const fetchFn: typeof fetch = (input, init) => globalThis.fetch(input, init);

export function clientFor(node: string): APIClient {
  let client = clients.get(node);
  if (!client) {
    client = new APIClient({ provider: new FetchProvider(node, { fetch: fetchFn }) });
    clients.set(node, client);
  }
  return client;
}
