/**
 * 全局 API 缓存服务
 * 为 Chat 和 Knowledge 模块提供统一的 API 缓存层
 * 支持缓存、请求去重、LRU 淘汰和自动清理
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
  expiresAt: number;
}

interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  cleanupInterval: number;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

class APICacheService {
  private static instance: APICacheService;
  private cache = new Map<string, CacheEntry<any>>();
  private config: CacheConfig;
  private pendingRequests = new Map<string, Promise<any>>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private constructor(config?: Partial<CacheConfig>) {
    this.config = {
      defaultTTL: 5 * 60 * 1000,
      maxSize: 100,
      cleanupInterval: 60 * 1000,
      ...config,
    };

    this.startCleanupTimer();
  }

  static getInstance(config?: Partial<CacheConfig>): APICacheService {
    if (!APICacheService.instance) {
      APICacheService.instance = new APICacheService(config);
    }
    return APICacheService.instance;
  }

  private startCleanupTimer(): void {
    if (typeof window === 'undefined') return;

    this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupInterval);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0,
      expiresAt: Date.now() + (ttl ?? this.config.defaultTTL),
    });
  }

  async request<T>(
    key: string,
    requestFn: () => Promise<T>,
    options?: {
      ttl?: number;
      forceRefresh?: boolean;
      deduplicate?: boolean;
    }
  ): Promise<T> {
    const { forceRefresh = false, deduplicate = true } = options ?? {};

    if (!forceRefresh) {
      const cached = this.get<T>(key);
      if (cached) {
        return cached;
      }
    }

    if (deduplicate && this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    const requestPromise = (async () => {
      try {
        const data = await requestFn();
        this.set(key, data, options?.ttl);
        return data;
      } finally {
        this.pendingRequests.delete(key);
      }
    })();

    if (deduplicate) {
      this.pendingRequests.set(key, requestPromise);
    }

    return requestPromise;
  }

  invalidate(pattern: string | RegExp): void {
    if (typeof pattern === 'string') {
      this.cache.delete(pattern);
    } else {
      for (const key of this.cache.keys()) {
        if (pattern.test(key)) {
          this.cache.delete(key);
        }
      }
    }
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  getStats(): CacheStats {
    let hits = 0;
    let misses = 0;

    for (const entry of this.cache.values()) {
      hits += entry.hits;
    }

    misses = this.cache.size;

    return {
      size: this.cache.size,
      hits,
      misses,
      hitRate: hits / (hits + misses) || 0,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private evictLRU(): void {
    let minHits = Infinity;
    let keyToDelete = '';

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        keyToDelete = key;
      }
    }

    if (keyToDelete) {
      this.cache.delete(keyToDelete);
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }

  static resetInstance(): void {
    if (APICacheService.instance) {
      APICacheService.instance.destroy();
      APICacheService.instance = null as any;
    }
  }
}

export const apiCacheService = APICacheService.getInstance();

export { APICacheService };

export default apiCacheService;
