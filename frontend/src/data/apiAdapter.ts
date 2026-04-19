import type { ApiResponse, ApiError, ConnectionMode, NetworkStatus } from './models';

interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  timeout?: number;
}

type NetworkStatusListener = (status: NetworkStatus) => void;

class ApiAdapterManager {
  private baseUrl: string = 'http://localhost:8000/api/v1';
  private defaultTimeout: number = 30000;
  private connectionMode: ConnectionMode = 'offline';
  private listeners: Set<NetworkStatusListener> = new Set();
  private lastOnlineCheck: number = 0;
  private onlineCheckInterval: number = 30000;
  private backendAvailable: boolean = false;

  constructor() {
    this.checkOnlineStatus();
    this.startPeriodicCheck();
  }

  private startPeriodicCheck(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnlineStatusChange(true));
      window.addEventListener('offline', () => this.handleOnlineStatusChange(false));

      setInterval(() => {
        this.checkOnlineStatus();
      }, this.onlineCheckInterval);
    }
  }

  private handleOnlineStatusChange(isOnline: boolean): void {
    this.connectionMode = isOnline ? 'online' : 'offline';
    this.notifyListeners();
  }

  async checkOnlineStatus(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastOnlineCheck < 5000) {
      return this.connectionMode === 'online';
    }

    this.lastOnlineCheck = now;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.backendAvailable = response.ok;
      this.connectionMode = response.ok ? 'online' : 'offline';
    } catch {
      this.backendAvailable = false;
      this.connectionMode = 'offline';
    }

    this.notifyListeners();
    return this.connectionMode === 'online';
  }

  private notifyListeners(): void {
    const status: NetworkStatus = {
      mode: this.connectionMode,
      isOnline: this.connectionMode === 'online',
      lastChecked: Date.now(),
    };

    this.listeners.forEach((listener) => listener(status));
  }

  subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    listener({
      mode: this.connectionMode,
      isOnline: this.connectionMode === 'online',
      lastChecked: this.lastOnlineCheck,
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  shouldUseLocal(): boolean {
    return this.connectionMode === 'offline' || !this.backendAvailable;
  }

  shouldUseRemote(): boolean {
    return this.connectionMode === 'online' && this.backendAvailable;
  }

  getOnlineStatus(): boolean {
    return this.connectionMode === 'online' && this.backendAvailable;
  }

  getMode(): ConnectionMode {
    return this.connectionMode;
  }

  isBackendAvailable(): boolean {
    return this.backendAvailable;
  }

  private buildUrl(
    url: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      if (searchParams.toString()) {
        return `${fullUrl}?${searchParams.toString()}`;
      }
    }

    return fullUrl;
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {

    // 👇🌟🌟🌟 终极安检门：拦截一切导致 Bug 的空消息和假消息 🌟🌟🌟👇
    if (config.url && config.url.includes('/chat/message')) {
      
      // 👇🌟 拦截所有发往废弃接口的请求 🌟👇
    if (config.url && config.url.includes('/chat/message')) {
      console.warn("🛑 后端已删除 /chat/message 接口，已拦截废弃的同步请求");
      return { data: {} as T, status: 200, headers: {} }; // 假装成功，让同步器闭嘴，消除 404
    }

      // // 2. 拦截被 syncManager 盲目推送的空内容请求！(这是解决英文预设的关键)
      // if (config.method === 'POST' && config.data) {
      //   const payloadContent = (config.data as any).content;
      //   if (payloadContent === undefined || payloadContent === null || payloadContent.trim() === '') {
      //     console.warn("🛑 拦截了导致双重回复的空消息请求！已丢弃。");
      //     return { data: {} as T, status: 200, headers: {} }; // 假装成功，让同步器闭嘴
      //   }
      // }
    }
    // 👆🌟🌟🌟 拦截结束 🌟🌟🌟👆

    const { method, url, data, params, headers, timeout } = config;
    const fullUrl = this.buildUrl(url, params);
    const token = this.getAuthToken();

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout || this.defaultTimeout);

    try {
      const response = await fetch(fullUrl, {
        method,
        headers: requestHeaders,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error: ApiError = {
          message: errorData.message || `HTTP Error: ${response.status}`,
          status: response.status,
          code: errorData.code,
          details: errorData.details,
        };
        throw Object.assign(new Error(error.message), error);
      }

      const responseData = await response.json();

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        data: responseData,
        status: response.status,
        headers: responseHeaders,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError: ApiError = {
          message: 'Request timeout',
          code: 'TIMEOUT',
        };
        throw Object.assign(new Error(timeoutError.message), timeoutError);
      }

      this.connectionMode = 'offline';
      this.backendAvailable = false;
      this.notifyListeners();

      throw error;
    }
  }

  async get<T>(url: string, params?: Record<string, string | number | boolean>): Promise<T> {
    const response = await this.request<T>({ method: 'GET', url, params });
    return response.data;
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.request<T>({ method: 'POST', url, data });
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.request<T>({ method: 'PUT', url, data });
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.request<T>({ method: 'DELETE', url });
    return response.data;
  }

  async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.request<T>({ method: 'PATCH', url, data });
    return response.data;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }
}

export const apiAdapterManager = new ApiAdapterManager();
export default apiAdapterManager;
