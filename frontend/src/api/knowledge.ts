import { apiClient } from './client';
import { Entity as ChatEntity } from '../types/chat';

const API_BASE = '/api/v1/knowledge';

export interface Entity extends ChatEntity {
  region?: string;
  period?: string;
  coordinates?: { lat: number; lng: number };
  meta_data?: Record<string, any>;
  importance: number;
  created_at: string;
  updated_at: string;
}

const mockEntities: Entity[] = [
  {
    id: '1',
    name: '张三',
    type: 'inheritor',
    description: '景泰蓝技艺传承人',
    region: '北京',
    period: '现代',
    importance: 0.9,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: '景泰蓝',
    type: 'technique',
    description: '中国传统工艺，金属胎掐丝珐琅',
    region: '北京',
    period: '明清',
    importance: 0.95,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: '掐丝珐琅瓶',
    type: 'work',
    description: '精美的景泰蓝作品',
    region: '北京',
    period: '现代',
    importance: 0.8,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    name: '云纹',
    type: 'pattern',
    description: '传统吉祥纹样',
    region: '全国',
    period: '古代',
    importance: 0.7,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '5',
    name: '北京',
    type: 'region',
    description: '中国首都',
    coordinates: { lat: 39.9042, lng: 116.4074 },
    importance: 0.85,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '6',
    name: '明清时期',
    type: 'period',
    description: '中国历史上的一个时期',
    importance: 0.75,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '7',
    name: '铜胎',
    type: 'material',
    description: '景泰蓝的主要材料',
    importance: 0.6,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '8',
    name: '李四',
    type: 'inheritor',
    description: '苏绣技艺传承人',
    region: '苏州',
    period: '现代',
    importance: 0.85,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '9',
    name: '苏绣',
    type: 'technique',
    description: '中国四大名绣之一',
    region: '苏州',
    period: '古代',
    importance: 0.9,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '10',
    name: '双面绣',
    type: 'work',
    description: '苏绣的代表作',
    region: '苏州',
    period: '现代',
    importance: 0.75,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '11',
    name: '苏州',
    type: 'region',
    description: '江苏省地级市',
    coordinates: { lat: 31.2989, lng: 120.5853 },
    importance: 0.8,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '12',
    name: '丝绸',
    type: 'material',
    description: '苏绣的主要材料',
    importance: 0.65,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockGraphData: GraphData = {
  nodes: mockEntities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    category:
      {
        inheritor: '传承人',
        technique: '技艺',
        work: '作品',
        pattern: '纹样',
        region: '地域',
        period: '时期',
        material: '材料',
      }[entity.type] || entity.type,
    symbolSize: 20 + entity.importance * 30,
    value: entity.importance,
    itemStyle: {
      color:
        {
          inheritor: '#8B5CF6',
          technique: '#10B981',
          work: '#F59E0B',
          pattern: '#EF4444',
          region: '#06B6D4',
          period: '#6366F1',
          material: '#84CC16',
        }[entity.type] || '#3B82F6',
    },
  })),
  edges: [
    {
      source: '1',
      target: '2',
      relationType: '传承',
      lineStyle: { width: 2, curveness: 0.3, opacity: 0.6 },
    },
    {
      source: '1',
      target: '3',
      relationType: '创作',
      lineStyle: { width: 1.8, curveness: 0.3, opacity: 0.6 },
    },
    {
      source: '2',
      target: '4',
      relationType: '包含',
      lineStyle: { width: 1.4, curveness: 0.3, opacity: 0.6 },
    },
    {
      source: '2',
      target: '5',
      relationType: '产地',
      lineStyle: { width: 1.6, curveness: 0.3, opacity: 0.6 },
    },
    {
      source: '2',
      target: '6',
      relationType: '时期',
      lineStyle: { width: 1.2, curveness: 0.3, opacity: 0.6 },
    },
    {
      source: '2',
      target: '7',
      relationType: '使用',
      lineStyle: { width: 1.8, curveness: 0.3, opacity: 0.6 },
    },
    {
      source: '3',
      target: '4',
      relationType: '使用',
      lineStyle: { width: 1.6, curveness: 0.3, opacity: 0.6 },
    },
    {
      source: '8',
      target: '9',
      relationType: '传承',
      lineStyle: { width: 2, curveness: 0.3, opacity: 0.6 },
    },
    {
      source: '8',
      target: '10',
      relationType: '创作',
      lineStyle: { width: 1.8, curveness: 0.3, opacity: 0.6 },
    },
    {
      source: '9',
      target: '11',
      relationType: '产地',
      lineStyle: { width: 1.6, curveness: 0.3, opacity: 0.6 },
    },
    {
      source: '9',
      target: '12',
      relationType: '使用',
      lineStyle: { width: 1.8, curveness: 0.3, opacity: 0.6 },
    },
    {
      source: '10',
      target: '12',
      relationType: '使用',
      lineStyle: { width: 1.9, curveness: 0.3, opacity: 0.6 },
    },
  ],
  categories: [
    { name: '传承人', itemStyle: { color: '#8B5CF6' } },
    { name: '技艺', itemStyle: { color: '#10B981' } },
    { name: '作品', itemStyle: { color: '#F59E0B' } },
    { name: '纹样', itemStyle: { color: '#EF4444' } },
    { name: '地域', itemStyle: { color: '#06B6D4' } },
    { name: '时期', itemStyle: { color: '#6366F1' } },
    { name: '材料', itemStyle: { color: '#84CC16' } },
  ],
};

