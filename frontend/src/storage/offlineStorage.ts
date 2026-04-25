class OfflineStorage {
  private dbName: string = 'offline-chat-db';
  private dbVersion: number = 1;
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('sessionId', 'sessionId', { unique: false });
          messageStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains('pending-actions')) {
          db.createObjectStore('pending-actions', { keyPath: 'id' });
        }
      };
    });
  }

  async addSession(session: unknown) {
    return this.addToStore('sessions', session);
  }

  async updateSession(session: unknown) {
    return this.putToStore('sessions', session);
  }

  async deleteSession(sessionId: string) {
    return this.deleteFromStore('sessions', sessionId);
  }

  async getSessions() {
    return this.getAllFromStore('sessions');
  }

  async getSession(sessionId: string) {
    return this.getFromStore('sessions', sessionId);
  }

  async addMessage(message: unknown) {
    return this.addToStore('messages', message);
  }

  async updateMessage(message: unknown) {
    return this.putToStore('messages', message);
  }

  async deleteMessage(messageId: string) {
    return this.deleteFromStore('messages', messageId);
  }

  async getMessages(sessionId: string) {
    return this.getFromStoreByIndex('messages', 'sessionId', sessionId);
  }

  async deleteMessages(sessionId: string) {
    const messages = (await this.getMessages(sessionId)) as Array<{ id: string }>;
    for (const message of messages) {
      await this.deleteFromStore('messages', message.id);
    }
  }

  async addPendingAction(action: unknown) {
    return this.addToStore('pending-actions', action);
  }

  async getPendingActions() {
    return this.getAllFromStore('pending-actions');
  }

  async deletePendingAction(actionId: string) {
    return this.deleteFromStore('pending-actions', actionId);
  }

  async clearPendingActions() {
    return this.clearStore('pending-actions');
  }

  private async addToStore(storeName: string, data: unknown) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async putToStore(storeName: string, data: unknown) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getFromStore(storeName: string, key: string) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllFromStore(storeName: string) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getFromStoreByIndex(storeName: string, indexName: string, value: string) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFromStore(storeName: string, key: string) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async clearStore(storeName: string) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll() {
    if (!this.db) return;

    const stores = ['sessions', 'messages', 'pending-actions'];
    for (const storeName of stores) {
      await this.clearStore(storeName);
    }
  }
}

export default new OfflineStorage();
