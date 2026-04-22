/**
 * 分层渲染器 - 基于 LOD 的分层图谱渲染
 * 支持根据缩放级别自动调整渲染质量
 */

import type { GraphData, GraphNode, GraphEdge } from '../api/knowledge';

/**
 * 渲染层类型
 */
export type LayerType = 'nodes' | 'edges' | 'labels' | 'highlights';

/**
 * 渲染层接口
 */
export interface RenderLayer {
  id: string;
  type: LayerType;
  priority: number; // 渲染优先级（数字越小优先级越高）
  visible: boolean;
  lodLevel: number; // LOD 级别（0-4）
}

/**
 * LOD 配置
 */
export interface LODConfig {
  zoomThreshold: number;
  nodeImportanceThreshold: number;
  edgeWeightThreshold: number;
  showLabels: boolean;
  showEdges: boolean;
  renderQuality: 'ultra' | 'high' | 'medium' | 'low' | 'ultra-low';
}

/**
 * LOD 级别配置表
 */
const LOD_CONFIGS: Record<number, LODConfig> = {
  0: {
    // LOD 0: 超高清（zoom > 2.0）
    zoomThreshold: 2.0,
    nodeImportanceThreshold: 0,
    edgeWeightThreshold: 0,
    showLabels: true,
    showEdges: true,
    renderQuality: 'ultra',
  },
  1: {
    // LOD 1: 高清（zoom > 1.5）
    zoomThreshold: 1.5,
    nodeImportanceThreshold: 0,
    edgeWeightThreshold: 0.3,
    showLabels: true,
    showEdges: true,
    renderQuality: 'high',
  },
  2: {
    // LOD 2: 标准（zoom > 1.0）
    zoomThreshold: 1.0,
    nodeImportanceThreshold: 0.3,
    edgeWeightThreshold: 0.5,
    showLabels: true,
    showEdges: true,
    renderQuality: 'medium',
  },
  3: {
    // LOD 3: 低清（zoom > 0.5）
    zoomThreshold: 0.5,
    nodeImportanceThreshold: 0.6,
    edgeWeightThreshold: 0.7,
    showLabels: false,
    showEdges: false,
    renderQuality: 'low',
  },
  4: {
    // LOD 4: 超低清（zoom <= 0.5）
    zoomThreshold: 0,
    nodeImportanceThreshold: 0.9,
    edgeWeightThreshold: 1,
    showLabels: false,
    showEdges: false,
    renderQuality: 'ultra-low',
  },
};

/**
 * 分层渲染器类
 */
export class LayeredGraphRenderer {
  private layers: Map<string, RenderLayer> = new Map();
  private currentLODLevel: number = 2;
  private currentZoomLevel: number = 1.0;

  constructor() {
    // 初始化默认层
    this.initDefaultLayers();
  }

  /**
   * 初始化默认层
   */
  private initDefaultLayers(): void {
    // 节点层
    this.addLayer({
      id: 'nodes-base',
      type: 'nodes',
      priority: 1,
      visible: true,
      lodLevel: 4,
    });

    // 边层
    this.addLayer({
      id: 'edges-base',
      type: 'edges',
      priority: 2,
      visible: true,
      lodLevel: 3,
    });

    // 标签层
    this.addLayer({
      id: 'labels',
      type: 'labels',
      priority: 3,
      visible: true,
      lodLevel: 2,
    });

    // 高亮层
    this.addLayer({
      id: 'highlights',
      type: 'highlights',
      priority: 0,
      visible: true,
      lodLevel: 0,
    });
  }

  /**
   * 添加渲染层
   */
  addLayer(layer: RenderLayer): void {
    this.layers.set(layer.id, layer);
  }

  /**
   * 移除渲染层
   */
  removeLayer(layerId: string): void {
    this.layers.delete(layerId);
  }