export const knowledgeApi = {
  search: async (params: SearchRequest): Promise<SearchResponse> => {
    try {
      const response = await apiClient.post<SearchResponse>(`${API_BASE}/search`, params);
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using mock data for search');
      let filteredEntities = mockEntities;

      if (params.keyword) {
        const keyword = params.keyword.toLowerCase();
        filteredEntities = filteredEntities.filter(
          (e) =>
            e.name.toLowerCase().includes(keyword) || e.description?.toLowerCase().includes(keyword)
        );
      }

      if (params.category && params.category !== 'all') {
        filteredEntities = filteredEntities.filter((e) => e.type === params.category);
      }

      if (params.region && params.region.length > 0) {
        filteredEntities = filteredEntities.filter(
          (e) => e.region && params.region!.includes(e.region)
        );
      }

      if (params.period && params.period.length > 0) {
        filteredEntities = filteredEntities.filter(
          (e) => e.period && params.period!.includes(e.period)
        );
      }

      return {
        results: filteredEntities,
        total: filteredEntities.length,
        page: params.page || 1,
        page_size: params.page_size || 20,
        total_pages: Math.ceil(filteredEntities.length / (params.page_size || 20)),
      };
    }
  },

  getGraphData: async (center_entity_id?: string, max_depth: number = 2): Promise<GraphData> => {
    try {
      const response = await apiClient.get<GraphData>(`${API_BASE}/graph`, {
        params: { center_entity_id, max_depth },
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using mock data for graph');
      return mockGraphData;
    }
  },

  getEntity: async (entity_id: string): Promise<Entity> => {
    try {
      const response = await apiClient.get<Entity>(`${API_BASE}/entity/${entity_id}`);
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using mock data for entity');
      const entity = mockEntities.find((e) => e.id === entity_id);
      if (!entity) throw new Error('Entity not found');
      return entity;
    }
  },

  getEntityDetail: async (entity_id: string): Promise<EntityDetailResponse> => {
    try {
      const response = await apiClient.get<EntityDetailResponse>(
        `${API_BASE}/entity/${entity_id}/detail`
      );
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using mock data for entity detail');
      const entity = mockEntities.find((e) => e.id === entity_id);
      if (!entity) throw new Error('Entity not found');

      const relatedEntities = mockEntities.filter((e) => e.id !== entity_id);
      const relationships = mockGraphData.edges
        .filter((edge) => edge.source === entity_id || edge.target === entity_id)
        .map((edge, idx) => ({
          id: `rel_${idx}`,
          source_id: edge.source,
          target_id: edge.target,
          relation_type: edge.relationType,
          weight: edge.lineStyle?.width || 1,
          meta_data: {},
          created_at: new Date().toISOString(),
        }));

      return {
        entity,
        relationships,
        related_entities: relatedEntities.slice(0, 5),
      };
    }
  },

  getEntityRelations: async (entity_id: string): Promise<Relationship[]> => {
    try {
      const response = await apiClient.get<Relationship[]>(
        `${API_BASE}/entity/${entity_id}/relations`
      );
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using mock data for relations');
      return mockGraphData.edges
        .filter((edge) => edge.source === entity_id || edge.target === entity_id)
        .map((edge, idx) => ({
          id: `rel_${idx}`,
          source_id: edge.source,
          target_id: edge.target,
          relation_type: edge.relationType,
          weight: edge.lineStyle?.width || 1,
          meta_data: {},
          created_at: new Date().toISOString(),
        }));
    }
  },

  findPath: async (params: PathRequest): Promise<PathResponse> => {
    try {
      const response = await apiClient.post<PathResponse>(`${API_BASE}/path`, params);
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using mock data for findPath');

      const sourceEntity = mockEntities.find((e) => e.id === params.source_id);
      const targetEntity = mockEntities.find((e) => e.id === params.target_id);

      if (!sourceEntity || !targetEntity) {
        return { paths: [], entities: [] };
      }

      const directConnection = mockGraphData.edges.find(
        (edge) =>
          (edge.source === params.source_id && edge.target === params.target_id) ||
          (edge.target === params.source_id && edge.source === params.target_id)
      );

      if (directConnection) {
        return {
          paths: [[params.source_id, params.target_id]],
          entities: [sourceEntity, targetEntity],
        };
      }

      const maxDepth = params.max_depth || 3;
      const paths: string[][] = [];

      const findPaths = (
        currentId: string,
        targetId: string,
        path: string[],
        visited: Set<string>,
        depth: number
      ) => {
        if (depth > maxDepth) return;
        if (currentId === targetId) {
          paths.push([...path]);
          return;
        }

        const connections = mockGraphData.edges.filter(
          (edge) => edge.source === currentId || edge.target === currentId
        );

        for (const edge of connections) {
          const nextId = edge.source === currentId ? edge.target : edge.source;
          if (!visited.has(nextId)) {
            visited.add(nextId);
            findPaths(nextId, targetId, [...path, nextId], visited, depth + 1);
            visited.delete(nextId);
          }
        }
      };

      findPaths(
        params.source_id,
        params.target_id,
        [params.source_id],
        new Set([params.source_id]),
        0
      );

      const entityIds = new Set<string>();
      paths.forEach((path) => path.forEach((id) => entityIds.add(id)));
      const entities = Array.from(entityIds)
        .map((id) => mockEntities.find((e) => e.id === id))
        .filter((e): e is Entity => e !== undefined);

      return { paths: paths.slice(0, 10), entities };
    }
  },

  getStats: async (): Promise<StatsResponse> => {
    try {
      const response = await apiClient.get<StatsResponse>(`${API_BASE}/stats`);
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using mock data for stats');

      const entitiesByType: Record<string, number> = {};
      const relationshipsByType: Record<string, number> = {};

      mockEntities.forEach((entity) => {
        entitiesByType[entity.type] = (entitiesByType[entity.type] || 0) + 1;
      });

      mockGraphData.edges.forEach((edge) => {
        const relType = edge.relationType;
        relationshipsByType[relType] = (relationshipsByType[relType] || 0) + 1;
      });

      const topEntities = [...mockEntities]
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 10)
        .map((entity) => ({
          id: entity.id,
          name: entity.name,
          type: entity.type,
          importance: entity.importance,
        }));

      return {
        total_entities: mockEntities.length,
        total_relationships: mockGraphData.edges.length,
        entities_by_type: entitiesByType,
        relationships_by_type: relationshipsByType,
        top_entities: topEntities,
      };
    }
  },

  getCategories: async (): Promise<Category[]> => {
    try {
      const response = await apiClient.get<Category[]>(`${API_BASE}/categories`);
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using mock data for categories');
      return [
        { value: 'inheritor', label: '传承人', color: '#8B5CF6' },
        { value: 'technique', label: '技艺', color: '#10B981' },
        { value: 'work', label: '作品', color: '#F59E0B' },
        { value: 'pattern', label: '纹样', color: '#EF4444' },
        { value: 'region', label: '地域', color: '#06B6D4' },
        { value: 'period', label: '时期', color: '#6366F1' },
        { value: 'material', label: '材料', color: '#84CC16' },
      ];
    }
  },

  getRegions: async (): Promise<string[]> => {
    try {
      const response = await apiClient.get<string[]>(`${API_BASE}/regions`);
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using mock data for regions');
      const regions = [
        ...new Set(mockEntities.map((e) => e.region).filter((r): r is string => Boolean(r))),
      ];
      return regions;
    }
  },

  getPeriods: async (): Promise<string[]> => {
    try {
      const response = await apiClient.get<string[]>(`${API_BASE}/periods`);
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using mock data for periods');
      const periods = [
        ...new Set(mockEntities.map((e) => e.period).filter((p): p is string => Boolean(p))),
      ];
      return periods;
    }
  },
};

export interface Relationship {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  weight: number;
  meta_data?: Record<string, any>;
  created_at: string;
}

export interface GraphNode {
  id: string;
  name: string;
  category: string;
  symbolSize: number;
  value?: number;
  itemStyle?: { color: string };
}

export interface GraphEdge {
  source: string;
  target: string;
  relationType: string;
  lineStyle?: { width: number; curveness: number; opacity: number };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  categories: { name: string; itemStyle: { color: string } }[];
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
