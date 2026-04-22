/**
 * 渐进式加载器 - 分块加载大型图谱，避免阻塞 UI
 */

import type { GraphData, GraphNode, GraphEdge } from '../api/knowledge';

/**
 * 加载进度
 */
export interface LoadProgress {
  loadedChunks: number;
  totalChunks: number;
  loadedNodes: number;
  totalNodes: number;
  loadedEdges: number;
  totalEdges: number;
  percentage: number;
}

/**
 * 加载回调
 */
export interface LoadCallbacks {
  onChunkLoaded?: (chunkData: GraphData, progress: LoadProgress) => void;
  onProgress?: (progress: LoadProgress) => void;
  onComplete?: (fullData: GraphData) => void;
  onError?: (error: Error) => void;
}

/**
 * 加载配置
 */
export interface ProgressiveLoaderConfig {
  chunkSize: number; // 每个 chunk 的节点数
  delayBetweenChunks: number; // chunk 之间的延迟（毫秒）
  maxConcurrentChunks: number; // 最大并发 chunk 数
  priorityMode: 'importance' | 'distance' | 'random'; // 优先级模式
}

const DEFAULT_CONFIG: ProgressiveLoaderConfig = {
  chunkSize: 100,
  delayBetweenChunks: 0,
  maxConcurrentChunks: 1,
  priorityMode: 'importance',
};

/**
 * 渐进式加载器类
 */
export class ProgressiveLoader {
  private config: ProgressiveLoaderConfig;
  private isLoading: boolean = false;
  private isPaused: boolean = false;
  private abortController: AbortController | null = null;
  private loadedChunks: GraphData[] = [];
  private currentChunkIndex: number = 0;

  constructor(config?: Partial<ProgressiveLoaderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ProgressiveLoaderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 暂停加载
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * 恢复加载
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * 中止加载
   */
  abort(): void {
    this.abortController?.abort();
    this.isLoading = false;
    this.isPaused = false;
    this.loadedChunks = [];
    this.currentChunkIndex = 0;
  }

  /**
   * 从图谱数据创建 chunks
   */
  private createChunks(graphData: GraphData): GraphData[] {
    const { chunkSize, priorityMode } = this.config;
    const nodes = [...graphData.nodes];
    const edges = graphData.edges;

    // 根据优先级模式排序节点
    switch (priorityMode) {
      case 'importance':
        nodes.sort((a: GraphNode, b: GraphNode) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const importanceA = a.value || (a.metadata as any)?.importance || 0.5;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const importanceB = b.value || (b.metadata as any)?.importance || 0.5;
          return importanceB - importanceA;
        });
        break;
      case 'distance':
        // 按距离视口中心的距离排序（需要视口信息）
        // 这里简化处理，假设已经有 x,y 坐标
        nodes.sort((a: GraphNode, b: GraphNode) => {
          const distA = Math.sqrt(Math.pow(a.x || 0, 2) + Math.pow(a.y || 0, 2));
          const distB = Math.sqrt(Math.pow(b.x || 0, 2) + Math.pow(b.y || 0, 2));
          return distA - distB;
        });
        break;
      case 'random':
        // 随机排序
        nodes.sort(() => Math.random() - 0.5);
        break;
    }

    // 创建 chunks
    const chunks: GraphData[] = [];
    const totalChunks = Math.ceil(nodes.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, nodes.length);
      const chunkNodes = nodes.slice(start, end);
      const chunkNodeIds = new Set(chunkNodes.map((n) => n.id));

      // 只保留连接 chunk 内节点的边
      const chunkEdges = edges.filter(
        (edge) => chunkNodeIds.has(edge.source) && chunkNodeIds.has(edge.target)
      );

      chunks.push({
        nodes: chunkNodes,
        edges: chunkEdges,
        categories: graphData.categories,
      });
    }

