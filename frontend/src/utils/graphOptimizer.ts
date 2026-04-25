/**
 * 图谱性能优化器 - 整合所有性能优化功能
 * 提供统一的优化接口
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import type { GraphData } from '../api/knowledge';
import { LayeredGraphRenderer, layeredGraphRenderer } from './LayeredGraphRenderer';
import { ViewportCulling, viewportCulling } from './ViewportCulling';
import { ProgressiveLoader, progressiveLoader } from './ProgressiveLoader';
import { PerformanceMonitor, performanceMonitor, PerformanceMetrics } from './PerformanceMonitor';
/* eslint-enable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * 优化配置
 */
export interface GraphOptimizerConfig {
  enableLOD: boolean; // 启用 LOD
  enableViewportCulling: boolean; // 启用视口裁剪
  enableProgressiveLoading: boolean; // 启用渐进式加载
  enablePerformanceMonitoring: boolean; // 启用性能监控
  autoAdjustLOD: boolean; // 自动调整 LOD
  maxVisibleNodes: number; // 最大可见节点数
  chunkSize: number; // 渐进式加载的 chunk 大小
  cullingMargin: number; // 视口裁剪边距
}

const DEFAULT_CONFIG: GraphOptimizerConfig = {
  enableLOD: true,
  enableViewportCulling: true,
  enableProgressiveLoading: true,
  enablePerformanceMonitoring: true,
  autoAdjustLOD: true,
  maxVisibleNodes: 1000,
  chunkSize: 100,
  cullingMargin: 200,
};

/**
 * 优化结果
 */
export interface OptimizationResult {
  optimizedData: GraphData;
  originalNodeCount: number;
  optimizedNodeCount: number;
  originalEdgeCount: number;
  optimizedEdgeCount: number;
  lodLevel: number;
  cullingApplied: boolean;
  optimizationTime: number;
}

/**
 * 图谱性能优化器类
 */
export class GraphOptimizer {
  private config: GraphOptimizerConfig;
  private renderer: LayeredGraphRenderer;
  private culling: ViewportCulling;
  private loader: ProgressiveLoader;
  private monitor: PerformanceMonitor;
  private currentZoomLevel: number = 1;
  private viewportSize: { width: number; height: number } = {
    width: 800,
    height: 600,
  };

