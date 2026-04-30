type ConnectionStatus = 'online' | 'offline' | 'reconnecting' | 'degraded';

interface RequestConfig {
  headers?: Record<string, string>;
  [key: string]: unknown;
}

interface QueuedRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: unknown;
  config?: RequestConfig;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface ConnectionState {
  status: ConnectionStatus;
  httpAvailable: boolean;
  wsAvailable: boolean;
  latency: number | null;
  lastConnected: Date | null;
  reconnectAttempts: number;
  queuedRequestsCount: number;
}

interface ConnectionConfig {
  healthCheckInterval: number;
  healthCheckEndpoint: string;
  maxReconnectAttempts: number;
  reconnectBaseDelay: number;
  reconnectMaxDelay: number;
  offlineQueueSize: number;
}

type ConnectionListener = (state: ConnectionState) => void;

const DEFAULT_CONFIG: ConnectionConfig = {
  healthCheckInterval: 30000,
  healthCheckEndpoint: '/',
  maxReconnectAttempts: 10,
  reconnectBaseDelay: 1000,
  reconnectMaxDelay: 30000,
  offlineQueueSize: 50,
};
const HEALTH_PATH = '/api/v1/health';
const API_PATH = '/api/v1';

function resolveHealthCheckUrl(rawBase: string): string {
  // 如果是相对路径，添加默认主机
 const baseUrl = rawBase.startsWith('http') ? rawBase : import.meta.env.VITE_API_URL + rawBase;

  const normalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  // 如果已经包含完整的 health 路径，直接返回
  if (normalized.endsWith(HEALTH_PATH)) {
    return normalized;
  }

  // 如果以 /api/v1 结尾，添加 /health
  if (normalized.endsWith('/api/v1')) {
    return `${normalized}/health`;
  }

  // 如果以 /health 结尾但不是 /api/v1/health，说明配置可能有问题
  if (normalized.endsWith('/health')) {
    const baseWithoutHealth = normalized.slice(0, -'/health'.length);
    if (!baseWithoutHealth.endsWith('/api/v1')) {
      console.warn(
        '⚠️ 检测到 VITE_HEALTH_CHECK_URL 配置可能不正确，建议使用 http://localhost:8000/api/v1'
      );
    }
    return normalized;
  }

  // 如果包含 /api/v1/，替换为 /api/v1/health
  if (normalized.includes('/api/v1/')) {
    return `${normalized.split('/api/v1/')[0]}${HEALTH_PATH}`;
  }

  // 如果包含 /api/v1（但不以它结尾），也替换
  if (normalized.includes('/api/v1')) {
    return `${normalized.split('/api/v1')[0]}${HEALTH_PATH}`;
  }

  // 其他情况，直接追加 /api/v1/health
  return `${normalized}${HEALTH_PATH}`;
}

