/**
 * 查询缓存服务
 * 使用 LRU (Least Recently Used) 淘汰策略优化查询性能
 * 支持内存缓存和 IndexedDB 持久化缓存
 */

interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  ttl?: number;
}

interface CacheConfig {
  maxMemorySize: number;
  maxPersistedSize: number;
  defaultTTL: number;
  persistToIndexedDB: boolean;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxMemorySize: 100,
  maxPersistedSize: 500,
  defaultTTL: 30 * 60 * 1000,
  persistToIndexedDB: true,
};

export class QueryCache {
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private config: CacheConfig;
  private dbPromise: Promise<void> | null = null;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (this.config.persistToIndexedDB) {
      this.initPersistedCache();
    }
  }

  private async initPersistedCache(): Promise<void> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open('QueryCacheDB', 1);

        request.onerror = () => {
          console.warn('Failed to open persisted cache database:', request.error);
          resolve();
        };

        request.onsuccess = () => {
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('cache')) {
            const store = db.createObjectStore('cache', { keyPath: 'key' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('accessCount', 'accessCount', { unique: false });
          }
        };
      } catch (error) {
        console.warn('IndexedDB not available, using memory cache only:', error);
        resolve();
      }
    });

    return this.dbPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      if (this.isExpired(memoryEntry)) {
        this.memoryCache.delete(key);
        return null;
      }
      memoryEntry.accessCount++;
      memoryEntry.lastAccessed = Date.now();
      return memoryEntry.value as T;
    }

    if (this.config.persistToIndexedDB) {
      const persistedEntry = await this.getFromPersistedCache<T>(key);
      if (persistedEntry) {
        if (!this.isExpired(persistedEntry)) {
          this.memoryCache.set(key, persistedEntry);
          return persistedEntry.value as T;
        }
        await this.removeFromPersistedCache(key);
      }
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
      ttl: ttl || this.config.defaultTTL,
    };

    this.memoryCache.set(key, entry);

    if (this.memoryCache.size > this.config.maxMemorySize) {
      this.evictLRUFromMemory();
    }

    if (this.config.persistToIndexedDB) {
      await this.saveToPersistedCache(entry);
    }
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    if (this.config.persistToIndexedDB) {
      await this.removeFromPersistedCache(key);
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    if (this.config.persistToIndexedDB) {
      await this.clearPersistedCache();
    }
  }

  async has(key: string): Promise<boolean> {
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key)!;
      if (!this.isExpired(entry)) {
        return true;
      }
      this.memoryCache.delete(key);
    }

    if (this.config.persistToIndexedDB) {
      const entry = await this.getFromPersistedCache(key);
      if (entry && !this.isExpired(entry)) {
        return true;
      }
    }

    return false;
  }

  getStats(): {
    memorySize: number;
    memoryUsage: number;
    config: CacheConfig;
  } {
    return {
      memorySize: this.memoryCache.size,
      memoryUsage: this.memoryCache.size / this.config.maxMemorySize,
      config: this.config,
    };
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    if (!entry.ttl) return false;
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictLRUFromMemory(): void {
    let lruKey: string | null = null;
    let lruScore = Infinity;

    for (const [key, entry] of this.memoryCache.entries()) {
      const score = entry.lastAccessed - entry.accessCount * 1000;
      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.memoryCache.delete(lruKey);
    }
  }

  private async getFromPersistedCache<T>(key: string): Promise<CacheEntry<T> | null> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('QueryCacheDB', 1);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('cache', 'readonly');
          const store = transaction.objectStore('cache');
          const getRequest = store.get(key);

          getRequest.onsuccess = () => {
            resolve(getRequest.result || null);
          };

          getRequest.onerror = () => {
            resolve(null);
          };
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }

  private async saveToPersistedCache<T>(entry: CacheEntry<T>): Promise<void> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('QueryCacheDB', 1);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('cache', 'readwrite');
          const store = transaction.objectStore('cache');

          store.put(entry);

          transaction.oncomplete = () => {
            this.checkPersistedCacheSize();
            resolve();
          };

          transaction.onerror = () => {
            resolve();
          };
        };

        request.onerror = () => {
          resolve();
        };
      } catch {
        resolve();
      }
    });
  }

  private async removeFromPersistedCache(key: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('QueryCacheDB', 1);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('cache', 'readwrite');
          const store = transaction.objectStore('cache');

          store.delete(key);

          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve();
        };

        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private async clearPersistedCache(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('QueryCacheDB', 1);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('cache', 'readwrite');
          const store = transaction.objectStore('cache');

          store.clear();

          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve();
        };

        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private async checkPersistedCacheSize(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('QueryCacheDB', 1);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('cache', 'readonly');
          const store = transaction.objectStore('cache');
          const countRequest = store.count();

          countRequest.onsuccess = () => {
            const count = countRequest.result;
            if (count > this.config.maxPersistedSize) {
              this.evictLRUFromPersistedCache(count - this.config.maxPersistedSize);
            }
            resolve();
          };

          countRequest.onerror = () => resolve();
        };

        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private async evictLRUFromPersistedCache(count: number): Promise<void> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('QueryCacheDB', 1);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('cache', 'readwrite');
          const store = transaction.objectStore('cache');
          const index = store.index('accessCount');
          const cursorRequest = index.openCursor(null, 'next');

          let deleted = 0;
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (cursor && deleted < count) {
              cursor.delete();
              deleted++;
              cursor.continue();
            } else {
              resolve();
            }
          };

          cursorRequest.onerror = () => resolve();
        };

        request.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

export const queryCache = new QueryCache();
export default queryCache;
