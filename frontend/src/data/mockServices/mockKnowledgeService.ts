import { knowledgeRepository } from '../repositories/knowledgeRepository';
import { knowledgeOfflineStorage } from '../../services/knowledgeOfflineStorage';
import type {
  KnowledgeEntityBase,
  KnowledgeEntityFull,
  KnowledgeRelationship,
  KnowledgeGraphData,
  KnowledgeSearchResponse,
} from '../models';

const MOCK_ENTITIES: KnowledgeEntityBase[] = [
  {
    id: 'entity_1',
    name: '景泰蓝制作技艺',
    type: 'technique',
    description:
      '景泰蓝是北京著名的传统手工艺品，又称"铜胎掐丝珐琅"，因其在明朝景泰年间盛行，使用的珐琅釉多以蓝色为主，故得名"景泰蓝"。',
    region: '北京',
    period: '明代',
    importance: 5,
    tags: ['金属工艺', '珐琅', '皇家工艺'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'entity_2',
    name: '张同禄',
    type: 'inheritor',
    description: '中国工艺美术大师，国家级非物质文化遗产项目景泰蓝制作技艺代表性传承人。',
    region: '北京',
    period: '当代',
    importance: 4,
    tags: ['传承人', '工艺美术大师', '景泰蓝'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'entity_3',
    name: '苏绣',
    type: 'technique',
    description:
      '苏绣是苏州地区刺绣产品的总称，以精细、雅洁著称，与湘绣、粤绣、蜀绣并称为中国四大名绣。',
    region: '江苏苏州',
    period: '春秋战国',
    importance: 5,
    tags: ['刺绣', '丝绸', '江南工艺'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'entity_4',
    name: '姚建萍',
    type: 'inheritor',
    description: '国家级非物质文化遗产项目苏绣代表性传承人，被誉为"苏绣皇后"。',
    region: '江苏苏州',
    period: '当代',
    importance: 4,
    tags: ['传承人', '苏绣', '工艺美术大师'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'entity_5',
    name: '宜兴紫砂陶制作技艺',
    type: 'technique',
    description: '宜兴紫砂陶制作技艺是江苏省宜兴市特有的传统手工制陶技艺，以紫砂壶最为著名。',
    region: '江苏宜兴',
    period: '宋代',
    importance: 5,
    tags: ['陶瓷', '紫砂', '茶文化'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'entity_6',
    name: '顾景舟',
    type: 'inheritor',
    description: '中国工艺美术大师，宜兴紫砂陶制作技艺代表性传承人，被誉为"壶艺泰斗"。',
    region: '江苏宜兴',
    period: '当代',
    importance: 4,
    tags: ['传承人', '紫砂', '工艺美术大师'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'entity_7',
    name: '龙泉青瓷烧制技艺',
    type: 'technique',
    description: '龙泉青瓷是中国传统瓷器的一种，以浙江省龙泉市为产地，以粉青、梅子青等釉色著称。',
    region: '浙江龙泉',
    period: '五代',
    importance: 5,
    tags: ['陶瓷', '青瓷', '釉色'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'entity_8',
    name: '徐朝兴',
    type: 'inheritor',
    description: '国家级非物质文化遗产项目龙泉青瓷烧制技艺代表性传承人，中国工艺美术大师。',
    region: '浙江龙泉',
    period: '当代',
    importance: 4,
    tags: ['传承人', '青瓷', '工艺美术大师'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const MOCK_RELATIONSHIPS: KnowledgeRelationship[] = [
  {
    id: 'rel_1',
    source_id: 'entity_2',
    target_id: 'entity_1',
    relation_type: 'inherits',
    weight: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'rel_2',
    source_id: 'entity_4',
    target_id: 'entity_3',
    relation_type: 'inherits',
    weight: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'rel_3',
    source_id: 'entity_6',
    target_id: 'entity_5',
    relation_type: 'inherits',
    weight: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'rel_4',
    source_id: 'entity_8',
    target_id: 'entity_7',
    relation_type: 'inherits',
    weight: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'rel_5',
    source_id: 'entity_1',
    target_id: 'entity_5',
    relation_type: 'related_to',
    weight: 0.5,
    created_at: new Date().toISOString(),
  },
  {
    id: 'rel_6',
    source_id: 'entity_3',
    target_id: 'entity_7',
    relation_type: 'related_to',
    weight: 0.5,
    created_at: new Date().toISOString(),
  },
];

const CATEGORIES = [
  { value: 'inheritor', label: '传承人', color: '#c23531' },
  { value: 'technique', label: '技艺', color: '#2f4554' },
  { value: 'work', label: '作品', color: '#61a0a8' },
  { value: 'pattern', label: '纹样', color: '#d48265' },
  { value: 'region', label: '地区', color: '#91c7ae' },
  { value: 'period', label: '时期', color: '#749f83' },
  { value: 'material', label: '材料', color: '#ca8622' },
];

class MockKnowledgeService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await knowledgeRepository.initialize();

    const existingEntities = await knowledgeRepository.getAllEntities();
    if (existingEntities.length === 0) {
      await knowledgeRepository.saveEntities(MOCK_ENTITIES);
      await knowledgeRepository.saveRelationships(MOCK_RELATIONSHIPS);
    }

    this.initialized = true;
  }

  async getEntity(entityId: string): Promise<KnowledgeEntityBase | null> {
    await this.initialize();
    return knowledgeRepository.getEntity(entityId);
  }

  async getEntityFull(entityId: string): Promise<KnowledgeEntityFull | null> {
    await this.initialize();
    return knowledgeRepository.getEntityFull(entityId);
  }

  async getEntityDetail(entityId: string): Promise<{
    entity: KnowledgeEntityBase;
    relationships: KnowledgeRelationship[];
    related_entities: KnowledgeEntityBase[];
  } | null> {
    await this.initialize();
    const entity = await knowledgeRepository.getEntity(entityId);
    if (!entity) return null;

    const relationships = await knowledgeRepository.getRelationshipsForEntity(entityId);
    const relatedIds = new Set<string>();
    relationships.forEach((rel) => {
      if (rel.source_id === entityId) relatedIds.add(rel.target_id);
      if (rel.target_id === entityId) relatedIds.add(rel.source_id);
    });

    const relatedEntities: KnowledgeEntityBase[] = [];
    for (const id of relatedIds) {
      const related = await knowledgeRepository.getEntity(id);
      if (related) relatedEntities.push(related);
    }

    return { entity, relationships, related_entities: relatedEntities };
  }

  async getEntityRelations(entityId: string): Promise<KnowledgeRelationship[]> {
    await this.initialize();
    return knowledgeRepository.getRelationshipsForEntity(entityId);
  }

  async getAllEntities(): Promise<KnowledgeEntityBase[]> {
    await this.initialize();
    return knowledgeRepository.getAllEntities();
  }

  async getEntitiesByType(type: string): Promise<KnowledgeEntityBase[]> {
    await this.initialize();
    return knowledgeRepository.getEntitiesByType(type);
  }

  async search(
    keyword?: string,
    filters?: { category?: string; region?: string[]; period?: string[] },
    page: number = 1,
    pageSize: number = 20
  ): Promise<KnowledgeSearchResponse> {
    await this.initialize();
    return knowledgeRepository.search({
      keyword,
      category: filters?.category,
      region: filters?.region,
      period: filters?.period,
      page,
      page_size: pageSize,
    });
  }

  async getGraphData(centerEntityId?: string, maxDepth: number = 2): Promise<KnowledgeGraphData> {
    await this.initialize();
    return knowledgeRepository.getGraphData(centerEntityId, maxDepth);
  }

  async getRelationships(): Promise<KnowledgeRelationship[]> {
    await this.initialize();
    return knowledgeRepository.getAllRelationships();
  }

  async getRelationshipsForEntity(entityId: string): Promise<KnowledgeRelationship[]> {
    await this.initialize();
    return knowledgeRepository.getRelationshipsForEntity(entityId);
  }

  async getStats(): Promise<{
    total_entities: number;
    total_relationships: number;
    entities_by_type: Record<string, number>;
    relationships_by_type: Record<string, number>;
    top_entities: Array<{ id: string; name: string; type: string; importance: number }>;
  }> {
    await this.initialize();
    const stats = await knowledgeRepository.getStats();
    const relationships = await knowledgeRepository.getAllRelationships();

    const relationships_by_type: Record<string, number> = {};
    relationships.forEach((rel) => {
      relationships_by_type[rel.relation_type] =
        (relationships_by_type[rel.relation_type] || 0) + 1;
    });

    const entities = await knowledgeRepository.getAllEntities();
    const top_entities = entities
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 10)
      .map((e) => ({ id: e.id, name: e.name, type: e.type, importance: e.importance }));

    return {
      total_entities: stats.totalEntities,
      total_relationships: stats.totalRelationships,
      entities_by_type: stats.entitiesByType,
      relationships_by_type,
      top_entities,
    };
  }

  async createEntity(entity: Partial<KnowledgeEntityBase>): Promise<KnowledgeEntityBase> {
    await this.initialize();
    const newEntity: KnowledgeEntityBase = {
      id: `entity_${Date.now()}`,
      name: entity.name || '新实体',
      type: entity.type || 'technique',
      description: entity.description,
      region: entity.region,
      period: entity.period,
      coordinates: entity.coordinates,
      metadata: entity.metadata,
      importance: entity.importance || 3,
      images: entity.images,
      tags: entity.tags,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await knowledgeRepository.saveEntity(newEntity);
    return newEntity;
  }

  async updateEntity(
    entityId: string,
    data: Partial<KnowledgeEntityBase>
  ): Promise<KnowledgeEntityBase | null> {
    await this.initialize();
    const existing = await knowledgeRepository.getEntity(entityId);
    if (!existing) return null;

    const updated: KnowledgeEntityBase = {
      ...existing,
      ...data,
      id: entityId,
      updated_at: new Date().toISOString(),
    };
    await knowledgeRepository.saveEntity(updated);
    return updated;
  }

  async deleteEntity(entityId: string): Promise<{ success: boolean }> {
    await this.initialize();
    await knowledgeRepository.deleteEntity(entityId);
    return { success: true };
  }

  async createRelationship(
    relationship: Partial<KnowledgeRelationship>
  ): Promise<KnowledgeRelationship> {
    await this.initialize();
    const newRelationship: KnowledgeRelationship = {
      id: `rel_${Date.now()}`,
      source_id: relationship.source_id || '',
      target_id: relationship.target_id || '',
      relation_type: relationship.relation_type || 'related_to',
      weight: relationship.weight || 1,
      metadata: relationship.metadata,
      created_at: new Date().toISOString(),
    };
    await knowledgeRepository.saveRelationship(newRelationship);
    return newRelationship;
  }

  async updateRelationship(
    relationshipId: string,
    data: Partial<KnowledgeRelationship>
  ): Promise<KnowledgeRelationship | null> {
    await this.initialize();
    const existing = await knowledgeRepository.getRelationship(relationshipId);
    if (!existing) return null;

    const updated: KnowledgeRelationship = {
      ...existing,
      ...data,
      id: relationshipId,
    };
    await knowledgeRepository.saveRelationship(updated);
    return updated;
  }

  async deleteRelationship(relationshipId: string): Promise<{ success: boolean }> {
    await this.initialize();
    const relationships = await knowledgeRepository.getAllRelationships();
    const rel = relationships.find((r) => r.id === relationshipId);
    if (rel) {
      await knowledgeOfflineStorage.deleteEntity(relationshipId);
    }
    return { success: true };
  }

  async findPath(
    sourceId: string,
    targetId: string,
    maxDepth: number = 3
  ): Promise<{
    paths: string[][];
    entities: KnowledgeEntityBase[];
  }> {
    await this.initialize();
    const entities = await knowledgeRepository.getAllEntities();
    const relationships = await knowledgeRepository.getAllRelationships();

    const adjacencyList = new Map<string, Set<string>>();
    relationships.forEach((rel) => {
      if (!adjacencyList.has(rel.source_id)) adjacencyList.set(rel.source_id, new Set());
      if (!adjacencyList.has(rel.target_id)) adjacencyList.set(rel.target_id, new Set());
      adjacencyList.get(rel.source_id)!.add(rel.target_id);
      adjacencyList.get(rel.target_id)!.add(rel.source_id);
    });

    const paths: string[][] = [];
    const visited = new Set<string>();
    const queue: { nodeId: string; path: string[] }[] = [{ nodeId: sourceId, path: [sourceId] }];

    while (queue.length > 0 && paths.length < 5) {
      const { nodeId, path } = queue.shift()!;
      if (path.length > maxDepth + 1) continue;
      if (nodeId === targetId) {
        paths.push(path);
        continue;
      }
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const neighbors = adjacencyList.get(nodeId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!path.includes(neighbor)) {
            queue.push({ nodeId: neighbor, path: [...path, neighbor] });
          }
        }
      }
    }

    const pathEntityIds = new Set(paths.flat());
    const pathEntities = entities.filter((e) => pathEntityIds.has(e.id));

    return { paths, entities: pathEntities };
  }

  getCategories(): { value: string; label: string; color: string }[] {
    return CATEGORIES;
  }

  async getRegions(): Promise<string[]> {
    await this.initialize();
    const entities = await knowledgeRepository.getAllEntities();
    const regions = new Set(entities.map((e) => e.region).filter(Boolean));
    return Array.from(regions) as string[];
  }

  async getPeriods(): Promise<string[]> {
    await this.initialize();
    const entities = await knowledgeRepository.getAllEntities();
    const periods = new Set(entities.map((e) => e.period).filter(Boolean));
    return Array.from(periods) as string[];
  }

  async getSearchHistory(limit: number = 20): Promise<
    Array<{
      id: string;
      keyword: string;
      filters: { category?: string; region?: string[]; period?: string[] };
      result_count: number;
      created_at: string;
    }>
  > {
    const history = await knowledgeOfflineStorage.getSearchHistory(limit);
    return history.map((h) => ({
      id: h.id,
      keyword: h.keyword,
      filters: h.filters,
      result_count: h.resultCount,
      created_at: new Date(h.timestamp).toISOString(),
    }));
  }

  async saveSearchHistory(
    keyword: string,
    filters: { category?: string; region?: string[]; period?: string[] },
    resultCount: number
  ): Promise<void> {
    await knowledgeOfflineStorage.saveSearchHistory({ keyword, filters, resultCount });
  }

  async clearSearchHistory(): Promise<void> {
    await knowledgeOfflineStorage.clearSearchHistory();
  }

  async exportData(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    await this.initialize();
    const entities = await knowledgeRepository.getAllEntities();
    const relationships = await knowledgeRepository.getAllRelationships();

    if (format === 'json') {
      const data = JSON.stringify({ entities, relationships }, null, 2);
      return new Blob([data], { type: 'application/json' });
    } else {
      const csvEntities = entities
        .map(
          (e) =>
            `${e.id},${e.name},${e.type},${e.description || ''},${e.region || ''},${e.period || ''}`
        )
        .join('\n');
      return new Blob([csvEntities], { type: 'text/csv' });
    }
  }

  async importData(
    data: Record<string, unknown>
  ): Promise<{ success: boolean; imported: number; errors: string[] }> {
    await this.initialize();
    const errors: string[] = [];
    let imported = 0;

    try {
      const entities = (data.entities as KnowledgeEntityBase[]) || [];
      const relationships = (data.relationships as KnowledgeRelationship[]) || [];

      for (const entity of entities) {
        try {
          await knowledgeRepository.saveEntity(entity);
          imported++;
        } catch (e) {
          errors.push(`Failed to import entity ${entity.id}: ${e}`);
        }
      }

      for (const rel of relationships) {
        try {
          await knowledgeRepository.saveRelationship(rel);
          imported++;
        } catch (e) {
          errors.push(`Failed to import relationship ${rel.id}: ${e}`);
        }
      }
    } catch (e) {
      errors.push(`Import failed: ${e}`);
    }

    return { success: errors.length === 0, imported, errors };
  }
}

export const mockKnowledgeService = new MockKnowledgeService();
export default mockKnowledgeService;
