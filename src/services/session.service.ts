import { createProxyService, registerService } from '@webext-core/proxy-service';
import { sessionsItem } from '@/lib/storage/items';
import type { Session } from '@/lib/storage/schemas';

export interface SessionService {
  list(): Promise<Session[]>;
  linkInfo(): Promise<{ linkId: string | null; linkUrl: string }>;
}

const SERVICE_KEY = 'SessionService';

export const sessionService: SessionService = {
  async list() {
    return (await sessionsItem.getValue()).sessions;
  },
  async linkInfo() {
    const state = await sessionsItem.getValue();
    return { linkId: state.linkId, linkUrl: state.linkUrl };
  },
};

export function registerSessionService(): void {
  registerService(SERVICE_KEY, sessionService);
}

export function useSessionService(): SessionService {
  return createProxyService<SessionService>(SERVICE_KEY);
}
