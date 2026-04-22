/**
 * 性能监控器 - 实时监控 FPS 并自动调整 LOD
 */

import type { LayeredGraphRenderer } from './LayeredGraphRenderer';

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  nodeCount: number;
  edgeCount: number;
  renderTime: number;
  memoryUsage?: number;
  lodLevel: number;
  timestamp: number;
}

/**
 * 性能阈值配置
 */
export interface PerformanceThresholds {
  targetFPS: number; // 目标 FPS
  minFPS: number; // 最低可接受 FPS
  maxFPS: number; // 最高 FPS（用于提升 LOD）
  adjustmentCooldown: number; // LOD 调整冷却时间（毫秒）
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  targetFPS: 60,
  minFPS: 30,
  maxFPS: 55,
  adjustmentCooldown: 1000,
};

/**
 * 性能监控回调
 */
export interface PerformanceCallbacks {
  onFPSChange?: (fps: number) => void;
  onLODAdjust?: (lodLevel: number, reason: string) => void;
  onPerformanceWarning?: (metrics: PerformanceMetrics) => void;
  onPerformanceCritical?: (metrics: PerformanceMetrics) => void;
}

/**
 * 性能监控器类
 */
export class PerformanceMonitor {
  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private fps: number = 0;
  private frameTime: number = 0;
  private renderTime: number = 0;
  private lodLevel: number = 2;
  private lastAdjustmentTime: number = 0;
  private thresholds: PerformanceThresholds;
  private callbacks: PerformanceCallbacks = {};
  private renderer: LayeredGraphRenderer | null = null;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistoryLength: number = 60; // 保留 60 帧历史
  private isMonitoring: boolean = false;
  private animationFrameId: number | null = null;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * 设置渲染器（用于自动 LOD 调整）
   */
  setRenderer(renderer: LayeredGraphRenderer): void {
    this.renderer = renderer;
  }

