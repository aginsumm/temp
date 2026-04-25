import { knowledgeOfflineStorage } from '../../services/knowledgeOfflineStorage';
import type {
  KnowledgeEntityBase,
  KnowledgeEntityFull,
  KnowledgeRelationship,
  KnowledgeGraphData,
  KnowledgeSearchRequest,
  KnowledgeSearchResponse,
  FavoriteItem,
  FeedbackItem,
} from '../models';
import type { CachedEntity, CachedRelationship } from '../../services/knowledgeOfflineStorage';
import { localDatabase, STORES } from '../localDatabase';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function cachedToEntity(cached: CachedEntity): KnowledgeEntityBase {
  return {
    id: cached.id,
    name: cached.name,
    type: cached.type as KnowledgeEntityBase['type'],
    description: cached.description,
    region: cached.region,
    period: cached.period,
    coordinates: cached.coordinates,
    metadata: cached.metadata,
    importance: cached.importance,
    created_at: cached.created_at,
    updated_at: cached.updated_at,
  };
}

function entityToCached(entity: KnowledgeEntityBase): CachedEntity {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    description: entity.description,
    region: entity.region,
    period: entity.period,
    coordinates: entity.coordinates,
    metadata: entity.metadata,
    importance: entity.importance,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
    cachedAt: Date.now(),
  };
}

function cachedToRelationship(cached: CachedRelationship): KnowledgeRelationship {
  return {
    id: cached.id,
    source_id: cached.source_id,
    target_id: cached.target_id,
    relation_type: cached.relation_type,
    weight: cached.weight,
    metadata: cached.metadata,
    created_at: cached.created_at,
  };
}

function relationshipToCached(rel: KnowledgeRelationship): CachedRelationship {
  return {
    id: rel.id,
    source_id: rel.source_id,
    target_id: rel.target_id,
    relation_type: rel.relation_type,
    weight: rel.weight,
    metadata: rel.metadata,
    created_at: rel.created_at,
    cachedAt: Date.now(),
  };
}

class KnowledgeRepository {
  async initialize(): Promise<void> {
    await knowledgeOfflineStorage.init();
  }

  async getEntity(entityId: string): Promise<KnowledgeEntityBase | null> {
    const cached = await knowledgeOfflineStorage.getEntity(entityId);
    return cached ? cachedToEntity(cached) : null;
  }

  async getEntityFull(entityId: string): Promise<KnowledgeEntityFull | null> {
    const cached = await knowledgeOfflineStorage.getEntity(entityId);
    if (!cached) return null;

    const entity = cachedToEntity(cached);
    const cachedRelationships = await knowledgeOfflineStorage.getRelationshipsForEntity(entityId);
    const relationships = cachedRelationships.map(cachedToRelationship);

    const relatedIds = new Set<string>();
    relationships.forEach((rel) => {
      if (rel.source_id === entityId) relatedIds.add(rel.target_id);
      if (rel.target_id === entityId) relatedIds.add(rel.source_id);
    });

    const relatedEntities: KnowledgeEntityBase[] = [];
    for (const id of relatedIds) {
      const related = await this.getEntity(id);
      if (related) relatedEntities.push(related);
    }

    return {
      ...entity,
      relationships,
      related_entities: relatedEntities,
    };
  }

  async getAllEntities(): Promise<KnowledgeEntityBase[]> {
    const cached = await knowledgeOfflineStorage.getAllEntities();
    return cached.map(cachedToEntity);
  }

  async getEntitiesByType(type: string): Promise<KnowledgeEntityBase[]> {
    const cached = await knowledgeOfflineStorage.getEntitiesByType(type);
    return cached.map(cachedToEntity);
  }

  async saveEntity(entity: KnowledgeEntityBase): Promise<void> {
    await knowledgeOfflineStorage.saveEntity(entityToCached(entity));
  }

  async saveEntities(entities: KnowledgeEntityBase[]): Promise<void> {
    await knowledgeOfflineStorage.saveEntities(entities.map(entityToCached));
  }

  async deleteEntity(entityId: string): Promise<void> {
    await knowledgeOfflineStorage.deleteEntity(entityId);
  }

  async getRelationship(relationshipId: string): Promise<KnowledgeRelationship | null> {
    const cached = await knowledgeOfflineStorage.getAllRelationships();
    const found = cached.find((r) => r.id === relationshipId);
    return found ? cachedToRelationship(found) : null;
  }

  async getAllRelationships(): Promise<KnowledgeRelationship[]> {
    const cached = await knowledgeOfflineStorage.getAllRelationships();
    return cached.map(cachedToRelationship);
  }

  async getRelationshipsForEntity(entityId: string): Promise<KnowledgeRelationship[]> {
    const cached = await knowledgeOfflineStorage.getRelationshipsForEntity(entityId);
    return cached.map(cachedToRelationship);
  }

  async saveRelationship(relationship: KnowledgeRelationship): Promise<void> {
    await knowledgeOfflineStorage.saveRelationship(relationshipToCached(relationship));
  }

  async saveRelationships(relationships: KnowledgeRelationship[]): Promise<void> {
    await knowledgeOfflineStorage.saveRelationships(relationships.map(relationshipToCached));
  }

