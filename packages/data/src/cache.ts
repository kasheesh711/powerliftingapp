interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TimedCache {
  private entries = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
