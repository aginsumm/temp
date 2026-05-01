/**
 * 统一的图谱数据转换工具
 * 为 Chat 和 Knowledge 模块提供一致的图谱数据转换功能
 */

import type {
  Entity,
  Relation,
  EntityType,
  RelationType,
  GraphData,
  GraphNode,
  GraphEdge,
} from '../types/graph';
import { CATEGORY_COLORS } from '../constants/categories';

const VALID_ENTITY_TYPES: readonly EntityType[] = [
  'inheritor',
  'technique',
  'work',
  'pattern',
  'region',
  'period',
  'material',
];

/** 与关系抽取里「实体名称」对齐：去空白、书名号，便于和列表中的 name 匹配 */
function normalizeNameKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[《》「」『』"'“”‘’]/g, '');
}

function normalizeEntityType(t: unknown): EntityType {
  if (typeof t !== 'string') return 'technique';
  let s = t.trim().toLowerCase();
  if (s.startsWith('entitytype.')) s = s.slice('entitytype.'.length);
  return VALID_ENTITY_TYPES.includes(s as EntityType) ? (s as EntityType) : 'technique';
}

function stableFallbackEntityId(name: string, type: string, index: number): string {
  const s = `${name}\0${type}\0${index}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `ent_${Math.abs(h).toString(36)}`;
}

/** 丢弃无效项并补齐 id/type，避免 dedupe / ECharts 因缺字段抛错 */
function sanitizeEntitiesForGraph(entities: Entity[]): Entity[] {
  const raw = Array.isArray(entities) ? entities : [];
  return raw
    .map((e, index) => {
      if (!e || typeof e !== 'object') return null;
      const name =
        typeof e.name === 'string' ? e.name.trim() : String((e as { name?: unknown }).name ?? '').trim();
      if (!name) return null;
      const idRaw = typeof e.id === 'string' ? e.id.trim() : '';
      const id = idRaw || stableFallbackEntityId(name, String((e as Entity).type ?? ''), index);
      const type = normalizeEntityType((e as Entity).type);
      return { ...e, id, name, type } as Entity;
    })
    .filter((e): e is Entity => e !== null);
}

/**
 * 获取实体颜色（统一使用 CSS 变量）
 */
export function getEntityColor(type: EntityType): string {
  return CATEGORY_COLORS[type] || 'var(--color-text-muted)';
}

/**
 * 获取关系颜色（基于关系类型）
 */
export function getRelationColor(type: RelationType | string): string {
  const colors: Record<string, string> = {
    inherits: 'var(--color-primary)',
    origin: 'var(--color-secondary)',
    creates: 'var(--color-accent)',
    flourished_in: 'var(--color-info)',
    located_in: 'var(--color-success)',
    uses_material: 'var(--color-warning)',
    has_pattern: 'var(--color-error)',
    related_to: 'var(--color-text-muted)',
    influenced_by: 'var(--color-primary-hover)',
    contains: 'var(--color-secondary-hover)',
  };
  return colors[type] || 'var(--color-border)';
}

/**
 * 计算节点大小（基于重要性/相关性）
 */
export function calculateNodeSize(relevance: number, minSize = 20, maxSize = 50): number {
  return minSize + (maxSize - minSize) * Math.min(1, Math.max(0, relevance));
}

/**
 * 实体去重和合并
 * 基于名称和类型合并相同实体，保留最高的 relevance/importance
 */
function deduplicateEntities(entities: Entity[]): Entity[] {
  const entityMap = new Map<string, Entity>();

  entities.forEach((entity) => {
    if (!entity || typeof entity.name !== 'string' || !entity.name.trim()) {
      return;
    }
    const key = `${entity.name.toLowerCase().trim()}_${entity.type}`;
    const existing = entityMap.get(key);

    if (!existing) {
      entityMap.set(key, entity);
    } else {
      // 合并：保留更高的 relevance/importance
      if (entity.description && !existing.description) {
        existing.description = entity.description;
      }
      if (entity.relevance && (!existing.relevance || entity.relevance > existing.relevance)) {
        existing.relevance = entity.relevance;
      }
      if (entity.importance && (!existing.importance || entity.importance > existing.importance)) {
        existing.importance = entity.importance;
      }
      // 合并 metadata
      if (entity.metadata) {
        existing.metadata = { ...existing.metadata, ...entity.metadata };
      }
    }
  });

  return Array.from(entityMap.values());
}

/**
 * 关系去重和合并
 * 基于 source-target-type 合并相同关系
 */
function deduplicateRelations(relations: Relation[]): Relation[] {
  const relationMap = new Map<string, Relation>();

  relations.forEach((relation) => {
    if (!relation || typeof relation !== 'object') {
      return;
    }
    const srcRaw = (relation as { source?: unknown }).source;
    const tgtRaw = (relation as { target?: unknown }).target;
    const source = srcRaw != null ? String(srcRaw).trim() : '';
    const target = tgtRaw != null ? String(tgtRaw).trim() : '';
    if (!source || !target) {
      return;
    }
    const relType =
      typeof relation.type === 'string' && relation.type.trim() ? relation.type : 'related_to';
    const key = `${source}_${target}_${relType}`;
    const existing = relationMap.get(key);

    const normalized = { ...relation, source, target } as Relation;
    if (!existing) {
      relationMap.set(key, normalized);
    } else {
      // 合并：保留更高的 confidence
      if (
        relation.confidence &&
        (!existing.confidence || relation.confidence > existing.confidence)
      ) {
        existing.confidence = relation.confidence;
      }
    }
  });

  return Array.from(relationMap.values());
}

/**
 * 将 Entity 和 Relation 转换为统一的 GraphData
 * 这是主函数，两个模块都应该使用这个函数
 */
export function entitiesToGraphData(
  entities: Entity[],
  relations: Relation[] = [],
  options?: {
    maxNodes?: number;
    minRelevance?: number;
  }
): GraphData {
  const safeEntities = sanitizeEntitiesForGraph(entities);
  const safeRelations = Array.isArray(relations) ? relations : [];

  // 先去重
  const uniqueEntities = deduplicateEntities(safeEntities);
  const uniqueRelations = deduplicateRelations(safeRelations);

  // 过滤实体（相关性）；maxNodes 只决定「种子」节点，边上涉及的端点会并进来，避免截断后解析不到 id 导致连线全丢
  let relevanceFiltered = uniqueEntities;

  if (options?.minRelevance) {
    relevanceFiltered = uniqueEntities.filter((e) => (e.relevance || 1) >= options.minRelevance!);
  }

  let seedEntities = relevanceFiltered;
  if (options?.maxNodes && relevanceFiltered.length > options.maxNodes) {
    seedEntities = [...relevanceFiltered]
      .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
      .slice(0, options.maxNodes);
  }

  // 转换节点（先占位，下面根据边补全 displayEntities 后再生成）
  const buildNodes = (displayEntities: Entity[]): GraphNode[] =>
    displayEntities.map((entity) => {
      // 优先使用 importance 字段（Knowledge 模块），否则使用 relevance（Chat 模块）
      const relevance = entity.importance ?? entity.relevance ?? 0.5;
      const descRaw = entity.description;
      const description =
        typeof descRaw === 'string'
          ? descRaw
          : descRaw != null && typeof descRaw !== 'object'
            ? String(descRaw)
            : undefined;

      const node: GraphNode = {
        id: entity.id,
        name: entity.name,
        category: entity.type,
        symbolSize: calculateNodeSize(relevance),
        value: relevance,
        description,
        metadata: entity.metadata,
        itemStyle: {
          color: getEntityColor(entity.type),
          borderColor: 'var(--color-border)',
          borderWidth: 2,
        },
      };

      // 合并 Knowledge 模块的额外字段到 metadata
      const metadataUpdates: Record<string, unknown> = {};
      if (entity.region) {
        metadataUpdates.region = entity.region;
      }
      if (entity.period) {
        metadataUpdates.period = entity.period;
      }
      if (entity.coordinates) {
        metadataUpdates.coordinates = entity.coordinates;
      }
      if (Object.keys(metadataUpdates).length > 0) {
        node.metadata = { ...node.metadata, ...metadataUpdates };
      }

      return node;
    });

  // 转换关系（source/target 既可能是实体 id，也可能是与实体 name 一致的引用）
  const edges: GraphEdge[] = [];
  const entityIds = new Set(relevanceFiltered.map((e) => e.id));
  const nameToId = new Map<string, string>();
  relevanceFiltered.forEach((e) => {
    const k = normalizeNameKey(e.name);
    if (k && !nameToId.has(k)) {
      nameToId.set(k, e.id);
    }
    const loose = e.name.trim().toLowerCase();
    if (loose && !nameToId.has(loose)) {
      nameToId.set(loose, e.id);
    }
  });

  const resolveRelationEndpoint = (ref: string): string | null => {
    const trimmed = ref?.trim() ?? '';
    if (!trimmed) return null;
    if (entityIds.has(trimmed)) return trimmed;

    const nk = normalizeNameKey(trimmed);
    const byNorm = nk ? nameToId.get(nk) : undefined;
    if (byNorm) return byNorm;

    const loose = trimmed.toLowerCase();
    const byLoose = nameToId.get(loose);
    if (byLoose) return byLoose;

    // 弱匹配：LLM 端点名略长/略短时仍尽量挂边（避免「很多点只有一条线」全是解析丢边）
    if (nk.length >= 2) {
      for (const e of relevanceFiltered) {
        const ek = normalizeNameKey(e.name);
        if (!ek) continue;
        if (ek.includes(nk) || nk.includes(ek)) {
          const ratio = Math.min(ek.length, nk.length) / Math.max(ek.length, nk.length);
          if (ratio >= 0.45) return e.id;
        }
      }
    }

    return null;
  };

  uniqueRelations.forEach((relation, index) => {
    const src = resolveRelationEndpoint(String(relation.source ?? ''));
    const tgt = resolveRelationEndpoint(String(relation.target ?? ''));
    if (src && tgt) {
      const relTypeStr =
        typeof relation.type === 'string' && relation.type.trim() ? relation.type : 'related_to';
      edges.push({
        id: relation.id || `edge_${index}`,
        source: src,
        target: tgt,
        relationType: relTypeStr,
        value: relation.confidence || 0.5,
        lineStyle: {
          color: getRelationColor(relTypeStr),
          width: Math.max(1, (relation.confidence || 0.5) * 3),
          curveness: 0.3,
          opacity: 0.6,
        },
      });
    }
  });

  const displayIds = new Set(seedEntities.map((e) => e.id));
  for (const ed of edges) {
    displayIds.add(String(ed.source));
    displayIds.add(String(ed.target));
  }
  const displayEntities = relevanceFiltered.filter((e) => displayIds.has(e.id));
  const nodes = buildNodes(displayEntities);

  // 生成分类
  const categories = getCategories(displayEntities);

  return { nodes, edges, categories };
}

/**
 * 获取分类信息
 */
function getCategories(entities: Entity[]): GraphData['categories'] {
  const typeSet = new Set<EntityType>(entities.map((e) => e.type));
  return Array.from(typeSet).map((type) => ({
    name: type,
    baseColor: getEntityColor(type),
    itemStyle: {
      color: getEntityColor(type),
    },
  }));
}

/**
 * 过滤图谱数据
 */
export function filterGraphData(
  data: GraphData,
  filter: {
    entityTypes?: EntityType[];
    relationTypes?: (RelationType | string)[];
    minConfidence?: number;
    searchQuery?: string;
  }
): GraphData {
  let filteredNodes = [...data.nodes];
  let filteredEdges = [...data.edges];

  // 按实体类型过滤
  if (filter.entityTypes && filter.entityTypes.length > 0) {
    filteredNodes = filteredNodes.filter((n) => filter.entityTypes!.includes(n.category));
  }

  // 按搜索查询过滤
  if (filter.searchQuery) {
    const query = filter.searchQuery.toLowerCase();
    filteredNodes = filteredNodes.filter(
      (n) => n.name.toLowerCase().includes(query) || n.description?.toLowerCase().includes(query)
    );
  }

  // 确保边的节点都在过滤后的节点中
  const nodeIds = new Set(filteredNodes.map((n) => n.id));
  filteredEdges = filteredEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  // 按关系类型过滤
  if (filter.relationTypes && filter.relationTypes.length > 0) {
    filteredEdges = filteredEdges.filter((e) => filter.relationTypes!.includes(e.relationType!));
  }

  // 按置信度过滤
  if (filter.minConfidence) {
    filteredEdges = filteredEdges.filter((e) => (e.value || 1) >= filter.minConfidence!);
  }

  // 重新生成分类
  const categories = getCategories(
    filteredNodes.map(
      (n) =>
        ({
          id: n.id,
          name: n.name,
          type: n.category,
          description: n.description,
          relevance: n.value,
          metadata: n.metadata,
        }) as Entity
    )
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    categories,
  };
}

/**
 * 合并多个图谱数据
 */
export function mergeGraphData(...graphs: GraphData[]): GraphData {
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
    .filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i);

  return {
    nodes: Array.from(nodeMap.values()),
    edges: mergedEdges,
    categories: allCategories,
  };
}

/**
 * 计算图谱统计信息
 */
export function calculateGraphStats(data: GraphData): {
  nodeCount: number;
  edgeCount: number;
  categoryCount: number;
  avgNodeDegree: number;
  density: number;
} {
  const nodeCount = data.nodes.length;
  const edgeCount = data.edges.length;
  const categoryCount = (data.categories || []).length;

  // 计算节点度数
  const degrees = new Map<string, number>();
  data.nodes.forEach((node) => {
    degrees.set(node.id, 0);
  });

  data.edges.forEach((edge) => {
    degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
  });

  const avgNodeDegree =
    degrees.size > 0 ? Array.from(degrees.values()).reduce((a, b) => a + b, 0) / degrees.size : 0;

  // 计算图密度
  const maxEdges = (nodeCount * (nodeCount - 1)) / 2;
  const density = maxEdges > 0 ? edgeCount / maxEdges : 0;

  return {
    nodeCount,
    edgeCount,
    categoryCount,
    avgNodeDegree,
    density,
  };
}

/**
 * 获取与指定节点相连的节点（指定深度）
 */
export function getConnectedNodes(data: GraphData, nodeId: string, depth: number = 1): GraphData {
  const connectedNodeIds = new Set<string>([nodeId]);
  const connectedEdges: GraphEdge[] = [];

  // BFS 查找连接的节点
  let currentDepth = 0;
  let frontier = [nodeId];

  while (currentDepth < depth && frontier.length > 0) {
    const nextFrontier: string[] = [];

    data.edges.forEach((edge) => {
      if (frontier.includes(edge.source) && !connectedNodeIds.has(edge.target)) {
        connectedNodeIds.add(edge.target);
        nextFrontier.push(edge.target);
        connectedEdges.push(edge);
      } else if (frontier.includes(edge.target) && !connectedNodeIds.has(edge.source)) {
        connectedNodeIds.add(edge.source);
        nextFrontier.push(edge.source);
        connectedEdges.push(edge);
      } else if (connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target)) {
        if (!connectedEdges.includes(edge)) {
          connectedEdges.push(edge);
        }
      }
    });

    frontier = nextFrontier;
    currentDepth++;
  }

  const connectedNodes = data.nodes.filter((n) => connectedNodeIds.has(n.id));
  const categories = getCategories(
    connectedNodes.map(
      (n) =>
        ({
          id: n.id,
          name: n.name,
          type: n.category,
          description: n.description,
          relevance: n.value,
          metadata: n.metadata,
        }) as Entity
    )
  );

  return {
    nodes: connectedNodes,
    edges: connectedEdges,
    categories,
  };
}

/**
 * 获取 Top K 个重要节点
 */
export function getTopKNodes(data: GraphData, k: number): GraphData {
  if (data.nodes.length <= k) {
    return data;
  }

  // 计算节点重要性分数（结合 value 和度数）
  const degrees = new Map<string, number>();
  data.nodes.forEach((node) => {
    degrees.set(node.id, 0);
  });

  data.edges.forEach((edge) => {
    degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
  });

  const scoredNodes = data.nodes.map((node) => ({
    node,
    score:
      (node.value || 0.5) * 0.6 +
      ((degrees.get(node.id) || 0) / Math.max(1, data.edges.length)) * 0.4,
  }));

  scoredNodes.sort((a, b) => b.score - a.score);

  const topKNodes = scoredNodes.slice(0, k).map((item) => item.node);
  const topKNodeIds = new Set(topKNodes.map((n) => n.id));

  const topKEdges = data.edges.filter(
    (edge) => topKNodeIds.has(edge.source) && topKNodeIds.has(edge.target)
  );

  const categories = getCategories(
    topKNodes.map(
      (n) =>
        ({
          id: n.id,
          name: n.name,
          type: n.category,
          description: n.description,
          relevance: n.value,
          metadata: n.metadata,
        }) as Entity
    )
  );

  return {
    nodes: topKNodes,
    edges: topKEdges,
    categories,
  };
}
