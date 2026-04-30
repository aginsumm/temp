import { mockKnowledgeService } from '../data/mockServices/mockKnowledgeService';
import { apiAdapterManager } from '../data/apiAdapter';
import { Entity as ChatEntity } from '../types/chat';
import type { KnowledgeEntityFull } from '../data/models';
import { withRetry } from '../utils/retry';

const API_BASE = 'knowledge';
const FORCE_LOCAL_KNOWLEDGE = import.meta.env.VITE_FORCE_LOCAL_KNOWLEDGE === 'true';

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

/**
 * 统一把各种“权重/重要性”归一化到 0~1。
 * - 本地 mock 里常见是 1~5
 * - 后端/抽取里常见是 0~1
 */
function normalizeScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0.5;
  if (n > 1) {
    // 经验规则：1~5 视为五分制
    return clamp01(n / 5);
  }
  return clamp01(n);
}

type EnrichmentKey = `${string}::${string}`;

let presetEntityMapPromise: Promise<Map<EnrichmentKey, Partial<Entity>>> | null = null;

function makeEnrichmentKey(type: string, name: string): EnrichmentKey {
  return `${String(type)}::${String(name).trim().toLowerCase()}` as EnrichmentKey;
}

async function getPresetEntityMap(): Promise<Map<EnrichmentKey, Partial<Entity>>> {
  if (!presetEntityMapPromise) {
    presetEntityMapPromise = (async () => {
      try {
        const presets = (await mockKnowledgeService.getAllEntities()) as unknown as Entity[];
        const map = new Map<EnrichmentKey, Partial<Entity>>();
        for (const e of presets) {
          map.set(makeEnrichmentKey(String(e.type), String(e.name)), e);
        }
        return map;
      } catch {
        return new Map();
      }
    })();
  }
  return presetEntityMapPromise;
}

async function enrichEntities(entities: Entity[]): Promise<Entity[]> {
  const presetMap = await getPresetEntityMap();
  if (presetMap.size === 0) return entities;

  return entities.map((e) => {
    const preset = presetMap.get(makeEnrichmentKey(String(e.type), String(e.name)));
    if (!preset) return e;

    const description =
      (e.description && String(e.description).trim()) ||
      (preset.description && String(preset.description).trim()) ||
      e.description;
    const region = e.region || preset.region;
    const period = e.period || preset.period;
    const tags = e.tags && e.tags.length > 0 ? e.tags : preset.tags;
    const images = e.images && e.images.length > 0 ? e.images : preset.images;

    return {
      ...preset,
      ...e,
      description,
      region,
      period,
      tags,
      images,
      importance: normalizeScore(e.importance ?? preset.importance ?? e.relevance ?? 0.5),
      relevance: normalizeScore(e.relevance ?? preset.relevance ?? e.importance ?? 0.5),
    };
  });
}

function dedupeEntities<T extends { id: string; name: string; type: string }>(entities: T[]): T[] {
  const map = new Map<string, T>();

  for (const entity of entities) {
    const key = `${entity.type}::${entity.name.trim().toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, entity);
    }
  }

  return Array.from(map.values());
}

function dedupeGraphNodes(nodes: GraphNode[]): GraphNode[] {
  const map = new Map<string, GraphNode>();

  for (const node of nodes) {
    const key = `${node.category}::${node.name.trim().toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, node);
    }
  }

  return Array.from(map.values());
}

function dedupeGraphData(graph: GraphData): GraphData {
  const nodes = dedupeGraphNodes(graph.nodes || []).map((n) => {
    const value = normalizeScore(n.value ?? 0.5);
    return {
      ...n,
      value,
      symbolSize: n.symbolSize ?? 25 + value * 30,
    };
  });
  const validNodeIds = new Set(nodes.map((n) => n.id));

  const edgeSeen = new Set<string>();
  const edges = (graph.edges || []).filter((edge) => {
    if (!validNodeIds.has(String(edge.source)) || !validNodeIds.has(String(edge.target))) {
      return false;
    }
    const key = `${String(edge.source)}::${String(edge.target)}::${String(edge.relationType || '')}`;
    if (edgeSeen.has(key)) return false;
    edgeSeen.add(key);
    return true;
  });

  return { ...graph, nodes, edges };
}

