/**
 * Simple in-memory TTL cache for expensive I/O operations.
 * Used to avoid redundant network scans (SNMP, file shares, etc.)
 * on repeat page loads within a short window.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class TtlCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 30_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  /**
   * Get cached value or compute it and store.
   * Only one concurrent fetch per key — concurrent callers wait for the first.
   */
  private pending = new Map<string, Promise<T>>();

  async getOrFetch(key: string, fetchFn: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    // Deduplicate concurrent requests for the same key
    const inflight = this.pending.get(key);
    if (inflight) return inflight;

    const promise = fetchFn().then((data) => {
      this.set(key, data, ttlMs);
      this.pending.delete(key);
      return data;
    }).catch((err) => {
      this.pending.delete(key);
      throw err;
    });

    this.pending.set(key, promise);
    return promise;
  }

  invalidate(key: string): void {
    this.store.delete(key);
    this.pending.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.pending.clear();
  }

  get size(): number {
    // Prune expired entries on size check
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (now > v.expiresAt) this.store.delete(k);
    }
    return this.store.size;
  }
}
