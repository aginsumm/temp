import { apiAdapterManager } from '../data/apiAdapter';
import type {
  Entity,
  Relation,
  GraphData,
  GraphNode,
  GraphEdge,
  GraphCategory,
  EntityType,
  RelationType,
} from '../types/graph';
import { entitiesToGraphData as convertEntitiesToGraphData } from '../utils/graphConverter';
import { withRetry } from '../utils/retry';
import { DataValidator } from '../utils/dataValidator';

const API_BASE = 'graph';

export interface EntityWithRelations extends Entity {
  relations?: Array<{
    target: Entity;
    type: RelationType;
    confidence: number;
  }>;
}

export interface GraphFilter {
  entityTypes?: EntityType[];
  relationTypes?: RelationType[];
  minConfidence?: number;
  searchQuery?: string;
}

export interface GraphLayoutOptions {
  type: 'force' | 'circular' | 'hierarchical' | 'radial';
  nodeSpacing?: number;
  linkDistance?: number;
  gravity?: number;
}

class GraphService {
  private cache: Map<string, GraphData> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private getCacheKey(sessionId: string, messageId?: string): string {
    return messageId ? `${sessionId}:${messageId}` : sessionId;
  }

  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry ? Date.now() < expiry : false;
  }

  private setCache(key: string, data: GraphData): void {
    this.cache.set(key, data);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  private getFromCache(key: string): GraphData | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key) || null;
    }
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
    return null;
  }

  entitiesToGraphData(
    entities: Entity[],
    relations?: Relation[],
    options?: { maxNodes?: number; minRelevance?: number }
  ): GraphData {
    // 使用统一的转换函数
    return convertEntitiesToGraphData(entities, relations, options);
  }

  async getGraphData(sessionId: string, messageId?: string): Promise<GraphData> {
    const cacheKey = this.getCacheKey(sessionId, messageId);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const endpoint = messageId
        ? `${API_BASE}/session/${sessionId}/message/${messageId}`
        : `${API_BASE}/session/${sessionId}/data`;

      const response = await withRetry(
        () =>
          apiAdapterManager.request<{
            nodes: GraphNode[];
            edges: GraphEdge[];
            categories?: Array<{ name: EntityType; baseColor: string }>;
          }>({
            method: 'GET',
            url: endpoint,
          }),
        'getGraphData'
      );

      // 数据验证和清理
      const validation = DataValidator.validateGraphData(
        response.data.nodes || [],
        response.data.edges || []
      );

      if (!validation.valid) {
        console.warn('Graph data validation failed:', validation.errors);
      }

      const sanitized = DataValidator.sanitizeGraphData(
        response.data.nodes || [],
        response.data.edges || []
      );

      if (sanitized.removedNodes > 0 || sanitized.removedEdges > 0) {
        console.warn(
          `Removed ${sanitized.removedNodes} invalid nodes and ${sanitized.removedEdges} invalid edges`
        );
      }

      const graphData: GraphData = {
        nodes: sanitized.nodes,
        edges: sanitized.edges,
        categories: response.data.categories,
      };

      this.setCache(cacheKey, graphData);
      return graphData;
    } catch (error) {
      console.warn('Failed to fetch graph data, returning empty graph');
      return { nodes: [], edges: [] };
    }
  }

  async getEntityDetails(entityId: string): Promise<EntityWithRelations | null> {
    try {
      const response = await withRetry(
        () =>
          apiAdapterManager.request<EntityWithRelations>({
            method: 'GET',
            url: `${API_BASE}/entity/${entityId}`,
          }),
        'getEntityDetails'
      );
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch entity details:', error);
      return null;
    }
  }

  async searchEntities(query: string, types?: EntityType[]): Promise<Entity[]> {
    try {
      const response = await withRetry(
        () =>
          apiAdapterManager.request<Entity[]>({
            method: 'POST',
            url: `${API_BASE}/search`,
            data: { query, types },
          }),
        'searchEntities'
      );
      return response.data;
    } catch (error) {
      console.warn('Failed to search entities:', error);
      return [];
    }
  }

  async getRelatedEntities(entityId: string, depth: number = 1): Promise<Entity[]> {
    try {
      const response = await withRetry(
        () =>
          apiAdapterManager.request<Entity[]>({
            method: 'GET',
            url: `${API_BASE}/entity/${entityId}/related`,
            params: { depth },
          }),
        'getRelatedEntities'
      );
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch related entities:', error);
      return [];
    }
  }

  async getEntityPath(
    sourceId: string,
    targetId: string
  ): Promise<Array<{ entity: Entity; relation?: Relation }>> {
    try {
      const response = await withRetry(
        () =>
          apiAdapterManager.request<Array<{ entity: Entity; relation?: Relation }>>({
            method: 'GET',
            url: `${API_BASE}/path/${sourceId}/${targetId}`,
          }),
        'getEntityPath'
      );
      return response.data;
    } catch (error) {
      console.warn('Failed to find entity path:', error);
      return [];
    }
  }

  filterGraphData(data: GraphData, filter: GraphFilter): GraphData {
    let filteredNodes = [...data.nodes];
    let filteredEdges = [...data.edges];

    if (filter.entityTypes && filter.entityTypes.length > 0) {
      filteredNodes = filteredNodes.filter((n) => filter.entityTypes!.includes(n.category));
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filteredNodes = filteredNodes.filter(
        (n) => n.name.toLowerCase().includes(query) || n.description?.toLowerCase().includes(query)
      );
    }

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    filteredEdges = filteredEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    if (filter.minConfidence) {
      filteredEdges = filteredEdges.filter((e) => (e.value || 1) >= filter.minConfidence!);
    }

    if (filter.relationTypes && filter.relationTypes.length > 0) {
      filteredEdges = filteredEdges.filter((e) => {
        const edgeType = e.relationType as string;
        return filter.relationTypes!.includes(edgeType as RelationType);
      });
    }

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      categories: data.categories,
    };
  }

  mergeGraphData(...graphs: GraphData[]): GraphData {
    const nodeMap = new Map<string, GraphNode>();
    const edgeSet = new Set<string>();
    const mergedEdges: GraphEdge[] = [];

    graphs.forEach((graph) => {
      graph.nodes.forEach((node) => {
        if (!nodeMap.has(node.id)) {
          nodeMap.set(node.id, node);
        }
      });

      graph.edges.forEach((edge) => {
        const edgeKey = `${edge.source}-${edge.target}-${edge.relationType}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          mergedEdges.push(edge);
        }
      });
    });

    const allCategories = graphs
      .flatMap((g) => g.categories || [])
      .reduce((acc, cat) => {
        if (!acc.find((c) => c.name === cat.name)) {
          acc.push(cat);
        }
        return acc;
      }, [] as GraphCategory[]);

    return {
      nodes: Array.from(nodeMap.values()),
      edges: mergedEdges,
      categories: allCategories,
    };
  }

  calculateGraphStats(data: GraphData): {
    nodeCount: number;
    edgeCount: number;
    avgConnections: number;
    density: number;
    typeDistribution: Record<EntityType, number>;
  } {
    const nodeCount = data.nodes.length;
    const edgeCount = data.edges.length;

    const connectionCounts = new Map<string, number>();
    data.edges.forEach((edge) => {
      connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
      connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
    });

    const totalConnections = Array.from(connectionCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const avgConnections = nodeCount > 0 ? totalConnections / nodeCount : 0;

    const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

    const typeDistribution: Record<EntityType, number> = {
      inheritor: 0,
      technique: 0,
      work: 0,
      pattern: 0,
      region: 0,
      period: 0,
      material: 0,
    };
    data.nodes.forEach((node) => {
      const c = node.category;
      if (c && Object.prototype.hasOwnProperty.call(typeDistribution, c)) {
        typeDistribution[c as EntityType]++;
      } else {
        typeDistribution.technique++;
      }
    });

    return {
      nodeCount,
      edgeCount,
      avgConnections,
      density,
      typeDistribution,
    };
  }

  exportToJSON(data: GraphData): string {
    return JSON.stringify(data, null, 2);
  }

  exportToCSV(data: GraphData): { nodes: string; edges: string } {
    const nodesHeader = 'id,name,category,description,value\n';
    const nodesContent = data.nodes
      .map((n) => `"${n.id}","${n.name}","${n.category}","${n.description || ''}",${n.value || 1}`)
      .join('\n');

    const edgesHeader = 'source,target,relationType,value\n';
    const edgesContent = data.edges
      .map((e) => `"${e.source}","${e.target}","${e.relationType}",${e.value || 1}`)
      .join('\n');

    return {
      nodes: nodesHeader + nodesContent,
      edges: edgesHeader + edgesContent,
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
}

export const graphService = new GraphService();
export default graphService;
