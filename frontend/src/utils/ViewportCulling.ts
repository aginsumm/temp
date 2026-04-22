/**
 * 视口裁剪工具 - 只渲染视口内及附近的节点
 * 大幅减少渲染压力，提升性能
 */

import type { GraphData, GraphNode } from '../api/knowledge';

/**
 * 视口接口
 */
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

/**
 * 二维向量
 */
export interface Vector2 {
  x: number;
  y: number;
}

/**
 * 节点位置缓存
 */
class NodePositionCache {
  private positions: Map<string, Vector2> = new Map();

  set(nodeId: string, position: Vector2): void {
    this.positions.set(nodeId, position);
  }

  get(nodeId: string): Vector2 | undefined {
    return this.positions.get(nodeId);
  }

  clear(): void {
    this.positions.clear();
  }

  has(nodeId: string): boolean {
    return this.positions.has(nodeId);
  }
}

/**
 * 视口裁剪器类
 */
export class ViewportCulling {
  private viewport: Viewport = {
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    zoom: 1,
  };

  private margin: number = 200; // 视口外渲染边距
  private positionCache: NodePositionCache = new NodePositionCache();

  constructor(margin?: number) {
    if (margin !== undefined) {
      this.margin = margin;
    }
  }

  /**
   * 设置视口
   */
  setViewport(viewport: Viewport): void {
    this.viewport = viewport;
  }

  /**
   * 更新视口尺寸
   */
  updateViewportSize(width: number, height: number): void {
    this.viewport.width = width;
    this.viewport.height = height;
  }

  /**
   * 更新视口中心点
   */
  updateViewportCenter(x: number, y: number): void {
    this.viewport.x = x;
    this.viewport.y = y;
  }

  /**
   * 更新视口缩放
   */
  updateViewportZoom(zoom: number): void {
    this.viewport.zoom = zoom;
  }

  /**
   * 设置裁剪边距
   */
  setMargin(margin: number): void {
    this.margin = margin;
  }

  /**
   * 获取节点位置（从缓存或图谱数据）
   */
  private getNodePosition(node: GraphNode): Vector2 {
    // 优先从缓存获取
    const cached = this.positionCache.get(node.id);
    if (cached) {
      return cached;
    }

    // 从节点数据获取
    const position = {
      x: node.x || 0,
      y: node.y || 0,
    };

    // 缓存位置
    this.positionCache.set(node.id, position);

    return position;
  }

  /**
   * 判断点是否在视口内
   */
  isInViewport(pos: Vector2, margin: number = 0): boolean {
    const { x, y, width, height, zoom } = this.viewport;

    // 计算视口边界（考虑缩放）
    const scaledMargin = margin / zoom;
    const left = x - width / 2 - scaledMargin;
    const right = x + width / 2 + scaledMargin;
    const top = y - height / 2 - scaledMargin;
    const bottom = y + height / 2 + scaledMargin;

    return pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom;
  }

