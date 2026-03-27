import type { Session, Message } from '../types/chat';

const DB_NAME = 'ChatOfflineDB';
const DB_VERSION = 1;

const STORES = {
  SESSIONS: 'sessions',
  MESSAGES: 'messages',
  PENDING_OPERATIONS: 'pendingOperations',
  SYNC_QUEUE: 'syncQueue',
};

interface PendingOperation {
  id: string;
  type: 'create_session' | 'delete_session' | 'send_message' | 'update_message';
  data: any;
  timestamp: number;
  retryCount: number;
}

class OfflineStorageService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  async init(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
          sessionStore.createIndex('userId', 'userId', { unique: false });
          sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.MESSAGES)) {
          const messageStore = db.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
          messageStore.createIndex('sessionId', 'sessionId', { unique: false });
          messageStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.PENDING_OPERATIONS)) {
          const pendingStore = db.createObjectStore(STORES.PENDING_OPERATIONS, {
            keyPath: 'id',
          });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        }
      };
    });
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

  async saveSession(session: Session): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.SESSIONS, 'readwrite');
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSession(id: string): Promise<Session | null> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.SESSIONS);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllSessions(): Promise<Session[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.SESSIONS);
      const request = store.getAll();
      request.onsuccess = () => {
        const sessions = request.result || [];
        sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(sessions);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSession(id: string): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SESSIONS, STORES.MESSAGES], 'readwrite');

      const sessionStore = transaction.objectStore(STORES.SESSIONS);
      sessionStore.delete(id);

      const messageStore = transaction.objectStore(STORES.MESSAGES);
      const index = messageStore.index('sessionId');
      const messagesRequest = index.getAllKeys(id);

      messagesRequest.onsuccess = () => {
        const keys = messagesRequest.result;
        keys.forEach((key) => messageStore.delete(key));
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveMessage(message: Message): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.MESSAGES, 'readwrite');
      const request = store.put(message);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.MESSAGES);
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);
      request.onsuccess = () => {
        const messages = request.result || [];
        messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.MESSAGES, 'readwrite');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const message = getRequest.result;
        if (message) {
          const updatedMessage = { ...message, ...updates };
          store.put(updatedMessage);
          resolve();
        } else {
          reject(new Error('Message not found'));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async addPendingOperation(
    operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>
  ): Promise<void> {
    await this.ensureInitialized();
    const pendingOp: PendingOperation = {
      ...operation,
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PENDING_OPERATIONS, 'readwrite');
      const request = store.add(pendingOp);
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
        const operations = request.result || [];
        operations.sort((a, b) => a.timestamp - b.timestamp);
        resolve(operations);
      };
      request.onerror = () => reject(request.error);
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

  async updatePendingOperationRetryCount(id: string, retryCount: number): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.PENDING_OPERATIONS, 'readwrite');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (operation) {
          operation.retryCount = retryCount;
          store.put(operation);
          resolve();
        } else {
          reject(new Error('Operation not found'));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async clearAllData(): Promise<void> {
    await this.ensureInitialized();
    const storeNames = Object.values(STORES);
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeNames, 'readwrite');
      storeNames.forEach((name) => {
        transaction.objectStore(name).clear();
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getStorageStats(): Promise<{
    sessionsCount: number;
    messagesCount: number;
    pendingOperationsCount: number;
  }> {
    await this.ensureInitialized();

    const getCount = (storeName: string): Promise<number> => {
      return new Promise((resolve, reject) => {
        const store = this.getStore(storeName);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    };

    const [sessionsCount, messagesCount, pendingOperationsCount] = await Promise.all([
      getCount(STORES.SESSIONS),
      getCount(STORES.MESSAGES),
      getCount(STORES.PENDING_OPERATIONS),
    ]);

    return { sessionsCount, messagesCount, pendingOperationsCount };
  }
}

export const offlineStorage = new OfflineStorageService();
export type { PendingOperation };
