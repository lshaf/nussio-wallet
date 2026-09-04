import { createProxyService, registerService } from '@webext-core/proxy-service';
import { browser } from 'wxt/browser';
import { pendingRequestsItem } from '@/lib/storage/items';
import type { PendingRequest } from '@/lib/storage/schemas';

export interface RequestService {
  open(uri: string): Promise<{ id: string }>;
  get(id: string): Promise<PendingRequest | undefined>;
  list(): Promise<PendingRequest[]>;
  cancel(id: string): Promise<void>;
}

const SERVICE_KEY = 'RequestService';
const PROMPT_WIDTH = 940;
const PROMPT_HEIGHT = 580;

async function openPromptWindow(id: string): Promise<void> {
  const url = browser.runtime.getURL(`/prompt.html?id=${encodeURIComponent(id)}`);
  const current = await browser.windows.getLastFocused().catch(() => undefined);
  const left =
    current?.left !== undefined && current.width !== undefined
      ? Math.round(current.left + (current.width - PROMPT_WIDTH) / 2)
      : undefined;
  const top =
    current?.top !== undefined && current.height !== undefined
      ? Math.round(current.top + (current.height - PROMPT_HEIGHT) / 2)
      : undefined;
  await browser.windows.create({
    url,
    type: 'popup',
    width: PROMPT_WIDTH,
    height: PROMPT_HEIGHT,
    focused: true,
    left,
    top,
  });
}

export const requestService: RequestService = {
  async open(uri) {
    const id = crypto.randomUUID();
    const request: PendingRequest = { id, uri, receivedAt: Date.now(), status: 'received' };
    const requests = await pendingRequestsItem.getValue();
    await pendingRequestsItem.setValue([...requests, request]);
    await openPromptWindow(id);
    return { id };
  },

  async get(id) {
    const requests = await pendingRequestsItem.getValue();
    return requests.find((request) => request.id === id);
  },

  list: () => pendingRequestsItem.getValue(),

  async cancel(id) {
    const requests = await pendingRequestsItem.getValue();
    await pendingRequestsItem.setValue(
      requests.map((request) =>
        request.id === id ? { ...request, status: 'cancelled' as const } : request,
      ),
    );
  },
};

export function registerRequestService(): void {
  registerService(SERVICE_KEY, requestService);
}

export function useRequestService(): RequestService {
  return createProxyService<RequestService>(SERVICE_KEY);
}
