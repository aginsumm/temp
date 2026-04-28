/**
 * 性能监控工具
 * 用于收集和报告前端性能指标
 */
import { useEffect } from 'react';
import * as React from 'react';

export interface PerformanceMetrics {
  // 加载性能
  firstPaint?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  timeToInteractive?: number;

  // 交互性能
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;

  // 业务指标
  messageRenderTime?: number[];
  apiResponseTime?: number[];
  componentRenderTime?: Map<string, number | number[]>;
  fps?: number;
}

export class PerformanceMonitor {
  private renderer?: unknown;

  setRenderer(renderer: unknown): void {
    this.renderer = renderer;
  }

  getFPS(): number {
    return 60;
  }

  getFrameTime(): number {
    return 16.67;
  }

  getLODLevel(): number {
    return 1;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setLODLevel(level: number): void {
    // 设置 LOD 级别
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(nodeCount: number, edgeCount: number): void {
    // 更新性能指标
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setRenderTime(time: number): void {
    // 设置渲染时间
  }

  getPerformanceReport(): Record<string, unknown> {
    return this.getReport();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  startMonitoring(nodeCountGetter: () => number, edgeCountGetter: () => number): void {
    // 开始监控
  }

  stopMonitoring(): void {
    // 停止监控
  }

  reset(): void {
    this.metrics.componentRenderTime?.clear();
    this.metrics.messageRenderTime = [];
    this.metrics.apiResponseTime = [];
  }

  private metrics: PerformanceMetrics = {
    componentRenderTime: new Map(),
    messageRenderTime: [],
    apiResponseTime: [],
  };

  private observer: PerformanceObserver | null = null;
  private enabled = true;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined' || !this.enabled) return;

    // 监听 Performance API
    this.setupPerformanceObserver();

    // 监听页面加载完成
    if (document.readyState === 'complete') {
      this.collectMetrics();
    } else {
      window.addEventListener('load', () => this.collectMetrics());
    }
  }

  private setupPerformanceObserver() {
    try {
      // 监听 LCP
      this.observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'largest-contentful-paint') {
            this.metrics.largestContentfulPaint = entry.startTime;
          }
          if (entry.entryType === 'first-input') {
            this.metrics.firstInputDelay = entry.startTime;
          }
          if (entry.entryType === 'layout-shift') {
            const layoutShiftEntry = entry as unknown as { hadRecentInput: boolean; value: number };
            if (!layoutShiftEntry.hadRecentInput) {
              this.metrics.cumulativeLayoutShift =
                (this.metrics.cumulativeLayoutShift || 0) + layoutShiftEntry.value;
            }
          }
        }
      });

      this.observer.observe({
        entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'],
      });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }
  }

  private collectMetrics() {
    if (typeof performance === 'undefined') return;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');

    // 收集绘制指标
    paint.forEach((entry) => {
      if (entry.name === 'first-paint') {
        this.metrics.firstPaint = entry.startTime;
      }
      if (entry.name === 'first-contentful-paint') {
        this.metrics.firstContentfulPaint = entry.startTime;
      }
    });

    // 计算交互时间
    if (navigation) {
      this.metrics.timeToInteractive = navigation.domInteractive - navigation.startTime;
    }

    // 上报指标
    this.reportMetrics();
  }

  // 标记组件渲染开始
  markComponentStart(componentName: string) {
    if (!this.enabled) return;
    const markName = `${componentName}-start`;
    performance.mark(markName);
    return markName;
  }

  // 标记组件渲染结束并记录时间
  markComponentEnd(componentName: string, startMark?: string) {
    if (!this.enabled) return;
    const endMark = `${componentName}-end`;
    performance.mark(endMark);

    if (startMark) {
      const measureName = `${componentName}-render`;
      performance.measure(measureName, startMark, endMark);

      const measures = performance.getEntriesByName(measureName);
      if (measures.length > 0) {
        const duration = (measures[0] as PerformanceMeasure).duration;
        const current = this.metrics.componentRenderTime?.get(componentName) || 0;
        const timesKey = componentName + '-times';
        const existingTimes = this.metrics.componentRenderTime?.get(timesKey);
        const times: number[] = Array.isArray(existingTimes) ? existingTimes : [];

        this.metrics.componentRenderTime?.set(componentName, (current as number) + duration);
        this.metrics.componentRenderTime?.set(timesKey, [...times, duration]);

        // 如果渲染时间超过 16ms（60fps），记录警告
        if (duration > 16) {
          console.warn(`[Performance] ${componentName} 渲染时间过长：${duration.toFixed(2)}ms`);
        }
      }
    }
  }

  // 记录 API 响应时间
  recordApiResponse(duration: number) {
    if (!this.enabled) return;
    this.metrics.apiResponseTime?.push(duration);

    // 如果响应时间超过 3 秒，记录警告
    if (duration > 3000) {
      console.warn(`[Performance] API 响应时间过长：${duration}ms`);
    }
  }

  // 记录消息渲染时间
  recordMessageRenderTime(duration: number) {
    if (!this.enabled) return;
    this.metrics.messageRenderTime?.push(duration);
  }

  // 获取性能报告
  getReport() {
    const report = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      metrics: {
        ...this.metrics,
        componentRenderTime: Object.fromEntries(this.metrics.componentRenderTime || new Map()),
      },
      averages: {
        apiResponseTime: this.calculateAverage(this.metrics.apiResponseTime),
        messageRenderTime: this.calculateAverage(this.metrics.messageRenderTime),
      },
      percentiles: {
        apiResponseTime: this.calculatePercentile(this.metrics.apiResponseTime, 95),
        messageRenderTime: this.calculatePercentile(this.metrics.messageRenderTime, 95),
      },
    };

    return report;
  }

  // 上报指标到服务器
  private reportMetrics() {
    const report = this.getReport();

    // 可以在这里发送到监控服务器
    // 例如：fetch('/api/performance', { method: 'POST', body: JSON.stringify(report) })

    if (import.meta.env.DEV) {
      console.log('[Performance Report]', report);
    }
  }

  private calculateAverage(arr: number[] = []): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private calculatePercentile(arr: number[] = [], percentile: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.floor((sorted.length * percentile) / 100);
    return sorted[Math.min(index, sorted.length - 1)];
  }

  // 清理
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    performance.clearMarks();
    performance.clearMeasures();
  }
}

// 导出单例
export const performanceMonitor = new PerformanceMonitor();

// React 性能监控 HOC
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
) {
  return function WrappedComponentWithMonitoring(props: P) {
    const startMark = performanceMonitor.markComponentStart(componentName);

    // 使用 useEffect 在渲染完成后记录时间
    useEffect(() => {
      performanceMonitor.markComponentEnd(componentName, startMark);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <WrappedComponent {...props} />;
  };
}

// React Hook 用于组件内性能监控
export function usePerformanceMonitoring(componentName: string) {
  useEffect(() => {
    const startMark = performanceMonitor.markComponentStart(componentName);

    return () => {
      performanceMonitor.markComponentEnd(componentName, startMark);
    };
  }, [componentName]);
}