  /**
   * 计算点到视口中心的距离
   */
  private distanceToViewportCenter(pos: Vector2): number {
    const { x, y } = this.viewport;
    return Math.sqrt(Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2));
  }

  /**
   * 执行视口裁剪
   */
  setCulling(graphData: GraphData): GraphData {
    const scaledMargin = this.margin / this.viewport.zoom;

    // 过滤可见节点
    const visibleNodes = graphData.nodes.filter((node: GraphNode) => {
      const pos = this.getNodePosition(node);
      return this.isInViewport(pos, scaledMargin);
    });

    // 创建可见节点 ID 集合
    const visibleNodeIds = new Set(visibleNodes.map((n: GraphNode) => n.id));

    // 过滤可见边（只保留连接可见节点的边）
    const visibleEdges = graphData.edges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );

    // 按距离排序，近的优先渲染
    visibleNodes.sort((a: GraphNode, b: GraphNode) => {
      const posA = this.getNodePosition(a);
      const posB = this.getNodePosition(b);
      return this.distanceToViewportCenter(posA) - this.distanceToViewportCenter(posB);
    });

    return {
      nodes: visibleNodes,
      edges: visibleEdges,
      categories: graphData.categories,
    };
  }

  /**
   * 懒加载裁剪 - 只加载视口内的重要节点
   */
  lazyCulling(graphData: GraphData, maxNodes: number = 500): GraphData {
    // 先执行视口裁剪
    const culledData = this.setCulling(graphData);

    // 如果节点数超过限制，进一步过滤
    if (culledData.nodes.length > maxNodes) {
      // 按重要性排序
      culledData.nodes.sort((a: GraphNode, b: GraphNode) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const importanceA = a.value || (a.metadata as any)?.importance || 0.5;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const importanceB = b.value || (b.metadata as any)?.importance || 0.5;
        return importanceB - importanceA;
      });

      // 只保留最重要的节点
      const limitedNodes = culledData.nodes.slice(0, maxNodes);
      const limitedNodeIds = new Set(limitedNodes.map((n: GraphNode) => n.id));

      // 过滤边
      const limitedEdges = culledData.edges.filter(
        (edge) => limitedNodeIds.has(edge.source) && limitedNodeIds.has(edge.target)
      );

      return {
        nodes: limitedNodes,
        edges: limitedEdges,
        categories: culledData.categories,
      };
    }

    return culledData;
  }

  /**
   * 渐进式加载 - 分批加载节点
   */
  progressiveCulling(
    graphData: GraphData,
    chunkSize: number = 100
  ): { chunks: GraphData[]; totalChunks: number } {
    // 先执行视口裁剪
    const culledData = this.setCulling(graphData);
    const nodes = culledData.nodes;
    const edges = culledData.edges;

    // 按重要性排序
    nodes.sort((a: GraphNode, b: GraphNode) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importanceA = a.value || (a.metadata as any)?.importance || 0.5;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importanceB = b.value || (b.metadata as any)?.importance || 0.5;
      return importanceB - importanceA;
    });

    // 分块
    const chunks: GraphData[] = [];
    const totalChunks = Math.ceil(nodes.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, nodes.length);
      const chunkNodes = nodes.slice(start, end);
      const chunkNodeIds = new Set(chunkNodes.map((n: GraphNode) => n.id));

      // 只保留连接 chunk 内节点的边
      const chunkEdges = edges.filter(
        (edge) => chunkNodeIds.has(edge.source) && chunkNodeIds.has(edge.target)
      );

      chunks.push({
        nodes: chunkNodes,
        edges: chunkEdges,
        categories: culledData.categories,
      });
    }

    return {
      chunks,
      totalChunks,
    };
  }

  /**
   * 更新节点位置缓存
   */
  updateNodePositions(nodes: GraphNode[]): void {
    nodes.forEach((node) => {
      if (node.x !== undefined && node.y !== undefined) {
        this.positionCache.set(node.id, { x: node.x, y: node.y });
      }
    });
  }

  /**
   * 清除位置缓存
   */
  clearCache(): void {
    this.positionCache.clear();
  }

  /**
   * 获取裁剪统计信息
   */
  getCullingStats(
    originalData: GraphData,
    culledData: GraphData
  ): {
    originalNodeCount: number;
    culledNodeCount: number;
    originalEdgeCount: number;
    culledEdgeCount: number;
    nodeReductionRate: number;
    edgeReductionRate: number;
  } {
    const originalNodeCount = originalData.nodes.length;
    const culledNodeCount = culledData.nodes.length;
    const originalEdgeCount = originalData.edges.length;
    const culledEdgeCount = culledData.edges.length;

    return {
      originalNodeCount,
      culledNodeCount,
      originalEdgeCount,
      culledEdgeCount,
      nodeReductionRate:
        originalNodeCount > 0 ? (originalNodeCount - culledNodeCount) / originalNodeCount : 0,
      edgeReductionRate:
        originalEdgeCount > 0 ? (originalEdgeCount - culledEdgeCount) / originalEdgeCount : 0,
    };
  }

  /**
   * 销毁
   */
  dispose(): void {
    this.clearCache();
  }
}

/**
 * 创建单例实例
 */
export const viewportCulling = new ViewportCulling();

export default ViewportCulling;