export interface Entity extends ChatEntity {
  region?: string;
  period?: string;
  coordinates?: { lat: number; lng: number };
  metadata?: Record<string, unknown>;
  importance: number;
  created_at: string;
  updated_at: string;
  images?: string[];
  tags?: string[];
}

export interface EntityCreate {
  name: string;
  type: string;
  description?: string;
  region?: string;
  period?: string;
  coordinates?: { lat: number; lng: number };
  metadata?: Record<string, unknown>;
  importance?: number;
}

export interface EntityUpdate {
  name?: string;
  description?: string;
  region?: string;
  period?: string;
  coordinates?: { lat: number; lng: number };
  metadata?: Record<string, unknown>;
  importance?: number;
}

export interface RelationshipCreate {
  source_id: string;
  target_id: string;
  relation_type: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface RelationshipUpdate {
  relation_type?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export const knowledgeApi = {
  createEntity: async (data: EntityCreate): Promise<Entity> => {
    if (FORCE_LOCAL_KNOWLEDGE || apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.createEntity(
        data as Partial<KnowledgeEntityFull>
      ) as Promise<Entity>;
    }

    try {
      const response = await withRetry(
        () =>
          apiAdapterManager.request<Entity>({
            method: 'POST',
            url: `${API_BASE}/entity`,
            data,
          }),
        'createEntity'
      );
      return response.data;
    } catch (error) {
      console.warn('API unavailable, creating entity locally');
      return mockKnowledgeService.createEntity(
        data as Partial<KnowledgeEntityFull>
      ) as Promise<Entity>;
    }
  },

  updateEntity: async (entity_id: string, data: EntityUpdate): Promise<Entity> => {
    if (FORCE_LOCAL_KNOWLEDGE || apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.updateEntity(
        entity_id,
        data as Partial<KnowledgeEntityFull>
      ) as Promise<Entity>;
    }

    try {
      const response = await apiAdapterManager.request<Entity>({
        method: 'PUT',
        url: `${API_BASE}/entity/${entity_id}`,
        data,
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, updating entity locally');
      return mockKnowledgeService.updateEntity(entity_id, data) as Promise<Entity>;
    }
  },

  deleteEntity: async (entity_id: string): Promise<{ success: boolean }> => {
    if (FORCE_LOCAL_KNOWLEDGE || apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.deleteEntity(entity_id);
    }

    try {
      await apiAdapterManager.request({
        method: 'DELETE',
        url: `${API_BASE}/entity/${entity_id}`,
      });
      return { success: true };
    } catch (error) {
      console.warn('API unavailable, deleting entity locally');
      return mockKnowledgeService.deleteEntity(entity_id);
    }
  },

  createRelationship: async (data: RelationshipCreate): Promise<Relationship> => {
    if (FORCE_LOCAL_KNOWLEDGE || apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.createRelationship(data) as Promise<Relationship>;
    }

    try {
      const response = await apiAdapterManager.request<Relationship>({
        method: 'POST',
        url: `${API_BASE}/relationship`,
        data,
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, creating relationship locally');
      return mockKnowledgeService.createRelationship(data) as Promise<Relationship>;
    }
  },

  updateRelationship: async (
    relationship_id: string,
    data: RelationshipUpdate
  ): Promise<Relationship> => {
    if (FORCE_LOCAL_KNOWLEDGE || apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.updateRelationship(
        relationship_id,
        data
      ) as Promise<Relationship>;
    }

    try {
      const response = await apiAdapterManager.request<Relationship>({
        method: 'PUT',
        url: `${API_BASE}/relationship/${relationship_id}`,
        data,
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, updating relationship locally');
      return mockKnowledgeService.updateRelationship(
        relationship_id,
        data
      ) as Promise<Relationship>;
    }
  },

  deleteRelationship: async (relationship_id: string): Promise<{ success: boolean }> => {
    if (FORCE_LOCAL_KNOWLEDGE || apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.deleteRelationship(relationship_id);
    }

    try {
      await apiAdapterManager.request({
        method: 'DELETE',
        url: `${API_BASE}/relationship/${relationship_id}`,
      });
      return { success: true };
    } catch (error) {
      console.warn('API unavailable, deleting relationship locally');
      return mockKnowledgeService.deleteRelationship(relationship_id);
    }
  },

  search: async (params: SearchRequest): Promise<SearchResponse> => {
    if (FORCE_LOCAL_KNOWLEDGE || apiAdapterManager.shouldUseLocal()) {
      const local = (await mockKnowledgeService.search(
        params.keyword,
        {
          category: params.category,
          region: params.region,
          period: params.period,
        },
        params.page,
        params.page_size
      )) as SearchResponse;
      const normalized = (local.results || []).map((e) => ({
        ...e,
        importance: normalizeScore((e as Entity).importance ?? e.relevance ?? 0.5),
        relevance: normalizeScore(e.relevance ?? (e as Entity).importance ?? 0.5),
      }));
      const enriched = await enrichEntities(normalized as Entity[]);
      const dedupedResults = dedupeEntities(enriched);
      return { ...local, results: dedupedResults, total: dedupedResults.length };
    }

    try {
      const response = await apiAdapterManager.request<SearchResponse>({
        method: 'POST',
        url: `${API_BASE}/search`,
        data: params,
      });
      const normalized = (response.data.results || []).map((e) => ({
        ...e,
        importance: normalizeScore((e as Entity).importance ?? e.relevance ?? 0.5),
        relevance: normalizeScore(e.relevance ?? (e as Entity).importance ?? 0.5),
      }));
      const enriched = await enrichEntities(normalized as Entity[]);
      const dedupedResults = dedupeEntities(enriched);
      return { ...response.data, results: dedupedResults, total: dedupedResults.length };
    } catch (error) {
      console.warn('API unavailable, using local data for search');
      const local = (await mockKnowledgeService.search(
        params.keyword,
        {
          category: params.category,
          region: params.region,
          period: params.period,
        },
        params.page,
        params.page_size
      )) as SearchResponse;
      const normalized = (local.results || []).map((e) => ({
        ...e,
        importance: normalizeScore((e as Entity).importance ?? e.relevance ?? 0.5),
        relevance: normalizeScore(e.relevance ?? (e as Entity).importance ?? 0.5),
      }));
      const enriched = await enrichEntities(normalized as Entity[]);
      const dedupedResults = dedupeEntities(enriched);
      return { ...local, results: dedupedResults, total: dedupedResults.length };
    }
  },

  getGraphData: async (center_entity_id?: string, max_depth: number = 2): Promise<GraphData> => {
    if (FORCE_LOCAL_KNOWLEDGE || apiAdapterManager.shouldUseLocal()) {
      const data = await mockKnowledgeService.getGraphData(center_entity_id, max_depth);
      return dedupeGraphData(data as GraphData);
    }

    try {
      const response = await apiAdapterManager.request<GraphData>({
        method: 'GET',
        url: `${API_BASE}/graph`,
        params: { center_entity_id, max_depth },
      });
      const deduped = dedupeGraphData(response.data);
      // 远程图谱节点如果缺信息，用本地预设补全（保证 network 行为和 local 一致）
      const presetMap = await getPresetEntityMap();
      const enrichedNodes = deduped.nodes.map((n) => {
        const preset = presetMap.get(makeEnrichmentKey(String(n.category), String(n.name)));
        if (!preset) return n;
        const description =
          (n.description && String(n.description).trim()) ||
          (preset.description && String(preset.description).trim()) ||
          n.description;
        const region = (n as unknown as Record<string, unknown>).region || preset.region;
        const period = (n as unknown as Record<string, unknown>).period || preset.period;
        return {
          ...n,
          description,
          region,
          period,
        } as unknown as GraphNode;
      });
      return { ...deduped, nodes: enrichedNodes };
    } catch (error) {
      console.warn('API unavailable, using local data for graph');
      const data = await mockKnowledgeService.getGraphData(center_entity_id, max_depth);
      return dedupeGraphData(data as GraphData);
    }
  },

  getEntity: async (entity_id: string): Promise<Entity> => {
    if (apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.getEntity(entity_id) as Promise<Entity>;
    }

    try {
      const response = await apiAdapterManager.request<Entity>({
        method: 'GET',
        url: `${API_BASE}/entity/${entity_id}`,
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using local data for entity');
      return mockKnowledgeService.getEntity(entity_id) as Promise<Entity>;
    }
  },

  getEntityDetail: async (entity_id: string): Promise<EntityDetailResponse> => {
    if (apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.getEntityDetail(entity_id) as Promise<EntityDetailResponse>;
    }

    try {
      const response = await apiAdapterManager.request<EntityDetailResponse>({
        method: 'GET',
        url: `${API_BASE}/entity/${entity_id}/detail`,
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using local data for entity detail');
      return mockKnowledgeService.getEntityDetail(entity_id) as Promise<EntityDetailResponse>;
    }
  },

  getEntityRelations: async (entity_id: string): Promise<Relationship[]> => {
    if (apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.getEntityRelations(entity_id);
    }

    try {
      const response = await apiAdapterManager.request<Relationship[]>({
        method: 'GET',
        url: `${API_BASE}/entity/${entity_id}/relations`,
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using local data for relations');
      return mockKnowledgeService.getEntityRelations(entity_id);
    }
  },

  findPath: async (params: PathRequest): Promise<PathResponse> => {
    if (apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.findPath(
        params.source_id,
        params.target_id,
        params.max_depth
      ) as Promise<PathResponse>;
    }

    try {
      const response = await apiAdapterManager.request<PathResponse>({
        method: 'POST',
        url: `${API_BASE}/path`,
        data: params,
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using local data for findPath');
      return mockKnowledgeService.findPath(
        params.source_id,
        params.target_id,
        params.max_depth
      ) as Promise<PathResponse>;
    }
  },

  getStats: async (): Promise<StatsResponse> => {
    if (apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.getStats() as Promise<StatsResponse>;
    }

    try {
      const response = await apiAdapterManager.request<StatsResponse>({
        method: 'GET',
        url: `${API_BASE}/stats`,
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using local data for stats');
      return mockKnowledgeService.getStats() as Promise<StatsResponse>;
    }
  },

  getCategories: async (): Promise<Category[]> => {
    if (apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.getCategories();
    }

    try {
      const response = await apiAdapterManager.request<Category[]>({
        method: 'GET',
        url: `${API_BASE}/categories`,
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using local data for categories');
      return mockKnowledgeService.getCategories();
    }
  },

  getRegions: async (): Promise<string[]> => {
    if (apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.getRegions();
    }

    try {
      const response = await apiAdapterManager.request<string[]>({
        method: 'GET',
        url: `${API_BASE}/regions`,
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using local data for regions');
      return mockKnowledgeService.getRegions();
    }
  },

  getPeriods: async (): Promise<string[]> => {
    if (apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.getPeriods();
    }

    try {
      const response = await apiAdapterManager.request<string[]>({
        method: 'GET',
        url: `${API_BASE}/periods`,
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using local data for periods');
      return mockKnowledgeService.getPeriods();
    }
  },

  getSearchHistory: async (userId?: string, limit: number = 20): Promise<SearchHistoryItem[]> => {
    if (apiAdapterManager.shouldUseLocal()) {
      return mockKnowledgeService.getSearchHistory(limit);
    }

    try {
      const response = await apiAdapterManager.request<SearchHistoryItem[]>({
        method: 'GET',
        url: `${API_BASE}/search/history/${userId}`,
        params: { limit },
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using local data for search history');
      return mockKnowledgeService.getSearchHistory(limit);
    }
  },

  saveSearchHistory: async (
    userId: string | undefined,
    keyword: string,
    filters: SearchHistoryItem['filters'],
    resultCount: number
  ): Promise<SearchHistoryItem> => {
    await mockKnowledgeService.saveSearchHistory(keyword, filters, resultCount);

    if (apiAdapterManager.shouldUseRemote()) {
      try {
        const response = await apiAdapterManager.request<SearchHistoryItem>({
          method: 'POST',
          url: `${API_BASE}/search/history`,
          params: {
            user_id: userId,
            keyword,
            filters: JSON.stringify(filters),
            result_count: resultCount,
          },
        });
        return response.data;
      } catch (error) {
        console.warn('API unavailable, saved locally only');
      }
    }

    return {
      id: `local_${Date.now()}`,
      keyword,
      filters,
      result_count: resultCount,
      created_at: new Date().toISOString(),
    };
  },

  deleteSearchHistory: async (historyId: string): Promise<void> => {
    if (apiAdapterManager.shouldUseLocal()) {
      return;
    }

    try {
      await apiAdapterManager.request({
        method: 'DELETE',
        url: `${API_BASE}/search/history/${historyId}`,
      });
    } catch (error) {
      console.warn('API unavailable for deleting search history');
    }
  },

  clearSearchHistory: async (userId?: string): Promise<void> => {
    await mockKnowledgeService.clearSearchHistory();

    if (apiAdapterManager.shouldUseRemote()) {
      try {
        await apiAdapterManager.request({
          method: 'DELETE',
          url: `${API_BASE}/search/history`,
          params: { user_id: userId },
        });
      } catch (error) {
        console.warn('API unavailable for clearing search history');
      }
    }
  },

  exportData: async (format: 'json' | 'csv' = 'json'): Promise<Blob> => {
    return mockKnowledgeService.exportData(format);
  },

  importData: async (
    data: FormData | Record<string, unknown>
  ): Promise<{ success: boolean; imported: number; errors: string[] }> => {
    try {
      let importData: Record<string, unknown>;

      if (data instanceof FormData) {
        const file = data.get('file') as File;
        if (file) {
          const text = await file.text();
          try {
            importData = JSON.parse(text) as Record<string, unknown>;
          } catch {
            return {
              success: false,
              imported: 0,
              errors: ['无法解析文件内容，请确保是有效的JSON格式'],
            };
          }
        } else {
          return { success: false, imported: 0, errors: ['未找到上传文件'] };
        }
      } else {
        importData = data;
      }

      return mockKnowledgeService.importData(importData);
    } catch (error) {
      console.warn('Import failed:', error);
      return { success: false, imported: 0, errors: [String(error)] };
    }
  },
};

export interface Relationship {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  weight: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface GraphNode {
  id: string;
  name: string;
  category: string;
  symbolSize?: number;
  value?: number;
  x?: number;
  y?: number;
  itemStyle?: { color: string };
  [key: string]: unknown;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationType?: string;
  weight?: number;
  lineStyle?: { width?: number; curveness?: number; opacity?: number };
  [key: string]: unknown;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  categories?: { name: string; itemStyle?: { color: string } }[];
}

export interface SearchRequest {
  keyword?: string;
  category?: string;
  region?: string[];
  period?: string[];
  page?: number;
  page_size?: number;
  sort_by?: string;
}

export interface SearchResponse {
  results: Entity[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface EntityDetailResponse {
  entity: Entity;
  relationships: Relationship[];
  related_entities: Entity[];
}

export interface PathRequest {
  source_id: string;
  target_id: string;
  max_depth?: number;
}

export interface PathResponse {
  paths: string[][];
  entities: Entity[];
}

export interface StatsResponse {
  total_entities: number;
  total_relationships: number;
  entities_by_type: Record<string, number>;
  relationships_by_type: Record<string, number>;
  top_entities: Array<{ id: string; name: string; type: string; importance: number }>;
}

export interface Category {
  value: string;
  label: string;
  color: string;
}

export interface SearchHistoryItem {
  id: string;
  keyword: string;
  filters: {
    category?: string;
    region?: string[];
    period?: string[];
  };
  result_count: number;
  created_at: string;
}

export interface BatchOperationResult {
  success_count: number;
  failed_count: number;
  results: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
}

// 扩展 knowledgeApi 添加批量操作方法
export const knowledgeApiWithBatch = {
  ...knowledgeApi,

  batchCreateEntities: async (entities: EntityCreate[]): Promise<BatchOperationResult> => {
    if (apiAdapterManager.shouldUseLocal()) {
      const results = await Promise.all(
        entities.map((entity) =>
          mockKnowledgeService.createEntity(entity as Partial<KnowledgeEntityFull>)
        )
      );
      return {
        success_count: results.length,
        failed_count: 0,
        results: results.map((r, idx) => ({
          index: idx,
          id: r.id,
          name: r.name,
          status: 'success',
        })),
        errors: [],
      };
    }

    try {
      const response = await apiAdapterManager.request<BatchOperationResult>({
        method: 'POST',
        url: `${API_BASE}/entity/batch`,
        data: { entities },
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, creating entities locally');
      const results = await Promise.all(
        entities.map((entity) =>
          mockKnowledgeService.createEntity(entity as Partial<KnowledgeEntityFull>)
        )
      );
      return {
        success_count: results.length,
        failed_count: 0,
        results: results.map((r, idx) => ({
          index: idx,
          id: r.id,
          name: r.name,
          status: 'success',
        })),
        errors: [],
      };
    }
  },

  batchUpdateEntities: async (
    updates: Record<string, EntityUpdate>
  ): Promise<BatchOperationResult> => {
    if (apiAdapterManager.shouldUseLocal()) {
      const results = await Promise.all(
        Object.entries(updates).map(([id, data]) =>
          mockKnowledgeService.updateEntity(id, data as Partial<KnowledgeEntityFull>)
        )
      );
      return {
        success_count: results.length,
        failed_count: 0,
        results: results.map((r, idx) => ({
          entity_id: Object.keys(updates)[idx],
          name: r?.name || '',
          status: 'success',
        })),
        errors: [],
      };
    }

    try {
      const response = await apiAdapterManager.request<BatchOperationResult>({
        method: 'PUT',
        url: `${API_BASE}/entity/batch`,
        data: { updates },
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, updating entities locally');
      const results = await Promise.all(
        Object.entries(updates).map(([id, data]) =>
          mockKnowledgeService.updateEntity(id, data as Partial<KnowledgeEntityFull>)
        )
      );
      return {
        success_count: results.length,
        failed_count: 0,
        results: results.map((r, idx) => ({
          entity_id: Object.keys(updates)[idx],
          name: r?.name || '',
          status: 'success',
        })),
        errors: [],
      };
    }
  },

  batchCreateRelationships: async (
    relationships: RelationshipCreate[]
  ): Promise<BatchOperationResult> => {
    if (apiAdapterManager.shouldUseLocal()) {
      const results = await Promise.all(
        relationships.map((rel) => mockKnowledgeService.createRelationship(rel))
      );
      return {
        success_count: results.length,
        failed_count: 0,
        results: results.map((r, idx) => ({ index: idx, id: r.id!, status: 'success' })),
        errors: [],
      };
    }

    try {
      const response = await apiAdapterManager.request<BatchOperationResult>({
        method: 'POST',
        url: `${API_BASE}/relationship/batch`,
        data: { relationships },
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, creating relationships locally');
      const results = await Promise.all(
        relationships.map((rel) => mockKnowledgeService.createRelationship(rel))
      );
      return {
        success_count: results.length,
        failed_count: 0,
        results: results.map((r, idx) => ({ index: idx, id: r.id!, status: 'success' })),
        errors: [],
      };
    }
  },
};