  /**
   * 设置层的可见性
   */
  setLayerVisibility(layerId: string, visible: boolean): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.visible = visible;
    }
  }

  /**
   * 计算 LOD 级别
   */
  calculateLOD(zoomLevel: number): number {
    if (zoomLevel > 2.0) return 0;
    if (zoomLevel > 1.5) return 1;
    if (zoomLevel > 1.0) return 2;
    if (zoomLevel > 0.5) return 3;
    return 4;
  }

  /**
   * 获取 LOD 配置
   */
  getLODConfig(lodLevel: number): LODConfig {
    return LOD_CONFIGS[lodLevel] || LOD_CONFIGS[2];
  }

  /**
   * 根据 LOD 过滤节点
   */
  filterNodesByLOD(nodes: GraphNode[], lodLevel: number): GraphNode[] {
    const config = this.getLODConfig(lodLevel);

    return nodes.filter((node: GraphNode) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importance = node.value || (node.metadata as any)?.importance || 0.5;
      return importance >= config.nodeImportanceThreshold;
    });
  }

  /**
   * 根据 LOD 过滤边
   */
  filterEdgesByLOD(edges: GraphEdge[], lodLevel: number, nodeIds: Set<string>): GraphEdge[] {
    const config = this.getLODConfig(lodLevel);

    if (!config.showEdges) {
      return [];
    }

    return edges.filter((edge) => {
      // 首先检查连接的节点是否都在可见节点集合中
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        return false;
      }

      // 然后根据权重过滤
      const weight = edge.weight || edge.lineStyle?.width || 0.5;
      return weight >= config.edgeWeightThreshold;
    });
  }

  /**
   * 优化图谱数据
   */
  optimizeGraphData(data: GraphData, zoomLevel: number): GraphData {
    const lodLevel = this.calculateLOD(zoomLevel);
    this.currentLODLevel = lodLevel;
    this.currentZoomLevel = zoomLevel;

    const config = this.getLODConfig(lodLevel);

    // 过滤节点
    const filteredNodes = this.filterNodesByLOD(data.nodes, lodLevel);
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

    // 过滤边
    const filteredEdges = this.filterEdgesByLOD(data.edges, lodLevel, filteredNodeIds);

    // 处理节点样式
    const processedNodes = filteredNodes.map((node: GraphNode) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importance = node.value || (node.metadata as any)?.importance || 0.5;
      const normalizedValue = Math.max(0, Math.min(1, importance));

      return {
        ...node,
        symbolSize:
          config.renderQuality === 'ultra' || config.renderQuality === 'high'
            ? 15 + normalizedValue * 30
            : 10 + normalizedValue * 20,
        label: {
          show: config.showLabels,
          position: 'bottom' as const,
          distance: 6,
          formatter: '{b}',
          fontSize: config.renderQuality === 'ultra' ? 14 : 12,
          color: 'var(--color-text-primary)',
          fontWeight: config.renderQuality === 'ultra' ? 600 : 500,
        },
        itemStyle: {
          ...node.itemStyle,
          shadowBlur: config.renderQuality === 'ultra' ? 15 : 8,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          shadowColor: ((node.itemStyle?.color as string) || 'var(--color-primary)') as any,
        },
      };
    });

    // 处理边样式
    const processedEdges = filteredEdges.map((edge) => ({
      ...edge,
      lineStyle: {
        ...edge.lineStyle,
        width:
          config.renderQuality === 'ultra'
            ? edge.lineStyle?.width || 2
            : edge.lineStyle?.width || 1.5,
        opacity:
          config.renderQuality === 'ultra'
            ? edge.lineStyle?.opacity || 0.8
            : edge.lineStyle?.opacity || 0.5,
        curveness: config.renderQuality === 'ultra' ? edge.lineStyle?.curveness || 0.3 : 0,
      },
    }));

    return {
      nodes: processedNodes as GraphNode[],
      edges: processedEdges,
      categories: data.categories,
    };
  }

  /**
   * 获取当前 LOD 级别
   */
  getCurrentLODLevel(): number {
    return this.currentLODLevel;
  }

  /**
   * 获取当前缩放级别
   */
  getCurrentZoomLevel(): number {
    return this.currentZoomLevel;
  }

  /**
   * 获取层统计信息
   */
  getLayerStats(): {
    totalLayers: number;
    visibleLayers: number;
    layersByType: Record<LayerType, number>;
  } {
    const layersByType: Record<LayerType, number> = {
      nodes: 0,
      edges: 0,
      labels: 0,
      highlights: 0,
    };

    let visibleLayers = 0;

    this.layers.forEach((layer) => {
      layersByType[layer.type]++;
      if (layer.visible) {
        visibleLayers++;
      }
    });

    return {
      totalLayers: this.layers.size,
      visibleLayers,
      layersByType,
    };
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.layers.clear();
  }
}

/**
 * 创建单例实例
 */
export const layeredGraphRenderer = new LayeredGraphRenderer();

export default LayeredGraphRenderer;
