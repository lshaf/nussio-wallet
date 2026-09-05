import { Authority, Serializer } from '@wharfkit/antelope';

export interface AuthorityKeyInput {
  key: string;
  weight: number;
}

export interface AuthorityAccountInput {
  actor: string;
  permission: string;
  weight: number;
}

export interface AuthorityInput {
  threshold: number;
  keys: AuthorityKeyInput[];
  accounts: AuthorityAccountInput[];
  waits?: { wait_sec: number; weight: number }[];
}

export interface AuthorityProblem {
  code: 'threshold' | 'empty' | 'unreachable' | 'key' | 'duplicate';
  detail?: string;
}

export function buildAuthority(input: AuthorityInput): Record<string, unknown> {
  const authority = Authority.from({
    threshold: input.threshold,
    keys: input.keys.map((entry) => ({ key: entry.key, weight: entry.weight })),
    accounts: input.accounts.map((entry) => ({
      permission: { actor: entry.actor, permission: entry.permission },
      weight: entry.weight,
    })),
    waits: input.waits ?? [],
  });
  authority.sort();
  return Serializer.objectify(authority) as Record<string, unknown>;
}

export function checkAuthority(input: AuthorityInput): AuthorityProblem | null {
  if (!(input.threshold > 0)) return { code: 'threshold' };
  if (input.keys.length === 0 && input.accounts.length === 0) return { code: 'empty' };
  for (const entry of input.keys) {
    try {
      buildAuthority({ threshold: 1, keys: [entry], accounts: [] });
    } catch {
      return { code: 'key', detail: entry.key };
    }
  }
  const seenKeys = new Set<string>();
  for (const entry of input.keys) {
    if (seenKeys.has(entry.key)) return { code: 'duplicate', detail: entry.key };
    seenKeys.add(entry.key);
  }
  const seenAccounts = new Set<string>();
  for (const entry of input.accounts) {
    const id = `${entry.actor}@${entry.permission}`;
    if (seenAccounts.has(id)) return { code: 'duplicate', detail: id };
    seenAccounts.add(id);
  }
  const total = [...input.keys, ...input.accounts].reduce((sum, entry) => sum + entry.weight, 0);
  if (total < input.threshold) return { code: 'unreachable' };
  return null;
}