    return chunks;
  }

  /**
   * 计算加载进度
   */
  private calculateProgress(
    loadedChunks: number,
    totalChunks: number,
    chunks: GraphData[]
  ): LoadProgress {
    const loadedNodes = chunks
      .slice(0, loadedChunks)
      .reduce((sum, chunk) => sum + chunk.nodes.length, 0);
    const loadedEdges = chunks
      .slice(0, loadedChunks)
      .reduce((sum, chunk) => sum + chunk.edges.length, 0);
    const totalNodes = chunks.reduce((sum, chunk) => sum + chunk.nodes.length, 0);
    const totalEdges = chunks.reduce((sum, chunk) => sum + chunk.edges.length, 0);

    return {
      loadedChunks,
      totalChunks,
      loadedNodes,
      totalNodes,
      loadedEdges,
      totalEdges,
      percentage: totalChunks > 0 ? (loadedChunks / totalChunks) * 100 : 0,
    };
  }

  /**
   * 合并 chunks
   */
  private mergeChunks(chunks: GraphData[]): GraphData {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    for (const chunk of chunks) {
      for (const node of chunk.nodes) {
        if (!nodeIds.has(node.id)) {
          nodes.push(node);
          nodeIds.add(node.id);
        }
      }

      for (const edge of chunk.edges) {
        // 避免重复添加边
        const exists = edges.some(
          (e) =>
            (e.source === edge.source && e.target === edge.target) ||
            (e.source === edge.target && e.target === edge.source)
        );

        if (!exists) {
          edges.push(edge);
        }
      }
    }

    return {
      nodes,
      edges,
      categories: chunks[0]?.categories,
    };
  }

  /**
   * 加载单个 chunk
   */
  private async loadChunk(
    chunk: GraphData,
    chunkIndex: number,
    callbacks: LoadCallbacks
  ): Promise<void> {
    if (this.isPaused) {
      // 等待恢复
      await new Promise<void>((resolve) => {
        const checkPause = () => {
          if (!this.isPaused) {
            resolve();
          } else {
            setTimeout(checkPause, 100);
          }
        };
        checkPause();
      });
    }

    // 检查是否中止
    if (this.abortController?.signal.aborted) {
      throw new Error('Loading aborted');
    }

    // 模拟异步加载（实际使用时可以直接返回 chunk）
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 回调
    const progress = this.calculateProgress(chunkIndex + 1, this.loadedChunks.length, [
      ...this.loadedChunks,
      chunk,
    ]);

    callbacks.onChunkLoaded?.(chunk, progress);
    callbacks.onProgress?.(progress);
  }

  /**
   * 加载图谱数据
   */
  async load(graphData: GraphData, callbacks: LoadCallbacks): Promise<GraphData> {
    if (this.isLoading) {
      throw new Error('Already loading');
    }

    try {
      this.isLoading = true;
      this.isPaused = false;
      this.abortController = new AbortController();
      this.loadedChunks = [];
      this.currentChunkIndex = 0;

      // 创建 chunks
      const chunks = this.createChunks(graphData);
      const totalChunks = chunks.length;

      // 依次加载 chunks
      for (let i = 0; i < totalChunks; i++) {
        this.currentChunkIndex = i;

        try {
          await this.loadChunk(chunks[i], i, callbacks);
          this.loadedChunks.push(chunks[i]);

          // 延迟（避免阻塞 UI）
          if (this.config.delayBetweenChunks > 0 && i < totalChunks - 1) {
            await new Promise((resolve) => setTimeout(resolve, this.config.delayBetweenChunks));
          }
        } catch (error) {
          if ((error as Error).message === 'Loading aborted') {
            throw error;
          }
          console.error(`Failed to load chunk ${i}:`, error);
          callbacks.onError?.(error as Error);
        }
      }

      // 合并所有 chunks
      const fullData = this.mergeChunks(this.loadedChunks);
      callbacks.onComplete?.(fullData);

      return fullData;
    } catch (error) {
      callbacks.onError?.(error as Error);
      throw error;
    } finally {
      this.isLoading = false;
      this.abortController = null;
    }
  }

  /**
   * 快速加载（只加载重要节点）
   */
  async loadQuick(
    graphData: GraphData,
    maxNodes: number = 500,
    callbacks?: LoadCallbacks
  ): Promise<GraphData> {
    // 按重要性排序
    const sortedNodes = [...graphData.nodes].sort((a: GraphNode, b: GraphNode) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importanceA = a.value || (a.metadata as any)?.importance || 0.5;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const importanceB = b.value || (b.metadata as any)?.importance || 0.5;
      return importanceB - importanceA;
    });

    // 只取前 N 个重要节点
    const quickNodes = sortedNodes.slice(0, maxNodes);
    const quickNodeIds = new Set(quickNodes.map((n: GraphNode) => n.id));

    // 过滤边
    const quickEdges = graphData.edges.filter(
      (edge) => quickNodeIds.has(edge.source) && quickNodeIds.has(edge.target)
    );

    const quickData = {
      nodes: quickNodes,
      edges: quickEdges,
      categories: graphData.categories,
    };

    callbacks?.onComplete?.(quickData);

    return quickData;
  }

  /**
   * 获取加载状态
   */
  getLoadingStatus(): {
    isLoading: boolean;
    isPaused: boolean;
    currentChunkIndex: number;
    loadedChunksCount: number;
  } {
    return {
      isLoading: this.isLoading,
      isPaused: this.isPaused,
      currentChunkIndex: this.currentChunkIndex,
      loadedChunksCount: this.loadedChunks.length,
    };
  }

  /**
   * 重置
   */
  reset(): void {
    this.abort();
    this.loadedChunks = [];
    this.currentChunkIndex = 0;
  }
}

/**
 * 创建单例实例
 */
export const progressiveLoader = new ProgressiveLoader();

export default ProgressiveLoader;
