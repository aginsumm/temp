interface NetworkQuality {
  rtt: number;
  throughput: number;
  packetLoss: number;
}

type StrategyLevel = 'full' | 'reduced' | 'minimal' | 'offline';

interface StrategyChangeCallback {
  (from: StrategyLevel, to: StrategyLevel, description: string): void;
}

interface FeatureConfig {
  streaming: boolean;
  caching: boolean;
  mockData: boolean;
  imageOptimization: boolean;
  prefetching: boolean;
}

const STRATEGY_DESCRIPTIONS: Record<StrategyLevel, string> = {
  full: '完整功能模式 - 所有功能正常可用',
  reduced: '降级模式 - 部分功能受限，已启用缓存加速',
  minimal: '最小功能模式 - 仅保留核心功能，已启用本地数据',
  offline: '离线模式 - 使用本地缓存数据，部分功能不可用',
};

const FEATURE_CONFIGS: Record<StrategyLevel, FeatureConfig> = {
  full: {
    streaming: true,
    caching: false,
    mockData: false,
    imageOptimization: true,
    prefetching: true,
  },
  reduced: {
    streaming: false,
    caching: true,
    mockData: false,
    imageOptimization: true,
    prefetching: false,
  },
  minimal: {
    streaming: false,
    caching: true,
    mockData: true,
    imageOptimization: true,
    prefetching: false,
  },
  offline: {
    streaming: false,
    caching: true,
    mockData: true,
    imageOptimization: false,
    prefetching: false,
  },
};

class DegradationStrategy {
  private currentLevel: StrategyLevel = 'full';
  private previousLevel: StrategyLevel = 'full';
  private listeners = new Set<StrategyChangeCallback>();
  private qualityHistory: NetworkQuality[] = [];
  private readonly HISTORY_SIZE = 10;
  private lastCheckTime = 0;
  private readonly CHECK_INTERVAL = 5000;

  async measureNetworkQuality(): Promise<NetworkQuality> {
    const start = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
      const response = await fetch(`${apiBaseUrl}/health`, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const rtt = performance.now() - start;

      return {
        rtt,
        throughput: response.headers.get('content-length')
          ? Number(response.headers.get('content-length')) / (rtt / 1000)
          : 1000000 / rtt,
        packetLoss: 0,
      };
    } catch (e) {
      return {
        rtt: 10000,
        throughput: 0,
        packetLoss: 1,
      };
    }
  }

  private addToHistory(quality: NetworkQuality): void {
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > this.HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
  }

  private getAverageQuality(): NetworkQuality {
    if (this.qualityHistory.length === 0) {
      return { rtt: 0, throughput: 0, packetLoss: 0 };
    }

    const sum = this.qualityHistory.reduce(
      (acc, q) => ({
        rtt: acc.rtt + q.rtt,
        throughput: acc.throughput + q.throughput,
        packetLoss: acc.packetLoss + q.packetLoss,
      }),
      { rtt: 0, throughput: 0, packetLoss: 0 }
    );

    return {
      rtt: sum.rtt / this.qualityHistory.length,
      throughput: sum.throughput / this.qualityHistory.length,
      packetLoss: sum.packetLoss / this.qualityHistory.length,
    };
  }

  private determineLevel(quality: NetworkQuality): StrategyLevel {
    if (quality.packetLoss > 0.5 || quality.rtt > 5000 || quality.throughput < 1000) {
      return 'offline';
    }

    if (quality.rtt > 2000 || quality.throughput < 10000) {
      return 'minimal';
    }

    if (quality.rtt > 1000 || quality.throughput < 100000) {
      return 'reduced';
    }

    return 'full';
  }

  async updateStrategy(): Promise<StrategyLevel> {
    const now = Date.now();
    if (now - this.lastCheckTime < this.CHECK_INTERVAL) {
      return this.currentLevel;
    }

    this.lastCheckTime = now;
    const quality = await this.measureNetworkQuality();
    this.addToHistory(quality);

    const avgQuality = this.getAverageQuality();
    const newLevel = this.determineLevel(avgQuality);

    if (newLevel !== this.currentLevel) {
      this.previousLevel = this.currentLevel;
      this.currentLevel = newLevel;
      this.notifyListeners();
    }

    console.log(
      `Strategy level: ${this.currentLevel}, RTT: ${quality.rtt.toFixed(0)}ms, Throughput: ${quality.throughput.toFixed(0)}`
    );

    return this.currentLevel;
  }

