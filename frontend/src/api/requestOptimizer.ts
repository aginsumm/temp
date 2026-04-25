interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class RequestOptimizer {
  private pendingRequests: Map<string, Promise<unknown>> = new Map();
  private cache: Map<string, CacheItem<unknown>> = new Map();
  private readonly DEDUPE_WINDOW = 100;
  private readonly DEFAULT_TTL = 5 * 60 * 1000;

  dedupe<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    const existing = this.pendingRequests.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = requestFn().finally(() => {
      setTimeout(() => {
        this.pendingRequests.delete(key);
      }, this.DEDUPE_WINDOW);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  async withCache<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }

    const data = await this.dedupe(key, requestFn);

    this.cache.set(key, {
      data,
      timestamp: now,
      ttl,
    });

    return data;
  }

  async batch<T, R>(
    items: T[],
    batchFn: (batch: T[]) => Promise<R[]>,
    batchSize: number = 10
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await batchFn(batch);
      results.push(...batchResults);
    }

    return results;
  }

  invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

class RetryManager {
  async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      delay?: number;
      backoff?: boolean;
      shouldRetry?: (error: unknown) => boolean;
    } = {}
  ): Promise<T> {
    const { maxRetries = 3, delay = 1000, backoff = true, shouldRetry = () => true } = options;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries || !shouldRetry(error)) {
          throw error;
        }

        const waitTime = backoff ? delay * Math.pow(2, attempt) : delay;
        await this.sleep(waitTime);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

class RequestQueue {
  private queue: Array<() => Promise<unknown>> = [];
  private running = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const fn = this.queue.shift();

    if (fn) {
      await fn();
      this.running--;
      this.process();
    }
  }

  clear(): void {
    this.queue = [];
  }

  get length(): number {
    return this.queue.length;
  }
}

export const requestOptimizer = new RequestOptimizer();
export const retryManager = new RetryManager();
export const requestQueue = new RequestQueue();

export function createOptimizedRequest<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    cacheKey?: (...args: Parameters<T>) => string;
    ttl?: number;
    dedupe?: boolean;
  } = {}
): T {
  return (async (...args: Parameters<T>) => {
    const key = options.cacheKey ? options.cacheKey(...args) : `${fn.name}:${JSON.stringify(args)}`;

    if (options.dedupe !== false) {
      if (options.ttl) {
        return requestOptimizer.withCache(key, () => fn(...args), options.ttl);
      }
      return requestOptimizer.dedupe(key, () => fn(...args));
    }

    return fn(...args);
  }) as T;
}