  /**
   * 设置回调
   */
  setCallbacks(callbacks: PerformanceCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 更新配置
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * 更新帧计数
   */
  update(nodeCount?: number, edgeCount?: number): void {
    this.frameCount++;
    const now = performance.now();
    const delta = now - this.lastTime;

    if (delta >= 1000) {
      // 计算 FPS
      this.fps = Math.round((this.frameCount * 1000) / delta);
      this.frameTime = delta / this.frameCount;

      // 创建性能指标
      const metrics: PerformanceMetrics = {
        fps: this.fps,
        frameTime: this.frameTime,
        nodeCount: nodeCount || 0,
        edgeCount: edgeCount || 0,
        renderTime: this.renderTime,
        lodLevel: this.lodLevel,
        timestamp: now,
      };

      // 记录历史
      this.recordMetrics(metrics);

      // 自动调整 LOD
      this.autoAdjustLOD();

      // 回调
      this.callbacks.onFPSChange?.(this.fps);

      // 重置计数器
      this.frameCount = 0;
      this.lastTime = now;
    }
  }

  /**
   * 设置渲染时间
   */
  setRenderTime(renderTime: number): void {
    this.renderTime = renderTime;
  }

  /**
   * 设置 LOD 级别
   */
  setLODLevel(lodLevel: number): void {
    this.lodLevel = lodLevel;
  }

  /**
   * 获取当前 LOD 级别
   */
  getLODLevel(): number {
    return this.lodLevel;
  }

  /**
   * 获取当前 FPS
   */
  getFPS(): number {
    return this.fps;
  }

  /**
   * 获取当前帧时间
   */
  getFrameTime(): number {
    return this.frameTime;
  }

  /**
   * 记录性能指标
   */
  private recordMetrics(metrics: PerformanceMetrics): void {
    this.metricsHistory.push(metrics);

    // 限制历史记录长度
    if (this.metricsHistory.length > this.maxHistoryLength) {
      this.metricsHistory.shift();
    }

    // 检查性能问题
    this.checkPerformance(metrics);
  }

  /**
   * 检查性能问题
   */
  private checkPerformance(metrics: PerformanceMetrics): void {
    if (metrics.fps < this.thresholds.minFPS * 0.5) {
      // 严重性能问题
      this.callbacks.onPerformanceCritical?.(metrics);
    } else if (metrics.fps < this.thresholds.minFPS) {
      // 性能警告
      this.callbacks.onPerformanceWarning?.(metrics);
    }
  }

  /**
   * 自动调整 LOD
   */
  private autoAdjustLOD(): void {
    const now = performance.now();

    // 检查冷却时间
    if (now - this.lastAdjustmentTime < this.thresholds.adjustmentCooldown) {
      return;
    }

    if (!this.renderer) return;

    let newLOD = this.lodLevel;
    let reason = '';

    // FPS 过低，降低 LOD
    if (this.fps < this.thresholds.minFPS) {
      newLOD = Math.min(4, this.lodLevel + 1);
      reason = `FPS too low (${this.fps})`;
    }
    // FPS 过高，提升 LOD
    else if (this.fps > this.thresholds.maxFPS && this.lodLevel > 0) {
      newLOD = Math.max(0, this.lodLevel - 1);
      reason = `FPS high (${this.fps})`;
    }

    // LOD 发生变化
    if (newLOD !== this.lodLevel) {
      this.lodLevel = newLOD;
      this.lastAdjustmentTime = now;

      this.callbacks.onLODAdjust?.(newLOD, reason);

      console.log(`[PerformanceMonitor] LOD adjusted to ${newLOD}: ${reason}`);
    }
  }

  /**
   * 获取平均 FPS（基于历史记录）
   */
  getAverageFPS(samples: number = 30): number {
    if (this.metricsHistory.length === 0) return 0;

    const recentMetrics = this.metricsHistory.slice(-samples);
    const sum = recentMetrics.reduce((acc, m) => acc + m.fps, 0);
    return Math.round(sum / recentMetrics.length);
  }

  /**
   * 获取平均帧时间
   */
  getAverageFrameTime(samples: number = 30): number {
    if (this.metricsHistory.length === 0) return 0;

    const recentMetrics = this.metricsHistory.slice(-samples);
    const sum = recentMetrics.reduce((acc, m) => acc + m.frameTime, 0);
    return sum / recentMetrics.length;
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    currentFPS: number;
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    averageFrameTime: number;
    averageNodeCount: number;
    averageEdgeCount: number;
    lodAdjustmentCount: number;
  } {
    if (this.metricsHistory.length === 0) {
      return {
        currentFPS: this.fps,
        averageFPS: 0,
        minFPS: 0,
        maxFPS: 0,
        averageFrameTime: 0,
        averageNodeCount: 0,
        averageEdgeCount: 0,
        lodAdjustmentCount: 0,
      };
    }

    const fpss = this.metricsHistory.map((m) => m.fps);
    const frameTimes = this.metricsHistory.map((m) => m.frameTime);
    const nodeCounts = this.metricsHistory.map((m) => m.nodeCount);
    const edgeCounts = this.metricsHistory.map((m) => m.edgeCount);

    return {
      currentFPS: this.fps,
      averageFPS: Math.round(
        fpss.reduce((a, b) => a + b, 0) / fpss.length
      ),
      minFPS: Math.min(...fpss),
      maxFPS: Math.max(...fpss),
      averageFrameTime: frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length,
      averageNodeCount: Math.round(
        nodeCounts.reduce((a, b) => a + b, 0) / nodeCounts.length
      ),
      averageEdgeCount: Math.round(
        edgeCounts.reduce((a, b) => a + b, 0) / edgeCounts.length
      ),
      lodAdjustmentCount: this.metricsHistory.filter(
        (m, i) => i > 0 && m.lodLevel !== this.metricsHistory[i - 1].lodLevel
      ).length,
    };
  }

  /**
   * 开始监控（使用 requestAnimationFrame）
   */
  startMonitoring(nodeCountGetter?: () => number, edgeCountGetter?: () => number): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    const monitorLoop = () => {
      if (!this.isMonitoring) return;

      const nodeCount = nodeCountGetter?.() || 0;
      const edgeCount = edgeCountGetter?.() || 0;

      this.update(nodeCount, edgeCount);
      this.animationFrameId = requestAnimationFrame(monitorLoop);
    };

    this.animationFrameId = requestAnimationFrame(monitorLoop);
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 导出性能数据
   */
  exportMetrics(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.metricsHistory = [];
  }

  /**
   * 重置
   */
  reset(): void {
    this.stopMonitoring();
    this.frameCount = 0;
    this.fps = 0;
    this.frameTime = 0;
    this.renderTime = 0;
    this.lodLevel = 2;
    this.lastAdjustmentTime = 0;
    this.clearHistory();
  }
}

/**
 * 创建单例实例
 */
export const performanceMonitor = new PerformanceMonitor();

export default PerformanceMonitor;
