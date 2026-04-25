import type { EntityCreate, RelationshipCreate, EntityUpdate } from '../api/knowledge';

const DB_NAME = 'KnowledgeGraphDB';
const DB_VERSION = 1;

const STORES = {
  ENTITIES: 'entities',
  RELATIONSHIPS: 'relationships',
  GRAPH_CACHE: 'graphCache',
  SEARCH_HISTORY: 'searchHistory',
  PENDING_OPERATIONS: 'pendingOperations',
};

export interface CachedEntity {
  id: string;
  name: string;
  type: string;
  description?: string;
  region?: string;
  period?: string;
  coordinates?: { lat: number; lng: number };
  metadata?: Record<string, unknown>;
  importance: number;
  created_at: string;
  updated_at: string;
  cachedAt: number;
}

export interface CachedRelationship {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  weight: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  cachedAt: number;
}

export interface GraphCacheData {
  id: string;
  data: {
    nodes: unknown[];
    edges: unknown[];
    categories: unknown[];
  };
  cachedAt: number;
  expiresAt: number;
}

export interface SearchHistoryItem {
  id: string;
  keyword: string;
  filters: {
    category?: string;
    region?: string[];
    period?: string[];
  };
  timestamp: number;
  resultCount: number;
}

export interface PendingOperation {
  id: string;
  type:
    | 'create_entity'
    | 'update_entity'
    | 'delete_entity'
    | 'create_relationship'
    | 'update_relationship'
    | 'delete_relationship';
  data: EntityCreate | EntityUpdate | RelationshipCreate | { id?: string };
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class KnowledgeOfflineStorageService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open KnowledgeGraphDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('KnowledgeGraphDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.ENTITIES)) {
          const entityStore = db.createObjectStore(STORES.ENTITIES, { keyPath: 'id' });
          entityStore.createIndex('type', 'type', { unique: false });
          entityStore.createIndex('region', 'region', { unique: false });
          entityStore.createIndex('period', 'period', { unique: false });
          entityStore.createIndex('importance', 'importance', { unique: false });
          entityStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.RELATIONSHIPS)) {
          const relStore = db.createObjectStore(STORES.RELATIONSHIPS, { keyPath: 'id' });
          relStore.createIndex('source_id', 'source_id', { unique: false });
          relStore.createIndex('target_id', 'target_id', { unique: false });
          relStore.createIndex('relation_type', 'relation_type', { unique: false });
          relStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.GRAPH_CACHE)) {
          const cacheStore = db.createObjectStore(STORES.GRAPH_CACHE, { keyPath: 'id' });
          cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.SEARCH_HISTORY)) {
          const historyStore = db.createObjectStore(STORES.SEARCH_HISTORY, { keyPath: 'id' });
          historyStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.PENDING_OPERATIONS)) {
          const pendingStore = db.createObjectStore(STORES.PENDING_OPERATIONS, { keyPath: 'id' });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
          pendingStore.createIndex('type', 'type', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  async saveEntity(entity: CachedEntity): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.ENTITIES, 'readwrite');
      const data = { ...entity, cachedAt: Date.now() };
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveEntities(entities: CachedEntity[]): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.ENTITIES, 'readwrite');
      const store = transaction.objectStore(STORES.ENTITIES);
      const now = Date.now();

      entities.forEach((entity) => {
        store.put({ ...entity, cachedAt: now });
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getEntity(id: string): Promise<CachedEntity | null> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.ENTITIES);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllEntities(): Promise<CachedEntity[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.ENTITIES);
      const request = store.getAll();
      request.onsuccess = () => {
        const entities = request.result || [];
        entities.sort((a, b) => b.importance - a.importance);
        resolve(entities);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getEntitiesByType(type: string): Promise<CachedEntity[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.ENTITIES);
      const index = store.index('type');
      const request = index.getAll(type);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteEntity(id: string): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [STORES.ENTITIES, STORES.RELATIONSHIPS],
        'readwrite'
      );

      const entityStore = transaction.objectStore(STORES.ENTITIES);
      entityStore.delete(id);

      const relStore = transaction.objectStore(STORES.RELATIONSHIPS);
      const sourceIndex = relStore.index('source_id');
      const targetIndex = relStore.index('target_id');

      const deleteRelated = (index: IDBIndex) => {
        const keysRequest = index.getAllKeys(id);
        keysRequest.onsuccess = () => {
          keysRequest.result.forEach((key) => relStore.delete(key));
        };
      };

      deleteRelated(sourceIndex);
      deleteRelated(targetIndex);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveRelationship(relationship: CachedRelationship): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.RELATIONSHIPS, 'readwrite');
      const data = { ...relationship, cachedAt: Date.now() };
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveRelationships(relationships: CachedRelationship[]): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.RELATIONSHIPS, 'readwrite');
      const store = transaction.objectStore(STORES.RELATIONSHIPS);
      const now = Date.now();

      relationships.forEach((rel) => {
        store.put({ ...rel, cachedAt: now });
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAllRelationships(): Promise<CachedRelationship[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.RELATIONSHIPS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getRelationshipsForEntity(entityId: string): Promise<CachedRelationship[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.RELATIONSHIPS);
      const sourceIndex = store.index('source_id');
      const targetIndex = store.index('target_id');

      const results: CachedRelationship[] = [];

      const sourceRequest = sourceIndex.getAll(entityId);
      sourceRequest.onsuccess = () => {
        results.push(...(sourceRequest.result || []));

        const targetRequest = targetIndex.getAll(entityId);
        targetRequest.onsuccess = () => {
          results.push(...(targetRequest.result || []));
          resolve(results);
        };
        targetRequest.onerror = () => reject(targetRequest.error);
      };
      sourceRequest.onerror = () => reject(sourceRequest.error);
    });
  }

  async cacheGraphData(data: GraphCacheData['data'], ttlMinutes: number = 30): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.GRAPH_CACHE, 'readwrite');
      const now = Date.now();
      const cacheEntry: GraphCacheData = {
        id: 'main_graph',
        data,
        cachedAt: now,
        expiresAt: now + ttlMinutes * 60 * 1000,
      };
      const request = store.put(cacheEntry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedGraphData(): Promise<GraphCacheData['data'] | null> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.GRAPH_CACHE);
      const request = store.get('main_graph');
      request.onsuccess = () => {
        const result = request.result as GraphCacheData | undefined;
        if (!result) {
          resolve(null);
          return;
        }

        if (Date.now() > result.expiresAt) {
          this.deleteCachedGraphData().then(() => resolve(null));
          return;
        }

        resolve(result.data);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCachedGraphData(): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.GRAPH_CACHE, 'readwrite');
      const request = store.delete('main_graph');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveSearchHistory(item: Omit<SearchHistoryItem, 'id' | 'timestamp'>): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.SEARCH_HISTORY, 'readwrite');
      const historyItem: SearchHistoryItem = {
        ...item,
        id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      };
      const request = store.put(historyItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSearchHistory(limit: number = 20): Promise<SearchHistoryItem[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.SEARCH_HISTORY);
      const request = store.getAll();
      request.onsuccess = () => {
        const history = (request.result || []) as SearchHistoryItem[];
        history.sort((a, b) => b.timestamp - a.timestamp);
        resolve(history.slice(0, limit));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearSearchHistory(): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.SEARCH_HISTORY, 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async addPendingOperation(
    operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>
  ): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PENDING_OPERATIONS, 'readwrite');
      const pendingOp: PendingOperation = {
        ...operation,
        id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
      };
      const request = store.put(pendingOp);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingOperations(): Promise<PendingOperation[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PENDING_OPERATIONS);
      const request = store.getAll();
      request.onsuccess = () => {
        const operations = (request.result || []) as PendingOperation[];
        operations.sort((a, b) => a.timestamp - b.timestamp);
        resolve(operations);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updatePendingOperationRetry(id: string, retryCount: number): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PENDING_OPERATIONS, 'readwrite');
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const operation = getRequest.result as PendingOperation;
        if (operation) {
          operation.retryCount = retryCount;
          store.put(operation);
        }
        resolve();
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async removePendingOperation(id: string): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PENDING_OPERATIONS, 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingOperationsCount(): Promise<number> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PENDING_OPERATIONS);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async searchEntitiesLocal(
    query: string,
    filters?: {
      category?: string;
      region?: string[];
      period?: string[];
    }
  ): Promise<CachedEntity[]> {
    await this.ensureInitialized();
    const allEntities = await this.getAllEntities();
    const lowerQuery = query.toLowerCase();

    return allEntities.filter((entity) => {
      const matchesQuery =
        !query ||
        entity.name.toLowerCase().includes(lowerQuery) ||
        (entity.description?.toLowerCase().includes(lowerQuery) ?? false);

      const matchesCategory =
        !filters?.category || filters.category === 'all' || entity.type === filters.category;

      const matchesRegion =
        !filters?.region ||
        filters.region.length === 0 ||
        (entity.region && filters.region.includes(entity.region));

      const matchesPeriod =
        !filters?.period ||
        filters.period.length === 0 ||
        (entity.period && filters.period.includes(entity.period));

      return matchesQuery && matchesCategory && matchesRegion && matchesPeriod;
    });
  }

  async getStats(): Promise<{
    totalEntities: number;
    totalRelationships: number;
    entitiesByType: Record<string, number>;
    cacheAge: number | null;
    pendingOperations: number;
  }> {
    await this.ensureInitialized();
    const entities = await this.getAllEntities();
    const relationships = await this.getAllRelationships();
    const pendingCount = await this.getPendingOperationsCount();

    const entitiesByType: Record<string, number> = {};
    entities.forEach((entity) => {
      entitiesByType[entity.type] = (entitiesByType[entity.type] || 0) + 1;
    });

    const cachedGraph = await this.getCachedGraphData();
    let cacheAge: number | null = null;
    if (cachedGraph) {
      const cacheEntry = await new Promise<GraphCacheData | null>((resolve, reject) => {
        const store = this.getStore(STORES.GRAPH_CACHE);
        const request = store.get('main_graph');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      if (cacheEntry) {
        cacheAge = Date.now() - cacheEntry.cachedAt;
      }
    }

    return {
      totalEntities: entities.length,
      totalRelationships: relationships.length,
      entitiesByType,
      cacheAge,
      pendingOperations: pendingCount,
    };
  }

  async clearAllData(): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [
          STORES.ENTITIES,
          STORES.RELATIONSHIPS,
          STORES.GRAPH_CACHE,
          STORES.SEARCH_HISTORY,
          STORES.PENDING_OPERATIONS,
        ],
        'readwrite'
      );

      transaction.objectStore(STORES.ENTITIES).clear();
      transaction.objectStore(STORES.RELATIONSHIPS).clear();
      transaction.objectStore(STORES.GRAPH_CACHE).clear();
      transaction.objectStore(STORES.SEARCH_HISTORY).clear();
      transaction.objectStore(STORES.PENDING_OPERATIONS).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const knowledgeOfflineStorage = new KnowledgeOfflineStorageService();
