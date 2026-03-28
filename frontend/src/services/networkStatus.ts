type ConnectionMode = 'online' | 'offline' | 'checking';

interface NetworkStatus {
  mode: ConnectionMode;
  lastOnlineTime: Date | null;
  lastOfflineTime: Date | null;
  reconnectAttempts: number;
  latency: number | null;
}

type NetworkStatusListener = (status: NetworkStatus) => void;

class NetworkStatusService {
  private status: NetworkStatus = {
    mode: 'checking',
    lastOnlineTime: null,
    lastOfflineTime: null,
    reconnectAttempts: 0,
    latency: null,
  };

  private listeners = new Set<NetworkStatusListener>();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 15000;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly HEALTH_ENDPOINT = '/health';

  constructor() {
    this.init();
  }

  private init() {
    window.addEventListener('online', () => this.handleBrowserOnline());
    window.addEventListener('offline', () => this.handleBrowserOffline());

    this.checkConnection();
    this.startPeriodicCheck();
  }

  private handleBrowserOnline() {
    console.log('Browser reports online');
    this.checkConnection();
  }

  private handleBrowserOffline() {
    console.log('Browser reports offline');
    this.setMode('offline');
  }

  private setMode(mode: ConnectionMode) {
    const previousMode = this.status.mode;

    if (previousMode === mode) return;

    this.status = {
      ...this.status,
      mode,
      ...(mode === 'online' && {
        lastOnlineTime: new Date(),
        reconnectAttempts: 0,
      }),
      ...(mode === 'offline' && {
        lastOfflineTime: new Date(),
      }),
    };

    console.log(`Network mode changed: ${previousMode} -> ${mode}`);
    this.notifyListeners();
  }

  async checkConnection(): Promise<boolean> {
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.HEALTH_ENDPOINT, {
        method: 'GET',
        cache: 'no-cache',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const latency = performance.now() - startTime;
        this.status.latency = latency;
        this.setMode('online');
        return true;
      } else {
        this.handleConnectionFailed();
        return false;
      }
    } catch (error) {
      this.handleConnectionFailed();
      return false;
    }
  }

  private handleConnectionFailed() {
    this.status.reconnectAttempts++;

    if (this.status.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.setMode('offline');
    } else {
      this.setMode('offline');
    }
  }

  private startPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      if (this.status.mode === 'offline') {
        this.checkConnection();
      }
    }, this.CHECK_INTERVAL);
  }

  subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.status);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  }

  getStatus(): NetworkStatus {
    return { ...this.status };
  }

  isOnline(): boolean {
    return this.status.mode === 'online';
  }

  isOffline(): boolean {
    return this.status.mode === 'offline';
  }

  async forceReconnect(): Promise<boolean> {
    this.status.reconnectAttempts = 0;
    return await this.checkConnection();
  }

  getLatency(): number | null {
    return this.status.latency;
  }

  getConnectionQuality(): 'excellent' | 'good' | 'poor' | 'offline' {
    if (this.status.mode === 'offline') return 'offline';
    if (this.status.latency === null) return 'good';

    if (this.status.latency < 100) return 'excellent';
    if (this.status.latency < 300) return 'good';
    return 'poor';
  }

  getStatusDescription(): string {
    switch (this.status.mode) {
      case 'online': {
        const quality = this.getConnectionQuality();
        if (quality === 'excellent') return '网络连接优秀';
        if (quality === 'good') return '网络连接良好';
        return '网络连接较差';
      }
      case 'offline':
        return '离线模式';
      case 'checking':
        return '正在检测网络...';
    }
  }

  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    window.removeEventListener('online', this.handleBrowserOnline);
    window.removeEventListener('offline', this.handleBrowserOffline);
    this.listeners.clear();
  }
}

export const networkStatusService = new NetworkStatusService();
export type { NetworkStatus, ConnectionMode };