  async search(params: KnowledgeSearchRequest): Promise<KnowledgeSearchResponse> {
    const cached = await knowledgeOfflineStorage.searchEntitiesLocal(params.keyword || '', {
      category: params.category,
      region: params.region,
      period: params.period,
    });

    const entities = cached.map(cachedToEntity);

    const page = params.page || 1;
    const pageSize = params.page_size || 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      results: entities.slice(start, end),
      total: entities.length,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(entities.length / pageSize),
    };
  }

  async getGraphData(centerEntityId?: string, maxDepth: number = 2): Promise<KnowledgeGraphData> {
    const cachedGraph = await knowledgeOfflineStorage.getCachedGraphData();
    if (cachedGraph && !centerEntityId) {
      return cachedGraph as KnowledgeGraphData;
    }

    const entities = await this.getAllEntities();
    const relationships = await this.getAllRelationships();

    let filteredEntities = entities;
    let filteredRelationships = relationships;

    if (centerEntityId && maxDepth > 0) {
      const entitySet = new Set<string>([centerEntityId]);
      const frontier = new Set<string>([centerEntityId]);

      for (let depth = 0; depth < maxDepth; depth++) {
        const newFrontier = new Set<string>();
        for (const entityId of frontier) {
          for (const rel of relationships) {
            if (rel.source_id === entityId && !entitySet.has(rel.target_id)) {
              entitySet.add(rel.target_id);
              newFrontier.add(rel.target_id);
            }
            if (rel.target_id === entityId && !entitySet.has(rel.source_id)) {
              entitySet.add(rel.source_id);
              newFrontier.add(rel.source_id);
            }
          }
        }
        frontier.clear();
        for (const id of newFrontier) {
          frontier.add(id);
        }
      }

      filteredEntities = entities.filter((e) => entitySet.has(e.id));
      filteredRelationships = relationships.filter(
        (r) => entitySet.has(r.source_id) && entitySet.has(r.target_id)
      );
    }

    const nodes = filteredEntities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      category: entity.type,
      symbolSize: Math.max(20, Math.min(50, entity.importance * 10)),
      value: entity.importance,
    }));

    const edges = filteredRelationships.map((rel) => ({
      source: rel.source_id,
      target: rel.target_id,
      relationType: rel.relation_type,
      weight: rel.weight,
    }));

    const categories = this.extractCategories(filteredEntities);

    const graphData: KnowledgeGraphData = { nodes, edges, categories };

    if (!centerEntityId) {
      await knowledgeOfflineStorage.cacheGraphData({
        nodes: nodes as unknown as unknown[],
        edges: edges as unknown as unknown[],
        categories: categories as unknown as unknown[],
      });
    }

    return graphData;
  }

  private extractCategories(
    entities: KnowledgeEntityBase[]
  ): Array<{ name: string; itemStyle?: { color: string } }> {
    const categorySet = new Set(entities.map((e) => e.type));
    const categoryColors: Record<string, string> = {
      inheritor: '#c23531',
      technique: '#2f4554',
      work: '#61a0a8',
      pattern: '#d48265',
      region: '#91c7ae',
      period: '#749f83',
      material: '#ca8622',
    };

    return Array.from(categorySet).map((name) => ({
      name,
      itemStyle: { color: categoryColors[name] || '#546570' },
    }));
  }

  async getStats(): Promise<{
    totalEntities: number;
    totalRelationships: number;
    entitiesByType: Record<string, number>;
  }> {
    const stats = await knowledgeOfflineStorage.getStats();
    return {
      totalEntities: stats.totalEntities,
      totalRelationships: stats.totalRelationships,
      entitiesByType: stats.entitiesByType,
    };
  }

  async addFavorite(
    userId: string,
    entityId: string,
    entityType: string,
    entityName: string
  ): Promise<FavoriteItem> {
    const favorite: FavoriteItem = {
      id: generateId(),
      user_id: userId,
      entity_id: entityId,
      entity_type: entityType,
      entity_name: entityName,
      created_at: new Date().toISOString(),
    };

    await localDatabase.put(STORES.FAVORITES, favorite);
    return favorite;
  }

  async removeFavorite(userId: string, entityId: string): Promise<void> {
    const favorites = await localDatabase.getByIndex<FavoriteItem>(
      STORES.FAVORITES,
      'userId',
      userId
    );

    const favorite = favorites.find((f) => f.entity_id === entityId);
    if (favorite) {
      await localDatabase.delete(STORES.FAVORITES, favorite.id);
    }
  }

  async getFavorites(userId: string): Promise<FavoriteItem[]> {
    const favorites = await localDatabase.getByIndex<FavoriteItem>(
      STORES.FAVORITES,
      'userId',
      userId
    );
    return favorites.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async isFavorite(userId: string, entityId: string): Promise<boolean> {
    const favorites = await this.getFavorites(userId);
    return favorites.some((f) => f.entity_id === entityId);
  }

  async addFeedback(
    userId: string,
    entityId: string,
    feedbackType: string,
    content?: string,
    rating?: number
  ): Promise<FeedbackItem> {
    const feedback: FeedbackItem = {
      id: generateId(),
      user_id: userId,
      entity_id: entityId,
      feedback_type: feedbackType,
      content,
      rating,
      created_at: new Date().toISOString(),
    };

    await localDatabase.put(STORES.FEEDBACKS, feedback);
    return feedback;
  }

  async getFeedbacks(entityId: string): Promise<FeedbackItem[]> {
    const feedbacks = await localDatabase.getByIndex<FeedbackItem>(
      STORES.FEEDBACKS,
      'entityId',
      entityId
    );
    return feedbacks.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async getUserFeedbacks(userId: string): Promise<FeedbackItem[]> {
    const feedbacks = await localDatabase.getByIndex<FeedbackItem>(
      STORES.FEEDBACKS,
      'userId',
      userId
    );
    return feedbacks.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async clearAllData(): Promise<void> {
    await knowledgeOfflineStorage.clearAllData();
    await localDatabase.clear(STORES.FAVORITES);
    await localDatabase.clear(STORES.FEEDBACKS);
  }
}

export const knowledgeRepository = new KnowledgeRepository();
export default knowledgeRepository;
