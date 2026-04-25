/**
 * 本地数据库模块
 *
 * 使用 IndexedDB 实现本地数据持久化存储，支持：
 * - 会话管理 (sessions)
 * - 消息存储 (messages)
 * - 用户数据 (users)
 * - 收藏记录 (favorites)
 * - 反馈记录 (feedbacks)
 * - 知识实体 (entities) - 新增
 * - 知识关系 (relationships) - 新增
 * - 搜索历史 (searchHistory) - 新增
 * - 待同步操作 (pendingOperations)
 * - 应用设置 (settings)
 *
 * @author 非遗数字生命互动引擎项目组
 * @version 2.0.0
 */

export const DB_NAME = 'HeritageAppDB';
export const DB_VERSION = 5;

export const STORES = {
  SESSIONS: 'sessions',
  MESSAGES: 'messages',
  USERS: 'users',
  FAVORITES: 'favorites',
  FEEDBACKS: 'feedbacks',
  ENTITIES: 'entities',
  RELATIONSHIPS: 'relationships',
  SEARCH_HISTORY: 'searchHistory',
  PENDING_OPERATIONS: 'pendingOperations',
  SETTINGS: 'settings',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

class LocalDatabase {
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
        console.error('Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('LocalDatabase initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction!;
        const oldVersion = event.oldVersion;

        if (oldVersion < 1) {
          this.createV1Stores(db);
        }
        if (oldVersion < 2) {
          this.createV2Stores(db);
        }
        if (oldVersion < 3) {
          this.createV3Stores(db);
        }
        if (oldVersion < 4) {
          this.createV4Stores(db, transaction);
        }
        if (oldVersion < 5) {
          this.createV5Stores(db, transaction);
        }
      };
    });

    return this.initPromise;
  }

  private createV1Stores(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
      const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
      sessionStore.createIndex('userId', 'user_id', { unique: false });
      sessionStore.createIndex('updatedAt', 'updated_at', { unique: false });
      sessionStore.createIndex('isPinned', 'is_pinned', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
      const messageStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
      messageStore.createIndex('sessionId', 'session_id', { unique: false });
      messageStore.createIndex('createdAt', 'created_at', { unique: false });
      messageStore.createIndex('role', 'role', { unique: false });
      messageStore.createIndex('isFavorite', 'is_favorite', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORES.USERS)) {
      const userStore = db.createObjectStore(STORES.USERS, { keyPath: 'id' });
      userStore.createIndex('username', 'username', { unique: true });
      userStore.createIndex('email', 'email', { unique: true });
    }

    if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
      const favoriteStore = db.createObjectStore(STORES.FAVORITES, { keyPath: 'id' });
      favoriteStore.createIndex('userId', 'user_id', { unique: false });
      favoriteStore.createIndex('entityId', 'entity_id', { unique: false });
      favoriteStore.createIndex('createdAt', 'created_at', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORES.FEEDBACKS)) {
      const feedbackStore = db.createObjectStore(STORES.FEEDBACKS, { keyPath: 'id' });
      feedbackStore.createIndex('userId', 'user_id', { unique: false });
      feedbackStore.createIndex('entityId', 'entity_id', { unique: false });
      feedbackStore.createIndex('createdAt', 'created_at', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORES.PENDING_OPERATIONS)) {
      const pendingStore = db.createObjectStore(STORES.PENDING_OPERATIONS, { keyPath: 'id' });
      pendingStore.createIndex('type', 'type', { unique: false });
      pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
      db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private createV2Stores(_db: IDBDatabase): void {
    // V2 版本预留扩展
  }

  private createV3Stores(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(STORES.ENTITIES)) {
      const entityStore = db.createObjectStore(STORES.ENTITIES, { keyPath: 'id' });
      entityStore.createIndex('type', 'type', { unique: false });
      entityStore.createIndex('region', 'region', { unique: false });
      entityStore.createIndex('period', 'period', { unique: false });
      entityStore.createIndex('importance', 'importance', { unique: false });
      entityStore.createIndex('name', 'name', { unique: false });
      entityStore.createIndex('cachedAt', 'cachedAt', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORES.RELATIONSHIPS)) {
      const relationshipStore = db.createObjectStore(STORES.RELATIONSHIPS, { keyPath: 'id' });
      relationshipStore.createIndex('sourceId', 'source_id', { unique: false });
      relationshipStore.createIndex('targetId', 'target_id', { unique: false });
      relationshipStore.createIndex('relationType', 'relation_type', { unique: false });
      relationshipStore.createIndex('cachedAt', 'cachedAt', { unique: false });
    }

    if (!db.objectStoreNames.contains(STORES.SEARCH_HISTORY)) {
      const searchHistoryStore = db.createObjectStore(STORES.SEARCH_HISTORY, { keyPath: 'id' });
      searchHistoryStore.createIndex('userId', 'user_id', { unique: false });
      searchHistoryStore.createIndex('createdAt', 'created_at', { unique: false });
      searchHistoryStore.createIndex('keyword', 'keyword', { unique: false });
    }
  }

  private createV4Stores(db: IDBDatabase, transaction: IDBTransaction): void {
    const ensureStoreIndex = (storeName: string, indexName: string, keyPath: string) => {
      if (!db.objectStoreNames.contains(storeName)) return;

      const store = transaction.objectStore(storeName);

      try {
        store.index(indexName);
      } catch {
        store.createIndex(indexName, keyPath, { unique: false });
      }
    };

    ensureStoreIndex(STORES.SESSIONS, 'userId', 'user_id');
    ensureStoreIndex(STORES.SESSIONS, 'updatedAt', 'updated_at');
    ensureStoreIndex(STORES.SESSIONS, 'isPinned', 'is_pinned');

    ensureStoreIndex(STORES.MESSAGES, 'sessionId', 'session_id');
    ensureStoreIndex(STORES.MESSAGES, 'createdAt', 'created_at');
    ensureStoreIndex(STORES.MESSAGES, 'role', 'role');
    ensureStoreIndex(STORES.MESSAGES, 'isFavorite', 'is_favorite');
  }

  private createV5Stores(db: IDBDatabase, transaction: IDBTransaction): void {
    const ensureCompositeIndex = (storeName: string, indexName: string, keyPaths: string[]) => {
      if (!db.objectStoreNames.contains(storeName)) return;

      const store = transaction.objectStore(storeName);

      try {
        store.index(indexName);
      } catch {
        store.createIndex(indexName, keyPaths, { unique: false });
      }
    };

    ensureCompositeIndex(STORES.MESSAGES, 'sessionId_createdAt', ['session_id', 'created_at']);
    ensureCompositeIndex(STORES.MESSAGES, 'sessionId_role', ['session_id', 'role']);
    ensureCompositeIndex(STORES.MESSAGES, 'sessionId_isFavorite', ['session_id', 'is_favorite']);
    ensureCompositeIndex(STORES.MESSAGES, 'sessionId_createdAt_role', [
      'session_id',
      'created_at',
      'role',
    ]);

    ensureCompositeIndex(STORES.SESSIONS, 'userId_updatedAt', ['user_id', 'updated_at']);
    ensureCompositeIndex(STORES.SESSIONS, 'userId_isPinned', ['user_id', 'is_pinned']);
    ensureCompositeIndex(STORES.SESSIONS, 'userId_updatedAt_isPinned', [
      'user_id',
      'updated_at',
      'is_pinned',
    ]);

    ensureCompositeIndex(STORES.ENTITIES, 'type_region', ['type', 'region']);
    ensureCompositeIndex(STORES.ENTITIES, 'type_importance', ['type', 'importance']);
    ensureCompositeIndex(STORES.ENTITIES, 'type_period', ['type', 'period']);

    ensureCompositeIndex(STORES.RELATIONSHIPS, 'sourceId_targetId', ['source_id', 'target_id']);
    ensureCompositeIndex(STORES.RELATIONSHIPS, 'sourceId_relationType', [
      'source_id',
      'relation_type',
    ]);

    ensureCompositeIndex(STORES.SEARCH_HISTORY, 'userId_createdAt', ['user_id', 'created_at']);
    ensureCompositeIndex(STORES.SEARCH_HISTORY, 'userId_keyword', ['user_id', 'keyword']);
  }

  async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  private getStore(storeName: StoreName, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  async get<T>(storeName: StoreName, key: string): Promise<T | null> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: StoreName): Promise<T[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex<T>(storeName: StoreName, indexName: string, value: IDBValidKey): Promise<T[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getOneByIndex<T>(
    storeName: StoreName,
    indexName: string,
    value: IDBValidKey
  ): Promise<T | null> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName);
      const index = store.index(indexName);
      const request = index.get(value);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async add<T>(storeName: StoreName, data: T): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.add(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async put<T>(storeName: StoreName, data: T): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: StoreName, key: string): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteByIndex(storeName: StoreName, indexName: string, value: IDBValidKey): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const index = store.index(indexName);
      const request = index.openCursor(value);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: StoreName): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async count(storeName: StoreName): Promise<number> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async countByIndex(storeName: StoreName, indexName: string, value: IDBValidKey): Promise<number> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName);
      const index = store.index(indexName);
      const request = index.count(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async transaction<T>(
    storeNames: StoreName | StoreName[],
    mode: IDBTransactionMode,
    callback: (stores: Record<StoreName, IDBObjectStore>) => Promise<T>
  ): Promise<T> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const transaction = this.db.transaction(names, mode);

    const stores: Record<string, IDBObjectStore> = {};
    for (const name of names) {
      stores[name] = transaction.objectStore(name);
    }

    return callback(stores as Record<StoreName, IDBObjectStore>);
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    const storeNames = Object.values(STORES) as StoreName[];

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(storeNames, 'readwrite');

      for (const name of storeNames) {
        transaction.objectStore(name).clear();
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async bulkPut<T>(storeName: StoreName, items: T[]): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      for (const item of items) {
        store.put(item);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async bulkDelete(storeName: StoreName, keys: string[]): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      for (const key of keys) {
        store.delete(key);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  getDb(): IDBDatabase | null {
    return this.db;
  }

  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  async getStorageStats(): Promise<{
    stores: Record<StoreName, number>;
    totalSize: number;
  }> {
    await this.ensureInitialized();
    const stores: Record<StoreName, number> = {} as Record<StoreName, number>;
    let totalSize = 0;

    for (const name of Object.values(STORES) as StoreName[]) {
      const count = await this.count(name);
      stores[name] = count;
      totalSize += count;
    }

    return { stores, totalSize };
  }
}

export const localDatabase = new LocalDatabase();
export default localDatabase;