  constructor(config?: Partial<GraphOptimizerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 初始化各个优化组件
    this.renderer = new LayeredGraphRenderer();
    this.culling = new ViewportCulling(this.config.cullingMargin);
    this.loader = new ProgressiveLoader({
      chunkSize: this.config.chunkSize,
    });
    this.monitor = new PerformanceMonitor();

    // 如果启用自动 LOD 调整，设置渲染器
    if (this.config.autoAdjustLOD) {
      this.monitor.setRenderer(this.renderer);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<GraphOptimizerConfig>): void {
    this.config = { ...this.config, ...config };

    // 更新组件配置
    this.culling.setMargin(this.config.cullingMargin);
    this.loader.updateConfig({ chunkSize: this.config.chunkSize });
  }

  /**
   * 更新视口
   */
  updateViewport(
    width: number,
    height: number,
    zoom?: number,
    centerX?: number,
    centerY?: number
  ): void {
    this.viewportSize.width = width;
    this.viewportSize.height = height;

    if (zoom !== undefined) {
      this.currentZoomLevel = zoom;
      this.culling.updateViewportZoom(zoom);
    }

    if (centerX !== undefined && centerY !== undefined) {
      this.culling.updateViewportCenter(centerX, centerY);
    }

    this.culling.updateViewportSize(width, height);
  }

  /**
   * 优化图谱数据
   */
  optimize(graphData: GraphData): OptimizationResult {
    const startTime = performance.now();
    const originalNodeCount = graphData.nodes.length;
    const originalEdgeCount = graphData.edges.length;

    let optimizedData = graphData;

    // 1. LOD 优化
    if (this.config.enableLOD) {
      optimizedData = this.renderer.optimizeGraphData(optimizedData, this.currentZoomLevel);
    }

    // 2. 视口裁剪
    if (this.config.enableViewportCulling) {
      optimizedData = this.culling.lazyCulling(optimizedData, this.config.maxVisibleNodes);
    }

    const endTime = performance.now();
    const optimizationTime = endTime - startTime;

    const result: OptimizationResult = {
      optimizedData,
      originalNodeCount,
      optimizedNodeCount: optimizedData.nodes.length,
      originalEdgeCount,
      optimizedEdgeCount: optimizedData.edges.length,
      lodLevel: this.renderer.getCurrentLODLevel(),
      cullingApplied: this.config.enableViewportCulling,
      optimizationTime,
    };

    // 更新性能监控
    if (this.config.enablePerformanceMonitoring) {
      this.monitor.update(result.optimizedNodeCount, result.optimizedEdgeCount);
      this.monitor.setRenderTime(optimizationTime);
    }

    return result;
  }

  /**
   * 渐进式加载图谱
   */
  async loadProgressively(
    graphData: GraphData,
    callbacks?: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChunkLoaded?: (data: GraphData, progress: any) => void;
      onComplete?: (data: GraphData) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<GraphData> {
    if (!this.config.enableProgressiveLoading) {
      callbacks?.onComplete?.(graphData);
      return graphData;
    }

    return this.loader.load(graphData, {
      onChunkLoaded: callbacks?.onChunkLoaded,
      onProgress: (progress) => {
        // 更新性能监控
        if (this.config.enablePerformanceMonitoring) {
          this.monitor.update(progress.loadedNodes, progress.loadedEdges);
        }
      },
      onComplete: callbacks?.onComplete,
      onError: callbacks?.onError,
    });
  }

  /**
   * 快速加载（只加载重要节点）
   */
  async loadQuick(graphData: GraphData, maxNodes: number = 500): Promise<GraphData> {
    return this.loader.loadQuick(graphData, maxNodes);
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics | null {
    if (!this.config.enablePerformanceMonitoring) {
      return null;
    }

    return {
      fps: this.monitor.getFPS(),
      frameTime: this.monitor.getFrameTime(),
      nodeCount: 0,
      edgeCount: 0,
      renderTime: 0,
      lodLevel: this.monitor.getLODLevel(),
      timestamp: performance.now(),
    };
  }

  /**
   * 获取性能报告
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPerformanceReport(): any {
    if (!this.config.enablePerformanceMonitoring) {
      return null;
    }

    return this.monitor.getPerformanceReport();
  }

  /**
   * 获取优化统计
   */
  getOptimizationStats(result: OptimizationResult): {
    nodeReductionRate: number;
    edgeReductionRate: number;
    performanceGain: string;
  } {
    const nodeReductionRate =
      result.originalNodeCount > 0
        ? (result.originalNodeCount - result.optimizedNodeCount) / result.originalNodeCount
        : 0;

    const edgeReductionRate =
      result.originalEdgeCount > 0
        ? (result.originalEdgeCount - result.optimizedEdgeCount) / result.originalEdgeCount
        : 0;

    return {
      nodeReductionRate,
      edgeReductionRate,
      performanceGain: `${(nodeReductionRate * 100).toFixed(1)}% 节点优化`,
    };
  }

  /**
   * 开始性能监控
   */
  startMonitoring(nodeCountGetter?: () => number, edgeCountGetter?: () => number): void {
    if (this.config.enablePerformanceMonitoring) {
      this.monitor.startMonitoring(nodeCountGetter, edgeCountGetter);
    }
  }

  /**
   * 停止性能监控
   */
  stopMonitoring(): void {
    this.monitor.stopMonitoring();
  }

  /**
   * 获取当前 LOD 级别
   */
  getCurrentLODLevel(): number {
    return this.renderer.getCurrentLODLevel();
  }

  /**
   * 手动设置 LOD 级别
   */
  setLODLevel(lodLevel: number): void {
    this.monitor.setLODLevel(lodLevel);
  }

  /**
   * 重置
   */
  reset(): void {
    this.monitor.reset();
    this.culling.clearCache();
    this.loader.reset();
  }

  /**
   * 销毁
   */
  dispose(): void {
    this.stopMonitoring();
    this.renderer.dispose();
    this.culling.dispose();
    this.loader.reset();
  }
}

/**
 * 创建单例实例
 */
export const graphOptimizer = new GraphOptimizer();

export default GraphOptimizer;
