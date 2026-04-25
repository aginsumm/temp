/**
 * 知识图谱模块统一类型定义
 * 此文件定义了 Chat 和 Knowledge 模块共享的知识图谱相关类型
 * 确保两个模块使用一致的数据结构
 */

import type { EntityType, RelationType } from './chat';

// ============================================================================
// 基础实体类型（扩展自 Chat 模块的 Entity）
// ============================================================================

/**
 * 知识图谱实体 - 完整版本
 * 包含 Chat 模块 Entity 的所有字段，并扩展了 Knowledge 特有的字段
 */
export interface KnowledgeEntity {
  // 基础字段（与 Chat 模块 Entity 一致）
  id: string;
  name: string;
  type: EntityType;
  description?: string;
  relevance?: number;

  // Knowledge 模块特有字段
  /** 实体重要性评分 (0-1) */
  importance: number;
  /** 所属地区 */
  region?: string;
  /** 所属时期 */
  period?: string;
  /** 地理坐标（用于地图视图） */
  coordinates?: {
    lat: number;
    lng: number;
  };
  /** 扩展元数据 */
  metadata?: Record<string, unknown>;
  /** 图片 URLs */
  images?: string[];
  /** 标签 */
  tags?: string[];
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

/**
 * 知识图谱实体 - 创建时的输入类型
 */
export interface KnowledgeEntityCreate {
  name: string;
  type: EntityType;
  description?: string;
  region?: string;
  period?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  metadata?: Record<string, unknown>;
  importance?: number;
  images?: string[];
  tags?: string[];
}

/**
 * 知识图谱实体 - 更新时的输入类型
 */
export interface KnowledgeEntityUpdate {
  name?: string;
  description?: string;
  region?: string;
  period?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  metadata?: Record<string, unknown>;
  importance?: number;
  images?: string[];
  tags?: string[];
}

/**
 * 知识图谱实体 - 完整详情（包含关联数据）
 */
export interface KnowledgeEntityFull extends KnowledgeEntity {
  /** 实体的所有关系 */
  relationships: KnowledgeRelationship[];
  /** 相关联的实体 */
  related_entities: KnowledgeEntity[];
}

// ============================================================================
// 关系类型
// ============================================================================

/**
 * 知识图谱关系
 */
export interface KnowledgeRelationship {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: RelationType | string;
  weight: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/**
 * 关系创建输入
 */
export interface KnowledgeRelationshipCreate {
  source_id: string;
  target_id: string;
  relation_type: RelationType | string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 关系更新输入
 */
export interface KnowledgeRelationshipUpdate {
  relation_type?: RelationType | string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 图谱数据结构
// ============================================================================

/**
 * 图谱节点（用于 ECharts 渲染）
 */
export interface KnowledgeGraphNode {
  id: string;
  name: string;
  category: EntityType;
  symbolSize?: number;
  value?: number;
  x?: number;
  y?: number;
  itemStyle?: {
    color?: string;
    borderColor?: string;
    borderWidth?: number;
  };
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 图谱边（用于 ECharts 渲染）
 */
export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  relationType?: RelationType | string;
  value?: number;
  lineStyle?: {
    color?: string;
    width?: number;
    curveness?: number;
    opacity?: number;
  };
}

/**
 * 图谱分类
 */
export interface KnowledgeGraphCategory {
  name: EntityType;
  itemStyle?: {
    color?: string;
  };
}

/**
 * 图谱数据（用于 ECharts 渲染）
 */
export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  categories?: KnowledgeGraphCategory[];
}

// ============================================================================
// 搜索和过滤
// ============================================================================

/**
 * 搜索请求参数
 */
export interface KnowledgeSearchRequest {
  keyword?: string;
  category?: EntityType | string;
  region?: string[];
  period?: string[];
  page?: number;
  page_size?: number;
  sort_by?: 'relevance' | 'name' | 'date' | 'importance';
}

/**
 * 搜索响应
 */
export interface KnowledgeSearchResponse {
  results: KnowledgeEntity[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * 搜索历史项
 */
export interface KnowledgeSearchHistoryItem {
  id: string;
  keyword: string;
  filters: {
    category?: EntityType | string;
    region?: string[];
    period?: string[];
  };
  result_count: number;
  created_at: string;
}

/**
 * 路径查找请求
 */
export interface KnowledgePathRequest {
  source_id: string;
  target_id: string;
  max_depth?: number;
}

/**
 * 路径查找响应
 */
export interface KnowledgePathResponse {
  paths: string[][];
  entities: KnowledgeEntity[];
}

/**
 * 统计数据
 */
export interface KnowledgeStatsResponse {
  total_entities: number;
  total_relationships: number;
  entities_by_type: Record<string, number>;
  relationships_by_type: Record<string, number>;
  top_entities: Array<{
    id: string;
    name: string;
    type: EntityType;
    importance: number;
  }>;
}

// ============================================================================
// 用户交互
// ============================================================================

/**
 * 收藏项
 */
export interface KnowledgeFavoriteItem {
  id: string;
  user_id: string;
  entity_id: string;
  entity_type: EntityType;
  entity_name: string;
  created_at: string;
}

/**
 * 反馈项
 */
export interface KnowledgeFeedbackItem {
  id: string;
  user_id: string;
  entity_id: string;
  feedback_type: string;
  content?: string;
  rating?: number;
  created_at: string;
}

// ============================================================================
// 工具函数类型
// ============================================================================

/**
 * 图谱过滤条件
 */
export interface KnowledgeGraphFilter {
  entityTypes?: EntityType[];
  relationTypes?: (RelationType | string)[];
  minConfidence?: number;
  searchQuery?: string;
  regions?: string[];
  periods?: string[];
}

/**
 * 图谱布局选项
 */
export interface KnowledgeGraphLayoutOptions {
  type: 'force' | 'circular' | 'hierarchical' | 'radial';
  nodeSpacing?: number;
  linkDistance?: number;
  gravity?: number;
}

// ============================================================================
// 类型转换工具函数
// ============================================================================

/**
 * 将 Chat 模块的 Entity 转换为 KnowledgeEntity
 * 用于在两个模块之间传递数据
 */
export function convertChatEntityToKnowledgeEntity(
  chatEntity: import('./chat').Entity,
  overrides?: Partial<KnowledgeEntity>
): KnowledgeEntity {
  return {
    id: chatEntity.id,
    name: chatEntity.name,
    type: chatEntity.type,
    description: chatEntity.description,
    relevance: chatEntity.relevance,
    importance: overrides?.importance ?? 0.5,
    region: overrides?.region ?? (chatEntity.metadata?.region as string | undefined),
    period: overrides?.period ?? (chatEntity.metadata?.period as string | undefined),
    coordinates: overrides?.coordinates,
    metadata: overrides?.metadata ?? chatEntity.metadata,
    images: overrides?.images,
    tags: overrides?.tags,
    created_at: overrides?.created_at ?? new Date().toISOString(),
    updated_at: overrides?.updated_at ?? new Date().toISOString(),
    ...overrides,
  };
}

/**
 * 将 KnowledgeEntity 转换为 Chat 模块的 Entity
 * 用于将 Knowledge 数据传递给 Chat 模块
 */
export function convertKnowledgeEntityToChatEntity(
  knowledgeEntity: KnowledgeEntity
): import('./chat').Entity {
  return {
    id: knowledgeEntity.id,
    name: knowledgeEntity.name,
    type: knowledgeEntity.type,
    description: knowledgeEntity.description,
    relevance: knowledgeEntity.relevance ?? knowledgeEntity.importance,
    metadata: knowledgeEntity.metadata ?? {
      region: knowledgeEntity.region,
      period: knowledgeEntity.period,
    },
    url: knowledgeEntity.images?.[0],
  };
}

/**
 * 将 Chat 模块的 Relation 转换为 KnowledgeRelationship
 */
export function convertChatRelationToKnowledgeRelation(
  chatRelation: import('./chat').Relation,
  overrides?: Partial<KnowledgeRelationship>
): KnowledgeRelationship {
  return {
    id: chatRelation.id ?? `${chatRelation.source}-${chatRelation.target}-${chatRelation.type}`,
    source_id: chatRelation.source,
    target_id: chatRelation.target,
    relation_type: chatRelation.type,
    weight: chatRelation.confidence ?? 0.5,
    metadata: {
      evidence: chatRelation.evidence,
      bidirectional: chatRelation.bidirectional,
    },
    created_at: overrides?.created_at ?? new Date().toISOString(),
    ...overrides,
  };
}

/**
 * 将 KnowledgeRelationship 转换为 Chat 模块的 Relation
 */
export function convertKnowledgeRelationToChatRelation(
  knowledgeRelation: KnowledgeRelationship
): import('./chat').Relation {
  return {
    id: knowledgeRelation.id,
    source: knowledgeRelation.source_id,
    target: knowledgeRelation.target_id,
    type: knowledgeRelation.relation_type as RelationType,
    confidence: knowledgeRelation.weight,
    evidence: knowledgeRelation.metadata?.evidence as string,
    bidirectional: knowledgeRelation.metadata?.bidirectional as boolean,
  };
}
