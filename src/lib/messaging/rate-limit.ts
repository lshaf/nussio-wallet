export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

export interface RateLimiter {
  allow(key: string): boolean;
}

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const now = options.now ?? (() => Date.now());
  const hits = new Map<string, number[]>();
  return {
    allow(key) {
      const current = now();
      const recent = (hits.get(key) ?? []).filter((stamp) => current - stamp < options.windowMs);
      if (recent.length >= options.limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(current);
      hits.set(key, recent);
      if (hits.size > 100) {
        for (const [entry, stamps] of hits) {
          if (stamps.every((stamp) => current - stamp >= options.windowMs)) hits.delete(entry);
        }
      }
      return true;
    },
  };
}

export function originOf(url: string | undefined): string {
  if (!url) return 'unknown';
  try {
    return new URL(url).origin;
  } catch {
    return 'unknown';
  }
}
