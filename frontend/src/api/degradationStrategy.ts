interface NetworkQuality {
  rtt: number;
  throughput: number;
  packetLoss: number;
}

type StrategyLevel = 'full' | 'reduced' | 'minimal' | 'offline';

class DegradationStrategy {
  private currentLevel: StrategyLevel = 'full';

  async measureNetworkQuality(): Promise<NetworkQuality> {
    const start = performance.now();

    try {
      await fetch('/api/v1/health', {
        method: 'HEAD',
        cache: 'no-cache',
      });

      const rtt = performance.now() - start;

      return {
        rtt,
        throughput: 1000000 / rtt,
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

  async updateStrategy() {
    const quality = await this.measureNetworkQuality();

    if (quality.rtt > 5000 || quality.throughput < 1000) {
      this.currentLevel = 'offline';
    } else if (quality.rtt > 2000 || quality.throughput < 10000) {
      this.currentLevel = 'minimal';
    } else if (quality.rtt > 1000 || quality.throughput < 100000) {
      this.currentLevel = 'reduced';
    } else {
      this.currentLevel = 'full';
    }

    console.log(`Current strategy level: ${this.currentLevel}`);
  }

  getCurrentLevel(): StrategyLevel {
    return this.currentLevel;
  }

  shouldUseMock(): boolean {
    return this.currentLevel === 'offline';
  }

  shouldStream(): boolean {
    return this.currentLevel === 'full';
  }

  shouldCache(): boolean {
    return this.currentLevel !== 'full';
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
}

export default new DegradationStrategy();