  subscribe(callback: StrategyChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const description = STRATEGY_DESCRIPTIONS[this.currentLevel];
    this.listeners.forEach((callback) => {
      try {
        callback(this.previousLevel, this.currentLevel, description);
      } catch (error) {
        console.error('Error in strategy change listener:', error);
      }
    });
  }

  getCurrentLevel(): StrategyLevel {
    return this.currentLevel;
  }

  getPreviousLevel(): StrategyLevel {
    return this.previousLevel;
  }

  getFeatureConfig(): FeatureConfig {
    return { ...FEATURE_CONFIGS[this.currentLevel] };
  }

  shouldUseMock(): boolean {
    return FEATURE_CONFIGS[this.currentLevel].mockData;
  }

  shouldStream(): boolean {
    return FEATURE_CONFIGS[this.currentLevel].streaming;
  }

  shouldCache(): boolean {
    return FEATURE_CONFIGS[this.currentLevel].caching;
  }

  shouldPrefetch(): boolean {
    return FEATURE_CONFIGS[this.currentLevel].prefetching;
  }

  shouldOptimizeImages(): boolean {
    return FEATURE_CONFIGS[this.currentLevel].imageOptimization;
  }

  getRetryCount(): number {
    switch (this.currentLevel) {
      case 'full':
        return 3;
      case 'reduced':
        return 2;
      case 'minimal':
        return 1;
      case 'offline':
        return 0;
    }
  }

  getTimeout(): number {
    switch (this.currentLevel) {
      case 'full':
        return 30000;
      case 'reduced':
        return 15000;
      case 'minimal':
        return 10000;
      case 'offline':
        return 5000;
    }
  }

  getLevelDescription(): string {
    return STRATEGY_DESCRIPTIONS[this.currentLevel];
  }

  getShortDescription(): string {
    switch (this.currentLevel) {
      case 'full':
        return '完整功能';
      case 'reduced':
        return '降级模式';
      case 'minimal':
        return '最小功能';
      case 'offline':
        return '离线模式';
    }
  }

  getQualityHistory(): NetworkQuality[] {
    return [...this.qualityHistory];
  }

  getAverageQualityScore(): number {
    const avg = this.getAverageQuality();
    if (avg.packetLoss > 0.5) return 0;
    if (avg.rtt > 3000) return 25;
    if (avg.rtt > 1500) return 50;
    if (avg.rtt > 500) return 75;
    return 100;
  }

  async preloadCriticalData(): Promise<void> {
    if (!this.shouldPrefetch()) return;

    const criticalPaths = ['/api/v1/knowledge/stats', '/api/v1/chat/recommendations'];

    try {
      const cache = await caches.open('critical-data-v1');
      await Promise.all(
        criticalPaths.map(async (path) => {
          try {
            const response = await fetch(path);
            if (response.ok) {
              await cache.put(path, response);
            }
          } catch (e) {
            console.warn(`Failed to preload ${path}:`, e);
          }
        })
      );
    } catch (e) {
      console.warn('Failed to access cache:', e);
    }
  }

  async getCachedData(path: string): Promise<Response | null> {
    try {
      const cache = await caches.open('critical-data-v1');
      const response = await cache.match(path);
      return response || null;
    } catch (e) {
      return null;
    }
  }

  forceLevel(level: StrategyLevel): void {
    if (level !== this.currentLevel) {
      this.previousLevel = this.currentLevel;
      this.currentLevel = level;
      this.notifyListeners();
    }
  }

  reset(): void {
    this.qualityHistory = [];
    this.lastCheckTime = 0;
    this.previousLevel = this.currentLevel;
    this.currentLevel = 'full';
  }
}

const degradationStrategy = new DegradationStrategy();

export default degradationStrategy;
export type { StrategyLevel, NetworkQuality, FeatureConfig, StrategyChangeCallback };
