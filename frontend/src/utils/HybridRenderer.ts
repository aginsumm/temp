/**
 * 混合渲染器
 * 支持在 ECharts 2D 渲染和 WebGL 3D 渲染之间无缝切换
 * 根据图谱规模和性能自动选择最佳渲染方式
 */

import * as echarts from 'echarts';
import type { GraphData } from '../api/knowledge';
import { WebGLGraphRenderer } from './WebGLGraphRenderer';
import { graphOptimizer } from './graphOptimizer';

/**
 * 渲染器类型
 */
export type RendererType = 'echarts' | 'webgl';

/**
 * 混合渲染器配置
 */
export interface HybridRendererConfig {
  // 自动切换阈值
  autoSwitchThreshold: number; // 节点数量超过此值自动切换到 WebGL
  // 是否启用自动切换
  enableAutoSwitch: boolean;
  // WebGL 配置
  webglConfig: {
    enableShadows: boolean;
    enableLighting: boolean;
    enableAnimations: boolean;
    quality: 'low' | 'medium' | 'high' | 'ultra';
  };
  // ECharts 配置
  echartsConfig: {
    layout: 'force' | 'circular' | 'hierarchical' | 'radial' | 'grid';
    showLabels: boolean;
    showEdges: boolean;
  };
}

/**
 * 混合渲染器
 */
export class HybridRenderer {
  private container: HTMLElement;
  private currentRenderer: RendererType = 'echarts';

  // ECharts 实例
  private echartsInstance: echarts.ECharts | null = null;

  // WebGL 渲染器
  private webglRenderer: WebGLGraphRenderer | null = null;

  // 当前图谱数据
  private currentGraphData: GraphData | null = null;

  // 配置
  private config: HybridRendererConfig = {
    autoSwitchThreshold: 500,
    enableAutoSwitch: true,
    webglConfig: {
      enableShadows: true,
      enableLighting: true,
      enableAnimations: true,
      quality: 'high',
    },
    echartsConfig: {
      layout: 'force',
      showLabels: true,
      showEdges: true,
    },
  };

  // 回调
  private onRendererChange?: (type: RendererType) => void;
  private onNodeClick?: (nodeId: string) => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * 初始化渲染器
   */
  public init(): void {
    // 初始化 ECharts
    this.echartsInstance = echarts.init(this.container);
  }

  /**
   * 渲染图谱数据
   */
  public render(graphData: GraphData): void {
    this.currentGraphData = graphData;

    // 优化图谱数据
    const result = graphOptimizer.optimize(graphData);
    const optimizedData = result.optimizedData;

    // 自动选择渲染器
    if (this.config.enableAutoSwitch) {
      this.autoSelectRenderer(optimizedData.nodes.length);
    }

    // 使用选定的渲染器渲染
    if (this.currentRenderer === 'echarts') {
      this.renderWithECharts(optimizedData);
    } else {
      this.renderWithWebGL(optimizedData);
    }
  }

  /**
   * 自动选择渲染器
   */
  private autoSelectRenderer(nodeCount: number): void {
    const targetRenderer: RendererType =
      nodeCount > this.config.autoSwitchThreshold ? 'webgl' : 'echarts';

    if (targetRenderer !== this.currentRenderer) {
      this.switchRenderer(targetRenderer);
    }
  }

  /**
   * 切换渲染器
   */
  public switchRenderer(type: RendererType): void {
    if (type === this.currentRenderer) return;

    // 销毁当前渲染器
    this.destroyCurrentRenderer();

    // 切换到新渲染器
    this.currentRenderer = type;

    // 初始化新渲染器
    if (type === 'echarts') {
      this.echartsInstance = echarts.init(this.container);
    } else {
      this.webglRenderer = new WebGLGraphRenderer(this.container);
    }

    // 如果有数据，重新渲染
    if (this.currentGraphData) {
      this.render(this.currentGraphData);
    }

    // 触发回调
    this.onRendererChange?.(type);
  }

  /**
   * 使用 ECharts 渲染
   */
  private renderWithECharts(graphData: GraphData): void {
    if (!this.echartsInstance) return;

    const { layout, showLabels, showEdges } = this.config.echartsConfig;

    const option = {
      tooltip: {
        trigger: 'item',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            return `${params.name}<br/>类型：${params.data.category || '未知'}`;
          }
          return `${params.data.source} → ${params.data.target}`;
        },
      },
      legend: [
        {
          data: graphData.categories?.map((c) => c.name) || [],
          orient: 'vertical',
          right: 10,
          top: 10,
        },
      ],
      series: [
        {
          type: 'graph',
          layout,
          data: graphData.nodes.map((node) => ({
            ...node,
            symbolSize: node.value ? node.value * 20 : 10,
            label: {
              show: showLabels,
              position: 'right',
            },
          })),
          links: showEdges
            ? graphData.edges.map((edge) => ({
                source: edge.source,
                target: edge.target,
                value: edge.relationType,
              }))
            : [],
          roam: true,
          label: {
            show: showLabels,
            position: 'right',
          },
          lineStyle: {
            color: 'source',
            curveness: 0.3,
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              width: 4,
            },
          },
        },
      ],
    };

    this.echartsInstance.setOption(option, true);

    // 绑定点击事件
    this.echartsInstance.off('click');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.echartsInstance.on('click', (params: any) => {
      if (params.dataType === 'node' && params.data?.id) {
        this.onNodeClick?.(params.data.id);
      }
    });
  }

  /**
   * 使用 WebGL 渲染
   */
  private renderWithWebGL(graphData: GraphData): void {
    if (!this.webglRenderer) return;

    // 更新 WebGL 配置
    this.webglRenderer.updateConfig({
      enableShadows: this.config.webglConfig.enableShadows,
      enableLighting: this.config.webglConfig.enableLighting,
      enableAnimations: this.config.webglConfig.enableAnimations,
      quality: this.config.webglConfig.quality,
    });

    // 渲染
    this.webglRenderer.render(graphData);

    // 绑定点击事件
    this.webglRenderer.setOnNodeClick((nodeId) => {
      this.onNodeClick?.(nodeId);
    });
  }

  /**
   * 销毁当前渲染器
   */
  private destroyCurrentRenderer(): void {
    if (this.currentRenderer === 'echarts' && this.echartsInstance) {
      this.echartsInstance.dispose();
      this.echartsInstance = null;
    } else if (this.currentRenderer === 'webgl' && this.webglRenderer) {
      this.webglRenderer.dispose();
      this.webglRenderer = null;
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<HybridRendererConfig>): void {
    this.config = { ...this.config, ...config };

    // 如果配置发生变化，重新渲染
    if (this.currentGraphData) {
      this.render(this.currentGraphData);
    }
  }

  /**
   * 获取当前渲染器类型
   */
  public getCurrentRenderer(): RendererType {
    return this.currentRenderer;
  }

  /**
   * 设置渲染器切换回调
   */
  public setOnRendererChange(callback: (type: RendererType) => void): void {
    this.onRendererChange = callback;
  }

  /**
   * 设置节点点击回调
   */
  public setOnNodeClick(callback: (nodeId: string) => void): void {
    this.onNodeClick = callback;
  }

  /**
   * 调整大小
   */
  public resize(): void {
    if (this.currentRenderer === 'echarts' && this.echartsInstance) {
      this.echartsInstance.resize();
    }
    // WebGL 渲染器会自动处理 resize
  }

  /**
   * 销毁渲染器
   */
  public dispose(): void {
    this.destroyCurrentRenderer();
  }
}

export default HybridRenderer;
