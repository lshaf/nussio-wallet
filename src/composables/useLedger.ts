import { ref } from 'vue';
import { LedgerSession } from '@/lib/ledger/session';
import { hidSupported, pairedLedger, requestLedger, type WebHidSender } from '@/lib/ledger/hid';
import { DEFAULT_PATH, pathAt } from '@/lib/ledger/paths';

export const DERIVE_COUNT = 5;

export interface DerivedKey {
  path: string;
  legacy: string;
}

export interface LedgerSignRequest {
  path: string;
  legacy: string;
  chunks: string[];
}

export function useLedger() {
  const supported = hidSupported();
  const busy = ref(false);
  const waiting = ref(false);
  const version = ref('');
  const error = ref<string | null>(null);

  async function withSession<T>(action: (session: LedgerSession) => Promise<T>): Promise<T | null> {
    if (!supported) {
      error.value = 'hid_unsupported';
      return null;
    }
    busy.value = true;
    error.value = null;
    let sender: WebHidSender | null = null;
    try {
      sender = (await pairedLedger()) ?? (await requestLedger());
      if (!sender) throw new Error('ledger_no_device');
      const session = new LedgerSession(sender);
      version.value = await session.appVersion();
      return await action(session);
    } catch (thrown) {
      error.value = thrown instanceof Error ? thrown.message : String(thrown);
      return null;
    } finally {
      busy.value = false;
      waiting.value = false;
      await sender?.close().catch(() => undefined);
    }
  }

  function accounts(count = DERIVE_COUNT): Promise<DerivedKey[] | null> {
    return withSession(async (session) => {
      const found: DerivedKey[] = [];
      for (let index = 0; index < count; index += 1) {
        const path = pathAt(index);
        found.push({ path, legacy: await session.legacyKey(path) });
      }
      return found;
    });
  }

  function confirm(path = DEFAULT_PATH): Promise<string | null> {
    return withSession((session) => {
      waiting.value = true;
      return session.legacyKey(path, true);
    });
  }

  function sign(request: LedgerSignRequest): Promise<string | null> {
    return withSession(async (session) => {
      const legacy = await session.legacyKey(request.path);
      if (legacy !== request.legacy) throw new Error('ledger_wrong_device');
      waiting.value = true;
      return session.sign(request.path, request.chunks);
    });
  }

  return { supported, busy, waiting, version, error, accounts, confirm, sign };
}
