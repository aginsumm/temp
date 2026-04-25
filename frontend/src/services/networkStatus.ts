type ConnectionMode = 'online' | 'offline' | 'checking';

interface NetworkStatus {
  mode: ConnectionMode;
  lastOnlineTime: Date | null;
  lastOfflineTime: Date | null;
  reconnectAttempts: number;
  latency: number | null;
  quality: 'excellent' | 'good' | 'poor' | 'offline';
  stabilityScore: number;
}

type NetworkStatusListener = (status: NetworkStatus) => void;

interface LatencyRecord {
  timestamp: number;
  latency: number;
}

class NetworkStatusService {
  private status: NetworkStatus = {
    mode: 'offline',
    lastOnlineTime: null,
    lastOfflineTime: new Date(),
    reconnectAttempts: 0,
    latency: null,
    quality: 'offline',
    stabilityScore: 1,
  };

  private listeners = new Set<NetworkStatusListener>();
  private checkInterval: NodeJS.Timeout | null = null;
  private latencyHistory: LatencyRecord[] = [];
  private readonly CHECK_INTERVAL = 15000;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly BASE_RECONNECT_DELAY = 1000;
  private readonly MAX_RECONNECT_DELAY = 30000;
  private readonly LATENCY_HISTORY_SIZE = 20;
  private readonly HEALTH_ENDPOINT = '/api/v1/health';
  private isReconnecting = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private healthCheckEnabled = false;

  constructor() {
    this.init();
  }

  private init() {
    window.addEventListener('online', () => this.handleBrowserOnline());
    window.addEventListener('offline', () => this.handleBrowserOffline());

    if (this.healthCheckEnabled) {
      this.checkConnection();
      this.startPeriodicCheck();
    }
  }

  private handleBrowserOnline() {
    console.log('Browser reports online');
    this.status.reconnectAttempts = 0;
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
        isReconnecting: false,
      }),
      ...(mode === 'offline' && {
        lastOfflineTime: new Date(),
      }),
    };

    this.status.quality = this.calculateQuality();
    this.status.stabilityScore = this.calculateStability();

    console.log(`Network mode changed: ${previousMode} -> ${mode}`);
    this.notifyListeners();
  }

  private calculateQuality(): 'excellent' | 'good' | 'poor' | 'offline' {
    if (this.status.mode === 'offline') return 'offline';
    if (this.status.latency === null) return 'good';

    if (this.status.latency < 100) return 'excellent';
    if (this.status.latency < 300) return 'good';
    return 'poor';
  }

  private calculateStability(): number {
    if (this.latencyHistory.length < 3) return 1;

    const latencies = this.latencyHistory.map((r) => r.latency);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const variance = latencies.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / latencies.length;
    const stdDev = Math.sqrt(variance);

    const coefficient = stdDev / avg;
    return Math.max(0, Math.min(1, 1 - coefficient));
  }

  private addToLatencyHistory(latency: number): void {
    const now = Date.now();
    this.latencyHistory.push({ timestamp: now, latency });
    
    while (this.latencyHistory.length > this.LATENCY_HISTORY_SIZE) {
      this.latencyHistory.shift();
    }
  }

  private getReconnectDelay(): number {
    const attempts = this.status.reconnectAttempts;
    const delay = Math.min(
      this.BASE_RECONNECT_DELAY * Math.pow(2, attempts),
      this.MAX_RECONNECT_DELAY
    );
    return delay + Math.random() * 1000;
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
        this.addToLatencyHistory(latency);
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
    this.status.stabilityScore = Math.max(0, this.status.stabilityScore - 0.2);

    if (this.status.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.setMode('offline');
    } else {
      this.setMode('offline');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isReconnecting || this.reconnectTimeout) return;

    this.isReconnecting = true;
    const delay = this.getReconnectDelay();

    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.status.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      
      const connected = await this.checkConnection();
      
      if (connected) {
        this.isReconnecting = false;
        console.log('Reconnected successfully');
      } else {
        this.isReconnecting = false;
        if (this.status.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  private startPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      if (this.status.mode === 'offline' && !this.isReconnecting) {
        this.checkConnection();
      } else if (this.status.mode === 'online') {
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
    this.isReconnecting = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    return await this.checkConnection();
  }

  getLatency(): number | null {
    return this.status.latency;
  }

  getConnectionQuality(): 'excellent' | 'good' | 'poor' | 'offline' {
    return this.status.quality;
  }

  getStabilityScore(): number {
    return this.status.stabilityScore;
  }

  getAverageLatency(): number | null {
    if (this.latencyHistory.length === 0) return null;
    
    const sum = this.latencyHistory.reduce((acc, r) => acc + r.latency, 0);
    return sum / this.latencyHistory.length;
  }

  getLatencyTrend(): 'improving' | 'stable' | 'degrading' {
    if (this.latencyHistory.length < 5) return 'stable';

    const recent = this.latencyHistory.slice(-5);
    const firstHalf = recent.slice(0, 2);
    const secondHalf = recent.slice(-2);

    const firstAvg = firstHalf.reduce((a, r) => a + r.latency, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, r) => a + r.latency, 0) / secondHalf.length;

    const diff = firstAvg - secondAvg;
    if (diff > 50) return 'improving';
    if (diff < -50) return 'degrading';
    return 'stable';
  }

  getStatusDescription(): string {
    switch (this.status.mode) {
      case 'online': {
        const quality = this.status.quality;
        const trend = this.getLatencyTrend();
        const trendIcon = trend === 'improving' ? ' ↑' : trend === 'degrading' ? ' ↓' : '';
        
        if (quality === 'excellent') return `网络连接优秀${trendIcon}`;
        if (quality === 'good') return `网络连接良好${trendIcon}`;
        return `网络连接较差${trendIcon}`;
      }
      case 'offline':
        return `离线模式 (重连中...)`;
      case 'checking':
        return '正在检测网络...';
    }
  }

  getDetailedStatus(): string {
    const lines: string[] = [];
    
    lines.push(`状态: ${this.status.mode === 'online' ? '在线' : this.status.mode === 'offline' ? '离线' : '检测中'}`);
    
    if (this.status.latency !== null) {
      lines.push(`延迟: ${this.status.latency.toFixed(0)}ms`);
    }
    
    if (this.latencyHistory.length > 0) {
      const avgLatency = this.getAverageLatency();
      if (avgLatency !== null) {
        lines.push(`平均延迟: ${avgLatency.toFixed(0)}ms`);
      }
    }
    
    lines.push(`稳定性: ${(this.status.stabilityScore * 100).toFixed(0)}%`);
    lines.push(`质量: ${this.status.quality}`);
    
    return lines.join('\n');
  }

  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    window.removeEventListener('online', this.handleBrowserOnline);
    window.removeEventListener('offline', this.handleBrowserOffline);
    this.listeners.clear();
  }
}

export const networkStatusService = new NetworkStatusService();
export type { NetworkStatus, ConnectionMode };