function resolveApiBaseUrl(): string {
  const rawApiBase =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    API_PATH;

  if (rawApiBase.startsWith('http')) {
    return rawApiBase.endsWith('/') ? rawApiBase.slice(0, -1) : rawApiBase;
  }

  const normalized = rawApiBase.startsWith('/') ? rawApiBase : `/${rawApiBase}`;
  return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

const API_BASE_URL = resolveApiBaseUrl();
const HEALTH_CHECK_BASE_URL = resolveHealthCheckUrl(
  import.meta.env.VITE_HEALTH_CHECK_URL || API_BASE_URL
);

class OfflineQueue {
  private queue: QueuedRequest[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  enqueue(request: QueuedRequest): boolean {
    if (this.queue.length >= this.maxSize) {
      this.queue.sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
      const lowestPriority = this.queue.filter((r) => r.priority === 'low');
      if (lowestPriority.length > 0) {
        const index = this.queue.indexOf(lowestPriority[lowestPriority.length - 1]);
        this.queue.splice(index, 1);
      } else {
        return false;
      }
    }
    this.queue.push(request);
    return true;
  }

  dequeue(): QueuedRequest | undefined {
    return this.queue.shift();
  }

  peek(): QueuedRequest | undefined {
    return this.queue[0];
  }

  clear(): void {
    this.queue = [];
  }

  get size(): number {
    return this.queue.length;
  }

  getAll(): QueuedRequest[] {
    return [...this.queue];
  }
}

class ConnectionManager {
  private state: ConnectionState;
  private listeners: Set<ConnectionListener> = new Set();
  private offlineQueue: OfflineQueue;
  private config: ConnectionConfig;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string, config: Partial<ConnectionConfig> = {}) {
    this.apiBaseUrl = apiBaseUrl;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.offlineQueue = new OfflineQueue(this.config.offlineQueueSize);
    this.state = {
      status: 'online',
      httpAvailable: true,
      wsAvailable: true,
      latency: null,
      lastConnected: null,
      reconnectAttempts: 0,
      queuedRequestsCount: 0,
    };
  }

  initialize(): void {
    this.checkHealth();
    this.startHealthCheck();
  }

  destroy(): void {
    this.stopHealthCheck();
    this.clearReconnectTimer();
    this.listeners.clear();
    this.offlineQueue.clear();
  }

  subscribe(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): ConnectionState {
    return { ...this.state };
  }

  async checkHealth(): Promise<boolean> {
    const startTime = Date.now();
    try {
     const response = await fetch(HEALTH_CHECK_BASE_URL, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      const latency = Date.now() - startTime;
      const isHealthy = response.ok;

      this.updateState({
        httpAvailable: isHealthy,
        latency: isHealthy ? latency : null,
        lastConnected: isHealthy ? new Date() : this.state.lastConnected,
      });

      if (isHealthy && this.state.status !== 'online') {
        this.updateState({ status: 'online', reconnectAttempts: 0 });
        await this.flushQueue();
      }

      return isHealthy;
    } catch (error) {
      console.error('健康检查失败:', error);
      this.updateState({
        httpAvailable: false,
        latency: null,
      });

      if (this.state.status === 'online') {
        this.updateState({ status: 'offline' });
        this.scheduleReconnect();
      }

      return false;
    }
  }

  async forceReconnect(): Promise<boolean> {
    this.clearReconnectTimer();
    this.updateState({ status: 'reconnecting' });

    const isHealthy = await this.checkHealth();

    if (isHealthy) {
      this.updateState({ status: 'online', reconnectAttempts: 0 });
      await this.flushQueue();
    } else {
      this.updateState({ status: 'offline' });
    }

    return isHealthy;
  }

  queueRequest(
    method: QueuedRequest['method'],
    url: string,
    data?: unknown,
    config?: RequestConfig,
    priority: QueuedRequest['priority'] = 'normal'
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        method,
        url,
        data,
        config,
        timestamp: Date.now(),
        priority,
        retryCount: 0,
        resolve,
        reject,
      };

      const enqueued = this.offlineQueue.enqueue(request);
      this.updateState({ queuedRequestsCount: this.offlineQueue.size });

      if (!enqueued) {
        reject(new Error('Offline queue is full'));
      }
    });
  }

  getQueuedRequests(): QueuedRequest[] {
    return this.offlineQueue.getAll();
  }

  clearQueue(): void {
    this.offlineQueue.clear();
    this.updateState({ queuedRequestsCount: 0 });
  }

  setWsStatus(available: boolean): void {
    this.updateState({ wsAvailable: available });
    this.updateOverallStatus();
  }

  private updateState(partial: Partial<ConnectionState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  private updateOverallStatus(): void {
    const { httpAvailable, wsAvailable } = this.state;

    let status: ConnectionStatus;
    if (httpAvailable && wsAvailable) {
      status = 'online';
    } else if (!httpAvailable && !wsAvailable) {
      status = 'offline';
    } else {
      status = 'degraded';
    }

    if (status !== this.state.status && this.state.status !== 'reconnecting') {
      this.updateState({ status });
    }
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.checkHealth();
    }, this.config.healthCheckInterval);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.state.reconnectAttempts >= this.config.maxReconnectAttempts) {
      return;
    }

    this.updateState({ status: 'reconnecting' });

    const delay = this.calculateReconnectDelay();

    this.reconnectTimer = setTimeout(async () => {
      const success = await this.checkHealth();
      if (!success) {
        this.updateState({ reconnectAttempts: this.state.reconnectAttempts + 1 });
        this.scheduleReconnect();
      }
    }, delay);
  }

  private calculateReconnectDelay(): number {
    const { reconnectBaseDelay, reconnectMaxDelay } = this.config;
    const attempts = this.state.reconnectAttempts;

    const exponentialDelay = reconnectBaseDelay * Math.pow(2, attempts);
    const cappedDelay = Math.min(exponentialDelay, reconnectMaxDelay);

    const jitter = cappedDelay * 0.2 * Math.random();

    return cappedDelay + jitter;
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async flushQueue(): Promise<void> {
    const requests = this.offlineQueue.getAll();
    this.offlineQueue.clear();
    this.updateState({ queuedRequestsCount: 0 });

    for (const request of requests) {
      try {
        const response = await fetch(`${this.apiBaseUrl}${request.url}`, {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
            ...request.config?.headers,
          },
          body: request.data ? JSON.stringify(request.data) : undefined,
        });

        if (response.ok) {
          const data = await response.json().catch(() => null);
          request.resolve(data);
        } else {
          request.reject(new Error(`Request failed: ${response.status}`));
        }
      } catch (error) {
        request.reject(error as Error);
      }
    }
  }
}

// 传入正确的 API_BASE_URL，而不是 HEALTH_CHECK_BASE_URL
export const connectionManager = new ConnectionManager(API_BASE_URL);

export { ConnectionManager, OfflineQueue };

export type {
  ConnectionStatus,
  ConnectionState,
  ConnectionConfig,
  ConnectionListener,
  QueuedRequest,
};
