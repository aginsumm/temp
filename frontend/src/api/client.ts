import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import { randomId } from '../utils/randomId';

interface RequestDeduplicationConfig {
  enabled: boolean;
  ttl: number;
  maxCacheSize: number;
}

interface PendingRequest {
  promise: Promise<AxiosResponse>;
  timestamp: number;
  controller: AbortController;
}

interface CachedResponse {
  response: AxiosResponse;
  timestamp: number;
}

interface RequestMetrics {
  totalRequests: number;
  deduplicatedRequests: number;
  cachedResponses: number;
  failedRequests: number;
  avgLatency: number;
}

class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private responseCache: Map<string, CachedResponse> = new Map();
  private config: RequestDeduplicationConfig;
  private metrics: RequestMetrics = {
    totalRequests: 0,
    deduplicatedRequests: 0,
    cachedResponses: 0,
    failedRequests: 0,
    avgLatency: 0,
  };
  private totalLatency = 0;

  constructor(config: Partial<RequestDeduplicationConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      ttl: config.ttl ?? 5000,
      maxCacheSize: config.maxCacheSize ?? 100,
    };

    setInterval(() => this.cleanup(), 10000);
  }

  private generateKey(config: AxiosRequestConfig): string {
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';
    const params = config.params ? JSON.stringify(config.params) : '';
    const data = config.data ? JSON.stringify(config.data) : '';

    return `${method}:${url}:${params}:${data}`;
  }

  private isCacheable(config: AxiosRequestConfig): boolean {
    const method = config.method?.toUpperCase() || 'GET';
    return method === 'GET' || method === 'HEAD';
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [key, pending] of this.pendingRequests.entries()) {
      if (now - pending.timestamp > 30000) {
        pending.controller.abort('Request timeout in deduplicator');
        this.pendingRequests.delete(key);
      }
    }

    for (const [key, cached] of this.responseCache.entries()) {
      if (now - cached.timestamp > this.config.ttl) {
        this.responseCache.delete(key);
      }
    }

    if (this.responseCache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.responseCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toDelete = entries.slice(0, entries.length - this.config.maxCacheSize);
      for (const [key] of toDelete) {
        this.responseCache.delete(key);
      }
    }
  }

  async execute<T = unknown>(
    config: AxiosRequestConfig,
    executor: (config: AxiosRequestConfig) => Promise<AxiosResponse<T>>
  ): Promise<AxiosResponse<T>> {
    if (!this.config.enabled) {
      return executor(config);
    }

    const key = this.generateKey(config);
    this.metrics.totalRequests++;

    if (this.isCacheable(config)) {
      const cached = this.responseCache.get(key);
      if (cached && Date.now() - cached.timestamp < this.config.ttl) {
        this.metrics.cachedResponses++;
        return cached.response as AxiosResponse<T>;
      }
    }

    const pending = this.pendingRequests.get(key);
    if (pending) {
      this.metrics.deduplicatedRequests++;
      return pending.promise as Promise<AxiosResponse<T>>;
    }

    const controller = new AbortController();
    const startTime = Date.now();

    const promise = executor({
      ...config,
      signal: controller.signal,
    })
      .then((response) => {
        this.totalLatency += Date.now() - startTime;
        this.metrics.avgLatency = this.totalLatency / this.metrics.totalRequests;

        if (this.isCacheable(config)) {
          this.responseCache.set(key, {
            response,
            timestamp: Date.now(),
          });
        }

        return response;
      })
      .catch((error) => {
        this.metrics.failedRequests++;
        throw error;
      })
      .finally(() => {
        this.pendingRequests.delete(key);
      });

    this.pendingRequests.set(key, {
      promise,
      timestamp: startTime,
      controller,
    });

    return promise;
  }

  cancelPendingRequests(pattern?: string): number {
    let cancelled = 0;

    for (const [key, pending] of this.pendingRequests.entries()) {
      if (!pattern || key.includes(pattern)) {
        pending.controller.abort('Request cancelled');
        this.pendingRequests.delete(key);
        cancelled++;
      }
    }

    return cancelled;
  }

  invalidateCache(pattern?: string): number {
    if (!pattern) {
      const size = this.responseCache.size;
      this.responseCache.clear();
      return size;
    }

    let invalidated = 0;
    for (const key of this.responseCache.keys()) {
      if (key.includes(pattern)) {
        this.responseCache.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  getMetrics(): RequestMetrics & { pendingCount: number; cacheSize: number } {
    return {
      ...this.metrics,
      pendingCount: this.pendingRequests.size,
      cacheSize: this.responseCache.size,
    };
  }

  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      deduplicatedRequests: 0,
      cachedResponses: 0,
      failedRequests: 0,
      avgLatency: 0,
    };
    this.totalLatency = 0;
  }
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  retryableStatusCodes: number[];
}

interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  deduplication?: Partial<RequestDeduplicationConfig>;
  retry?: Partial<RetryConfig>;
  onResponse?: (response: AxiosResponse) => AxiosResponse;
  onError?: (error: AxiosError) => void;
}

class EnhancedApiClient {
  private instance: AxiosInstance;
  private deduplicator: RequestDeduplicator;
  private retryConfig: RetryConfig;
  private onResponse?: (response: AxiosResponse) => AxiosResponse;
  private onError?: (error: AxiosError) => void;
  private requestIdHeader: string;

  constructor(config: ApiClientConfig) {
    this.instance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.deduplicator = new RequestDeduplicator(config.deduplication);

    this.retryConfig = {
      maxRetries: config.retry?.maxRetries ?? 3,
      baseDelay: config.retry?.baseDelay ?? 1000,
      maxDelay: config.retry?.maxDelay ?? 30000,
      exponentialBase: config.retry?.exponentialBase ?? 2,
      retryableStatusCodes: config.retry?.retryableStatusCodes ?? [408, 429, 500, 502, 503, 504],
    };

    this.onResponse = config.onResponse;
    this.onError = config.onError;
    this.requestIdHeader = 'X-Request-ID';

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        config.headers = config.headers || {};
        config.headers[this.requestIdHeader] = randomId();

        const token = this.getToken();
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    this.instance.interceptors.response.use(
      (response) => {
        if (this.onResponse) {
          return this.onResponse(response);
        }
        return response;
      },
      async (error: AxiosError) => {
        if (this.onError) {
          this.onError(error);
        }

        const config = error.config as AxiosRequestConfig & { _retryCount?: number };

        if (!config) {
          return Promise.reject(error);
        }

        const retryCount = config._retryCount || 0;

        if (retryCount >= this.retryConfig.maxRetries) {
          return Promise.reject(error);
        }

        const shouldRetry = this.shouldRetryRequest(error);
        if (!shouldRetry) {
          return Promise.reject(error);
        }

        config._retryCount = retryCount + 1;

        const delay = this.calculateDelay(retryCount, error);
        await this.sleep(delay);

        return this.instance.request(config);
      }
    );
  }

  private shouldRetryRequest(error: AxiosError): boolean {
    if (!error.response) {
      return true;
    }

    const status = error.response.status;

    if (status === 429) {
      return true;
    }

    return this.retryConfig.retryableStatusCodes.includes(status);
  }

  private calculateDelay(retryCount: number, error: AxiosError): number {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        const retryAfterMs = parseInt(retryAfter, 10) * 1000;
        return Math.min(retryAfterMs, this.retryConfig.maxDelay);
      }
    }

    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.exponentialBase, retryCount),
      this.retryConfig.maxDelay
    );

    const jitter = delay * 0.2 * Math.random();
    return delay + jitter;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.deduplicator.execute({ ...config, method: 'GET', url }, (cfg) =>
      this.instance.request<T>(cfg)
    );
    return response.data;
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.request<T>({
      ...config,
      method: 'POST',
      url,
      data,
    });
    return response.data;
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.request<T>({
      ...config,
      method: 'PUT',
      url,
      data,
    });
    return response.data;
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.request<T>({
      ...config,
      method: 'PATCH',
      url,
      data,
    });
    return response.data;
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.request<T>({
      ...config,
      method: 'DELETE',
      url,
    });
    return response.data;
  }

  cancelPendingRequests(pattern?: string): number {
    return this.deduplicator.cancelPendingRequests(pattern);
  }

  invalidateCache(pattern?: string): number {
    return this.deduplicator.invalidateCache(pattern);
  }

  getMetrics() {
    return this.deduplicator.getMetrics();
  }

  resetMetrics(): void {
    this.deduplicator.resetMetrics();
  }

  setBaseURL(baseURL: string): void {
    this.instance.defaults.baseURL = baseURL;
  }

  setDefaultHeader(key: string, value: string): void {
    this.instance.defaults.headers.common[key] = value;
  }

  removeDefaultHeader(key: string): void {
    delete this.instance.defaults.headers.common[key];
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const apiClient = new EnhancedApiClient({
  baseURL: API_BASE_URL,
  timeout: 30000,
  deduplication: {
    enabled: true,
    ttl: 5000,
    maxCacheSize: 100,
  },
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    exponentialBase: 2,
  },
  onError: (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
    });
  },
});

export { EnhancedApiClient, RequestDeduplicator, apiClient };
export type { ApiClientConfig, RequestDeduplicationConfig, RetryConfig, RequestMetrics };

export default apiClient;

import { connectionManager } from '../services/connectionManager';

connectionManager.initialize();

export function getConnectionStatus(): boolean {
  return connectionManager.getState().httpAvailable;
}

export function subscribeToConnectionStatus(callback: (connected: boolean) => void): () => void {
  return connectionManager.subscribe((state) => {
    callback(state.httpAvailable);
  });
}

export async function forceReconnect(): Promise<boolean> {
  return connectionManager.forceReconnect();
}
