import { createProxyService, registerService } from '@webext-core/proxy-service';
import { PrivateKey } from '@wharfkit/antelope';
import {
  AnchorLinkSessionManager,
  AnchorLinkSessionManagerSession,
  AnchorLinkSessionManagerStorage,
} from '@greymass/anchor-link-session-manager';
import { zlib } from '@/lib/antelope/esr';
import { linkStatusItem, sessionsItem, settingsItem } from '@/lib/storage/items';
import { sessionsStateSchema, type LinkStatus, type Session } from '@/lib/storage/schemas';
import { requestService } from './request.service';

export const LINK_NAME = 'Nussio Wallet';
const KEEPALIVE_MS = 20_000;

export interface LinkInfo extends LinkStatus {
  linkId: string | null;
  linkUrl: string;
  requestPublicKey: string | null;
}

export interface SessionRef {
  network: string;
  actor: string;
  permission: string;
  publicKey: string;
  name: string;
}

export interface SessionService {
  list(): Promise<Session[]>;
  status(): Promise<LinkInfo>;
  remove(session: SessionRef): Promise<void>;
  clear(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  restart(): Promise<void>;
  resetKey(): Promise<void>;
}

const SERVICE_KEY = 'SessionService';

let manager: AnchorLinkSessionManager | undefined;
let creating: Promise<AnchorLinkSessionManager> | undefined;
let keepalive: ReturnType<typeof setInterval> | undefined;

function toSession(session: Session): AnchorLinkSessionManagerSession {
  return new AnchorLinkSessionManagerSession(
    session.network,
    session.actor,
    session.permission,
    session.publicKey,
    session.name,
    session.created,
    session.lastUsed,
  );
}

export function stateFromSerialized(raw: string) {
  const parsed = JSON.parse(raw) as {
    linkId: string;
    linkUrl: string;
    requestKey: string;
    sessions: {
      network: unknown;
      actor: unknown;
      permission: unknown;
      publicKey: unknown;
      name: unknown;
      created: number;
      lastUsed: number;
    }[];
  };
  return sessionsStateSchema.parse({
    linkId: parsed.linkId,
    linkUrl: parsed.linkUrl,
    requestKey: parsed.requestKey,
    sessions: parsed.sessions.map((session) => ({
      network: String(session.network),
      actor: String(session.actor),
      permission: String(session.permission),
      publicKey: String(session.publicKey),
      name: String(session.name),
      created: session.created,
      lastUsed: session.lastUsed,
    })),
  });
}

async function patchStatus(patch: Partial<LinkStatus>): Promise<void> {
  const current = await linkStatusItem.getValue();
  await linkStatusItem.setValue({ ...current, ...patch });
}

function socketOf(instance: AnchorLinkSessionManager): WebSocket | undefined {
  return (instance as unknown as { listener?: { socket?: WebSocket } }).listener?.socket;
}

function startKeepalive(instance: AnchorLinkSessionManager): void {
  stopKeepalive();
  keepalive = setInterval(() => {
    const socket = socketOf(instance);
    if (socket && socket.readyState === WebSocket.OPEN) socket.send('keepalive');
  }, KEEPALIVE_MS);
}

function stopKeepalive(): void {
  if (keepalive) clearInterval(keepalive);
  keepalive = undefined;
}

async function createManager(): Promise<AnchorLinkSessionManager> {
  const [state, settings] = await Promise.all([sessionsItem.getValue(), settingsItem.getValue()]);
  const linkUrl = settings.anchorLinkServiceUrl || state.linkUrl || 'cb.anchor.link';
  const storage =
    state.linkId && state.requestKey
      ? new AnchorLinkSessionManagerStorage({
          linkId: state.linkId,
          linkUrl,
          requestKey: state.requestKey,
          sessions: state.sessions.map(toSession),
        })
      : undefined;
  const instance = new AnchorLinkSessionManager({
    linkUrl,
    storage,
    handler: {
      onIncomingRequest(payload) {
        void settingsItem.getValue().then((current) => {
          if (current.allowSigningRequests) return requestService.open(payload);
        });
      },
      onStorageUpdate(raw) {
        void sessionsItem.setValue(stateFromSerialized(raw));
      },
      onSocketEvent(type, event) {
        const now = Date.now();
        switch (type) {
          case 'onopen':
            startKeepalive(instance);
            void patchStatus({ connected: true, lastOpen: now, lastError: null });
            break;
          case 'onclose':
            stopKeepalive();
            void patchStatus({ connected: false, lastClose: now });
            break;
          case 'onmessage':
            void patchStatus({ lastMessage: now });
            break;
          case 'onerror':
            void patchStatus({
              lastError: event instanceof Error ? event.message : String(type),
              lastErrorAt: now,
            });
            break;
          default:
            break;
        }
      },
    },
  });
  if (!storage) await sessionsItem.setValue(stateFromSerialized(instance.storage.serialize()));
  return instance;
}

export async function ensureSessionManager(): Promise<AnchorLinkSessionManager> {
  if (manager) return manager;
  creating ??= createManager().then((instance) => {
    manager = instance;
    creating = undefined;
    return instance;
  });
  return creating;
}

export async function ensureConnected(): Promise<void> {
  const instance = await ensureSessionManager();
  if (!instance.ready) instance.connect();
}

async function teardown(): Promise<void> {
  stopKeepalive();
  if (manager) manager.disconnect();
  manager = undefined;
  await patchStatus({ connected: false });
}

export async function linkCallbackFields(): Promise<{
  link_ch: string;
  link_key: string;
  link_name: string;
  link_meta: string;
}> {
  const instance = await ensureSessionManager();
  const { linkId, linkUrl, requestKey } = instance.storage;
  return {
    link_ch: `https://${linkUrl}/${linkId}`,
    link_key: String(PrivateKey.from(requestKey).toPublic()),
    link_name: LINK_NAME,
    link_meta: JSON.stringify({ sameDevice: false }),
  };
}

export async function addSessionFromIdentity(
  uri: string,
  chainId: string,
  actor: string,
  permission: string,
): Promise<boolean> {
  const instance = await ensureSessionManager();
  try {
    const session = AnchorLinkSessionManagerSession.fromIdentityRequest(
      chainId,
      actor,
      permission,
      uri,
      { zlib },
    );
    instance.addSession(session);
    return true;
  } catch {
    return false;
  }
}

export const sessionService: SessionService = {
  async list() {
    return (await sessionsItem.getValue()).sessions;
  },

  async status() {
    const [state, status] = await Promise.all([sessionsItem.getValue(), linkStatusItem.getValue()]);
    let requestPublicKey: string | null = null;
    if (state.requestKey) {
      try {
        requestPublicKey = String(PrivateKey.from(state.requestKey).toPublic());
      } catch {
        requestPublicKey = null;
      }
    }
    return {
      ...status,
      connected: status.connected && Boolean(manager?.ready),
      linkId: state.linkId,
      linkUrl: state.linkUrl,
      requestPublicKey,
    };
  },

  async remove(ref) {
    const instance = await ensureSessionManager();
    instance.removeSession(
      new AnchorLinkSessionManagerSession(
        ref.network,
        ref.actor,
        ref.permission,
        ref.publicKey,
        ref.name,
      ),
    );
  },

  async clear() {
    const instance = await ensureSessionManager();
    instance.clearSessions();
  },

  async connect() {
    await ensureConnected();
  },

  async disconnect() {
    await teardown();
  },

  async restart() {
    await teardown();
    await ensureConnected();
  },

  async resetKey() {
    await teardown();
    const state = await sessionsItem.getValue();
    await sessionsItem.setValue({
      ...state,
      requestKey: PrivateKey.generate('K1').toWif(),
      sessions: [],
    });
    await ensureConnected();
  },
};

export function registerSessionService(): void {
  registerService(SERVICE_KEY, sessionService);
}

export function useSessionService(): SessionService {
  return createProxyService<SessionService>(SERVICE_KEY);
}
