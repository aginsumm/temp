class CacheManager {
  private cache: Map<string, { data: unknown; timestamp: number; ttl: number }>;
  private defaultTTL: number = 5 * 60 * 1000;

  constructor() {
    this.cache = new Map();
    this.loadFromStorage();
    this.startCleanupInterval();
  }

  set(key: string, data: unknown, ttl?: number) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
    this.saveToStorage();
  }

  get(key: string): unknown | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const isExpired = Date.now() - item.timestamp > item.ttl;
    if (isExpired) {
      this.cache.delete(key);
      this.saveToStorage();
      return null;
    }

    return item.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string) {
    this.cache.delete(key);
    this.saveToStorage();
  }

  clear() {
    this.cache.clear();
    this.saveToStorage();
  }

  clearExpired() {
    const now = Date.now();
    let cleared = false;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        cleared = true;
      }
    }

    if (cleared) {
      this.saveToStorage();
    }
  }

  clearByPrefix(prefix: string) {
    let cleared = false;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        cleared = true;
      }
    }

    if (cleared) {
      this.saveToStorage();
    }
  }

  getSize(): number {
    return this.cache.size;
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  private saveToStorage() {
    try {
      const serialized = JSON.stringify(Array.from(this.cache.entries()));
      localStorage.setItem('api-cache', serialized);
    } catch (e) {
      console.error('Failed to save cache to storage:', e);
    }
  }

  private loadFromStorage() {
    try {
      const serialized = localStorage.getItem('api-cache');
      if (serialized) {
        const entries = JSON.parse(serialized);
        this.cache = new Map(entries);
      }
    } catch (e) {
      console.error('Failed to load cache from storage:', e);
    }
  }

  private startCleanupInterval() {
    setInterval(() => {
      this.clearExpired();
    }, 60000);
  }
}

export default new CacheManager();
