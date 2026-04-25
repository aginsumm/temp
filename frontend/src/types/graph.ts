/**
 * 统一的图谱类型定义
 * 此文件是 Chat 和 Knowledge 模块共享的唯一类型来源
 */

// ============================================================================
// 实体类型
// ============================================================================

/**
 * 实体类型枚举
 */
export type EntityType =
  | 'inheritor' // 传承人
  | 'technique' // 技艺
  | 'work' // 作品
  | 'pattern' // 纹样
  | 'region' // 地区
  | 'period' // 时期
  | 'material'; // 材料

/**
 * 基础实体接口
 */
export interface BaseEntity {
  id: string;
  name: string;
  type: EntityType;
  description?: string;
  relevance?: number;
}

/**
 * Chat 模块实体（扩展基础实体）
 */
export interface ChatEntity extends BaseEntity {
  url?: string;
  metadata?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  // Knowledge 模块扩展字段
  importance?: number;
  region?: string;
  period?: string;
  coordinates?: GeoCoordinates;
  images?: string[];
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  aliases?: string[];
  external_ids?: Record<string, string>;
}

/**
 * Knowledge 模块实体（完整版本）
 */
export interface KnowledgeEntity extends Required<Omit<ChatEntity, 'url' | 'properties'>> {
  importance: number;
  created_at: string;
  updated_at: string;
}

/**
 * 实体创建输入
 */
export interface EntityCreate {
  name: string;
  type: EntityType;
  description?: string;
  region?: string;
  period?: string;
  coordinates?: GeoCoordinates;
  metadata?: Record<string, unknown>;
  importance?: number;
  images?: string[];
  tags?: string[];
}

/**
 * 实体更新输入
 */
export interface EntityUpdate {
  name?: string;
  description?: string;
  region?: string;
  period?: string;
  coordinates?: GeoCoordinates;
  metadata?: Record<string, unknown>;
  importance?: number;
  images?: string[];
  tags?: string[];
}

// ============================================================================
// 关系类型
// ============================================================================

/**
 * 关系类型枚举
 */
export type RelationType =
  | 'inherits' // 传承
  | 'origin' // 起源于
  | 'creates' // 创作
  | 'flourished_in' // 繁荣于
  | 'located_in' // 位于
  | 'uses_material' // 使用材料
  | 'has_pattern' // 包含纹样
  | 'related_to' // 相关
  | 'influenced_by' // 受影响于
  | 'contains'; // 包含

/**
 * 基础关系接口
 */
export interface BaseRelation {
  id?: string;
  source: string;
  target: string;
  type: RelationType | string;
  confidence?: number;
}

/**
 * Chat 模块关系
 */
export interface ChatRelation extends BaseRelation {
  id?: string;
  confidence?: number;
  evidence?: string;
  bidirectional?: boolean;
}

/**
 * Knowledge 模块关系（完整版本）
 */
export interface KnowledgeRelation extends BaseRelation {
  id: string;
  weight: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/**
 * 关系创建输入
 */
export interface RelationCreate {
  source_id: string;
  target_id: string;
  relation_type: RelationType | string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 关系更新输入
 */
export interface RelationUpdate {
  relation_type?: RelationType | string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 通用类型别名（用于跨模块共享）
// ============================================================================

/**
 * 通用 Entity 类型（默认使用 ChatEntity）
 * 在大多数情况下使用此类型
 */
export type Entity = ChatEntity;

/**
 * 通用 Relation 类型（默认使用 ChatRelation）
 * 在大多数情况下使用此类型
 */
export type Relation = ChatRelation;

// ============================================================================
// 图谱数据结构
// ============================================================================

/**
 * 地理坐标
 */
export interface GeoCoordinates {
  lat: number;
  lng: number;
}

/**
 * 图谱节点（用于 ECharts 渲染）
 */
export interface GraphNode {
  id: string;
  name: string;
  category: EntityType;
  symbolSize?: number;
  value?: number;
  x?: number;
  y?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  itemStyle?: {
    color?: string;
    borderColor?: string;
    borderWidth?: number;
  };
}

/**
 * 图谱边（用于 ECharts 渲染）
 */
export interface GraphEdge {
  id?: string;
  source: string;
  target: string;
  relationType?: RelationType | string;
  value?: number;
  weight?: number;
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
export interface GraphCategory {
  name: EntityType;
  itemStyle?: {
    color?: string;
  };
}

/**
 * 图谱数据（用于 ECharts 渲染）
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  categories?: GraphCategory[];
}

// ============================================================================
// 工具函数：类型转换
// ============================================================================

/**
 * 将 ChatEntity 转换为 KnowledgeEntity
 */
export function chatEntityToKnowledgeEntity(entity: ChatEntity): KnowledgeEntity {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    description: entity.description || '',
    relevance: entity.relevance || 0.5,
    importance: entity.importance || 0.5,
    region: entity.region || '',
    period: entity.period || '',
    coordinates: entity.coordinates || { lat: 0, lng: 0 },
    images: entity.images || [],
    tags: entity.tags || [],
    created_at: entity.created_at || new Date().toISOString(),
    updated_at: entity.updated_at || new Date().toISOString(),
    metadata: entity.metadata || {},
    aliases: entity.aliases || [],
    external_ids: entity.external_ids || {},
  };
}

/**
 * 将 KnowledgeEntity 转换为 ChatEntity
 */
export function knowledgeEntityToChatEntity(entity: KnowledgeEntity): ChatEntity {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    description: entity.description,
    relevance: entity.relevance,
    importance: entity.importance,
    region: entity.region,
    period: entity.period,
    coordinates: entity.coordinates,
    images: entity.images,
    tags: entity.tags,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
    metadata: entity.metadata,
    aliases: entity.aliases,
    external_ids: entity.external_ids,
  };
}

/**
 * 将 ChatRelation 转换为 KnowledgeRelation
 */
export function chatRelationToKnowledgeRelation(relation: ChatRelation): KnowledgeRelation {
  return {
    id: relation.id || `rel_${Date.now()}`,
    source: relation.source,
    target: relation.target,
    type: relation.type,
    weight: relation.confidence || 0.5,
    metadata: {},
    created_at: new Date().toISOString(),
  };
}

/**
 * 将 KnowledgeRelation 转换为 ChatRelation
 */
export function knowledgeRelationToChatRelation(relation: KnowledgeRelation): ChatRelation {
  return {
    id: relation.id,
    source: relation.source,
    target: relation.target,
    type: relation.type,
    confidence: relation.weight,
    evidence: relation.metadata?.evidence as string | undefined,
    bidirectional: false,
  };
}

/**
 * 将 Entity 转换为 GraphNode
 */
export function entityToGraphNode(entity: ChatEntity | KnowledgeEntity): GraphNode {
  return {
    id: entity.id,
    name: entity.name,
    category: entity.type,
    symbolSize: 30 + (entity.importance || 0.5) * 20,
    value: entity.importance || 0.5,
    description: entity.description,
    metadata: entity.metadata,
    itemStyle: {
      color: undefined,
    },
  };
}

/**
 * 将 Relation 转换为 GraphEdge
 */
export function relationToGraphEdge(relation: ChatRelation | KnowledgeRelation): GraphEdge {
  return {
    source: relation.source,
    target: relation.target,
    relationType: relation.type,
    value: 'weight' in relation ? relation.weight : relation.confidence || 0.5,
    lineStyle: {
      opacity: 0.6,
      width: 2,
      curveness: 0.3,
    },
  };
}
