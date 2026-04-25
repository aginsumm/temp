import {
  knowledgeApi,
  Entity,
  GraphData,
  SearchRequest,
  SearchResponse,
  EntityCreate,
  EntityUpdate,
  RelationshipCreate,
} from '../api/knowledge';
import {
  knowledgeOfflineStorage,
  CachedEntity,
  CachedRelationship,
  PendingOperation as StoragePendingOperation,
} from './knowledgeOfflineStorage';
import { networkStatusService } from './networkStatus';
import type { EntityType } from '../types/chat';

class KnowledgeOfflineApiService {
  private isOnline = true;
  private pendingSync = false;

  constructor() {
    networkStatusService.subscribe((status) => {
      this.isOnline = status.mode === 'online';
      if (this.isOnline && this.pendingSync) {
        this.syncPendingOperations();
      }
    });
  }

  async search(params: SearchRequest): Promise<SearchResponse> {
    if (this.isOnline) {
      try {
        const response = await knowledgeApi.search(params);
        await this.cacheSearchResults(params, response);
        return response;
      } catch (error) {
        console.warn('Online search failed, falling back to offline:', error);
        return this.searchOffline(params);
      }
    }
    return this.searchOffline(params);
  }

  private async searchOffline(params: SearchRequest): Promise<SearchResponse> {
    const entities = await knowledgeOfflineStorage.getAllEntities();
    let filtered = entities;

    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(keyword) || e.description?.toLowerCase().includes(keyword)
      );
    }

    if (params.category && params.category !== 'all') {
      filtered = filtered.filter((e) => e.type === params.category);
    }

    if (params.region && params.region.length > 0) {
      filtered = filtered.filter((e) => e.region && params.region!.includes(e.region));
    }

    if (params.period && params.period.length > 0) {
      filtered = filtered.filter((e) => e.period && params.period!.includes(e.period));
    }

    const page = params.page || 1;
    const pageSize = params.page_size || 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      results: filtered.slice(start, end).map(this.cachedEntityToEntity),
      total: filtered.length,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(filtered.length / pageSize),
    };
  }

  async getGraphData(centerEntityId?: string, maxDepth: number = 2): Promise<GraphData> {
    if (this.isOnline) {
      try {
        const response = await knowledgeApi.getGraphData(centerEntityId, maxDepth);
        await this.cacheGraphData(response, centerEntityId);
        return response;
      } catch (error) {
        console.warn('Online graph fetch failed, falling back to offline:', error);
        return this.getGraphDataOffline(centerEntityId, maxDepth);
      }
    }
    return this.getGraphDataOffline(centerEntityId, maxDepth);
  }

  private async getGraphDataOffline(
    centerEntityId?: string,
    maxDepth: number = 2
  ): Promise<GraphData> {
    const cachedGraph = await knowledgeOfflineStorage.getCachedGraphData();
    if (cachedGraph && !centerEntityId) {
      return cachedGraph as unknown as GraphData;
    }

    const entities = await knowledgeOfflineStorage.getAllEntities();
    const relationships = await knowledgeOfflineStorage.getAllRelationships();

    if (centerEntityId) {
      return this.buildSubGraph(entities, relationships, centerEntityId, maxDepth);
    }

    return this.buildFullGraph(entities, relationships);
  }

  private buildFullGraph(entities: CachedEntity[], relationships: CachedRelationship[]): GraphData {
    const nodes = entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      category: this.getCategoryLabel(entity.type),
      symbolSize: 20 + entity.importance * 30,
      value: entity.importance,
      itemStyle: { color: this.getTypeColor(entity.type) },
    }));

    const edges = relationships.map((rel) => ({
      source: rel.source_id,
      target: rel.target_id,
      relationType: rel.relation_type,
      lineStyle: { width: rel.weight || 1, curveness: 0.3, opacity: 0.6 },
    }));

    return {
      nodes: nodes as unknown as GraphData['nodes'],
      edges: edges as unknown as GraphData['edges'],
      categories: this.getCategories() as unknown as GraphData['categories'],
    };
  }

  private buildSubGraph(
    entities: CachedEntity[],
    relationships: CachedRelationship[],
    centerId: string,
    maxDepth: number
  ): GraphData {
    const visited = new Set<string>();
    const entitySet = new Set<string>();
    const queue: { id: string; depth: number }[] = [{ id: centerId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);
      entitySet.add(id);

      const relatedRels = relationships.filter((r) => r.source_id === id || r.target_id === id);

      for (const rel of relatedRels) {
        const nextId = rel.source_id === id ? rel.target_id : rel.source_id;
        if (!visited.has(nextId)) {
          queue.push({ id: nextId, depth: depth + 1 });
        }
      }
    }

    const filteredEntities = entities.filter((e) => entitySet.has(e.id));
    const filteredRels = relationships.filter(
      (r) => entitySet.has(r.source_id) && entitySet.has(r.target_id)
    );

    return this.buildFullGraph(filteredEntities, filteredRels);
  }

  async getEntity(entityId: string): Promise<Entity> {
    if (this.isOnline) {
      try {
        const response = await knowledgeApi.getEntity(entityId);
        await knowledgeOfflineStorage.saveEntity(this.entityToCached(response));
        return response;
      } catch (error) {
        console.warn('Online entity fetch failed, falling back to offline:', error);
        return this.getEntityOffline(entityId);
      }
    }
    return this.getEntityOffline(entityId);
  }

  private async getEntityOffline(entityId: string): Promise<Entity> {
    const entity = await knowledgeOfflineStorage.getEntity(entityId);
    if (!entity) {
      throw new Error('Entity not found in offline storage');
    }
    return this.cachedEntityToEntity(entity);
  }

  async createEntity(data: EntityCreate): Promise<Entity> {
    if (this.isOnline) {
      try {
        const response = await knowledgeApi.createEntity(data);
        await knowledgeOfflineStorage.saveEntity(this.entityToCached(response));
        return response;
      } catch (error) {
        console.warn('Online create failed, queuing for later:', error);
      }
    }

    const tempEntity: Entity = {
      id: `temp_${Date.now()}`,
      name: data.name || '',
      type: (data.type || 'technique') as EntityType,
      description: data.description,
      region: data.region,
      period: data.period,
      importance: data.importance || 0.5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await knowledgeOfflineStorage.saveEntity(this.entityToCached(tempEntity));
    await knowledgeOfflineStorage.addPendingOperation({
      type: 'create_entity',
      data: tempEntity,
      maxRetries: 5,
    });

    this.pendingSync = true;
    return tempEntity;
  }

  async updateEntity(entityId: string, data: Partial<Entity>): Promise<Entity> {
    if (this.isOnline) {
      try {
        const response = await knowledgeApi.updateEntity(entityId, data);
        await knowledgeOfflineStorage.saveEntity(this.entityToCached(response));
        return response;
      } catch (error) {
        console.warn('Online update failed, queuing for later:', error);
      }
    }

    const existing = await knowledgeOfflineStorage.getEntity(entityId);
    if (!existing) {
      throw new Error('Entity not found');
    }

    const updated: CachedEntity = {
      ...existing,
      ...data,
      id: entityId,
      updated_at: new Date().toISOString(),
    };

    await knowledgeOfflineStorage.saveEntity(updated);
    await knowledgeOfflineStorage.addPendingOperation({
      type: 'update_entity',
      data: { id: entityId, ...data },
      maxRetries: 5,
    });

    this.pendingSync = true;
    return this.cachedEntityToEntity(updated);
  }

  async deleteEntity(entityId: string): Promise<void> {
    if (this.isOnline) {
      try {
        await knowledgeApi.deleteEntity(entityId);
        await knowledgeOfflineStorage.deleteEntity(entityId);
        return;
      } catch (error) {
        console.warn('Online delete failed, queuing for later:', error);
      }
    }

    await knowledgeOfflineStorage.deleteEntity(entityId);
    await knowledgeOfflineStorage.addPendingOperation({
      type: 'delete_entity',
      data: { id: entityId },
      maxRetries: 5,
    });

    this.pendingSync = true;
  }

  async createRelationship(data: RelationshipCreate): Promise<CachedRelationship> {
    if (this.isOnline) {
      try {
        const response = await knowledgeApi.createRelationship(data);
        const cachedRel: CachedRelationship = {
          id: response.id || `rel_${Date.now()}`,
          source_id: data.source_id,
          target_id: data.target_id,
          relation_type: data.relation_type,
          weight: data.weight || 1,
          created_at: response.created_at || new Date().toISOString(),
          cachedAt: Date.now(),
        };
        await knowledgeOfflineStorage.saveRelationship(cachedRel);
        return cachedRel;
      } catch (error) {
        console.warn('Online create relationship failed, queuing for later:', error);
      }
    }

    const tempRel: CachedRelationship = {
      id: `temp_rel_${Date.now()}`,
      source_id: data.source_id,
      target_id: data.target_id,
      relation_type: data.relation_type,
      weight: data.weight || 1,
      created_at: new Date().toISOString(),
      cachedAt: Date.now(),
    };

    await knowledgeOfflineStorage.saveRelationship(tempRel);
    await knowledgeOfflineStorage.addPendingOperation({
      type: 'create_relationship',
      data: tempRel,
      maxRetries: 5,
    });

    this.pendingSync = true;
    return tempRel;
  }

  async syncPendingOperations(): Promise<void> {
    if (!this.isOnline) return;

    const pendingOps = await knowledgeOfflineStorage.getPendingOperations();
    if (pendingOps.length === 0) {
      this.pendingSync = false;
      return;
    }

    console.log(`Syncing ${pendingOps.length} pending operations...`);

    for (const op of pendingOps) {
      try {
        await this.executePendingOperation(op);
        await knowledgeOfflineStorage.removePendingOperation(op.id);
      } catch (error) {
        console.error(`Failed to sync operation ${op.id}:`, error);
        await knowledgeOfflineStorage.updatePendingOperationRetry(op.id, op.retryCount + 1);
      }
    }

    const remainingOps = await knowledgeOfflineStorage.getPendingOperations();
    if (remainingOps.length === 0) {
      this.pendingSync = false;
    }
  }

  private async executePendingOperation(op: StoragePendingOperation): Promise<void> {
    switch (op.type) {
      case 'create_entity':
        await knowledgeApi.createEntity(op.data as EntityCreate);
        break;
      case 'update_entity': {
        const updateData = op.data as EntityUpdate & { id?: string };
        await knowledgeApi.updateEntity(updateData.id as string, updateData as EntityUpdate);
        break;
      }
      case 'delete_entity': {
        const deleteData = op.data as { id?: string };
        await knowledgeApi.deleteEntity(deleteData.id as string);
        break;
      }
      case 'create_relationship':
        await knowledgeApi.createRelationship(op.data as RelationshipCreate);
        break;
      case 'update_relationship':
      case 'delete_relationship':
        console.warn(`Operation type ${op.type} not yet implemented`);
        break;
      default:
        console.warn(`Unknown operation type: ${op.type}`);
    }
  }

  private async cacheSearchResults(
    _params: SearchRequest,
    response: SearchResponse
  ): Promise<void> {
    for (const entity of response.results) {
      await knowledgeOfflineStorage.saveEntity(this.entityToCached(entity));
    }
  }

  private async cacheGraphData(data: GraphData, centerEntityId?: string): Promise<void> {
    await knowledgeOfflineStorage.cacheGraphData({
      nodes: data.nodes as unknown as unknown[],
      edges: data.edges as unknown as unknown[],
      categories: data.categories || [],
    });

    if (centerEntityId) {
      console.debug('Caching graph centered on:', centerEntityId);
    }

    const entityMap = new Map<string, CachedEntity>();
    for (const node of data.nodes) {
      entityMap.set(node.id, {
        id: node.id,
        name: node.name,
        type: this.getTypeFromCategory(node.category),
        importance: node.value || 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cachedAt: Date.now(),
      });
    }

    for (const entity of entityMap.values()) {
      await knowledgeOfflineStorage.saveEntity(entity);
    }

    for (const edge of data.edges) {
      await knowledgeOfflineStorage.saveRelationship({
        id: `${edge.source}_${edge.target}`,
        source_id: edge.source,
        target_id: edge.target,
        relation_type: edge.relationType || 'related',
        weight: edge.lineStyle?.width || 1,
        created_at: new Date().toISOString(),
        cachedAt: Date.now(),
      });
    }
  }

  private cachedEntityToEntity(cached: CachedEntity): Entity {
    return {
      id: cached.id,
      name: cached.name,
      type: cached.type as EntityType,
      description: cached.description,
      region: cached.region,
      period: cached.period,
      importance: cached.importance,
      created_at: cached.created_at,
      updated_at: cached.updated_at,
    };
  }

  private entityToCached(entity: Entity): CachedEntity {
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      description: entity.description,
      region: entity.region,
      period: entity.period,
      importance: entity.importance,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      cachedAt: Date.now(),
    };
  }

  private getCategoryLabel(type: string): string {
    const labels: Record<string, string> = {
      inheritor: '传承人',
      technique: '技艺',
      work: '作品',
      pattern: '纹样',
      region: '地域',
      period: '时期',
      material: '材料',
    };
    return labels[type] || type;
  }

  private getTypeFromCategory(category: string): string {
    const types: Record<string, string> = {
      传承人: 'inheritor',
      技艺: 'technique',
      作品: 'work',
      纹样: 'pattern',
      地域: 'region',
      时期: 'period',
      材料: 'material',
    };
    return types[category] || 'technique';
  }

  private getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      inheritor: '#8B5CF6',
      technique: '#10B981',
      work: '#F59E0B',
      pattern: '#EF4444',
      region: '#06B6D4',
      period: '#6366F1',
      material: '#84CC16',
    };
    return colors[type] || '#3B82F6';
  }

  private getCategories(): { name: string; itemStyle: { color: string } }[] {
    return [
      { name: '传承人', itemStyle: { color: '#8B5CF6' } },
      { name: '技艺', itemStyle: { color: '#10B981' } },
      { name: '作品', itemStyle: { color: '#F59E0B' } },
      { name: '纹样', itemStyle: { color: '#EF4444' } },
      { name: '地域', itemStyle: { color: '#06B6D4' } },
      { name: '时期', itemStyle: { color: '#6366F1' } },
      { name: '材料', itemStyle: { color: '#84CC16' } },
    ];
  }
}

export const knowledgeOfflineApi = new KnowledgeOfflineApiService();
