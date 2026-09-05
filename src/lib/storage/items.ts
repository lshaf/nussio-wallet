import { storage } from 'wxt/utils/storage';
import type { KeyEntry, KeyringEnvelope } from '@/lib/crypto/keyring';
import {
  settingsSchema,
  sessionsStateSchema,
  linkStatusSchema,
  pendingStateSchema,
  type LinkStatus,
  type AbiCacheEntry,
  type Blockchain,
  type ConnectedSite,
  type Contact,
  type CustomToken,
  type PendingRequest,
  type PendingState,
  type SessionsState,
  type Settings,
  type Wallet,
} from './schemas';

export const settingsItem = storage.defineItem<Settings>('local:settings', {
  fallback: settingsSchema.parse({}),
  version: 3,
  migrations: {
    2: (stored: unknown) => settingsSchema.parse(stored ?? {}),
    3: (stored: unknown) => settingsSchema.parse(stored ?? {}),
  },
});

export const blockchainsItem = storage.defineItem<Blockchain[]>('local:blockchains', {
  fallback: [],
  version: 1,
});

export const walletsItem = storage.defineItem<Wallet[]>('local:wallets', {
  fallback: [],
  version: 1,
});

export const keyringItem = storage.defineItem<KeyringEnvelope | null>('local:keyring', {
  fallback: null,
  version: 1,
});

export const publicKeysItem = storage.defineItem<string[]>('local:publicKeys', {
  fallback: [],
  version: 1,
});

export const sessionsItem = storage.defineItem<SessionsState>('local:sessions', {
  fallback: sessionsStateSchema.parse({}),
  version: 1,
});

export const abiCacheItem = storage.defineItem<Record<string, AbiCacheEntry>>('local:abis', {
  fallback: {},
  version: 1,
});

export const contactsItem = storage.defineItem<Contact[]>('local:contacts', {
  fallback: [],
  version: 1,
});

export const customTokensItem = storage.defineItem<CustomToken[]>('local:customTokens', {
  fallback: [],
  version: 1,
});

export const connectedSitesItem = storage.defineItem<ConnectedSite[]>('local:connectedSites', {
  fallback: [],
  version: 1,
});

export const pendingItem = storage.defineItem<PendingState>('local:pending', {
  fallback: pendingStateSchema.parse({}),
  version: 1,
});

export const unlockedItem = storage.defineItem<boolean>('session:unlocked', {
  fallback: false,
});

export const unlockedKeysItem = storage.defineItem<KeyEntry[]>('session:unlockedKeys', {
  fallback: [],
});

export const pendingRequestsItem = storage.defineItem<PendingRequest[]>('session:requests', {
  fallback: [],
});

export const linkStatusItem = storage.defineItem<LinkStatus>('session:linkStatus', {
  fallback: linkStatusSchema.parse({}),
});
