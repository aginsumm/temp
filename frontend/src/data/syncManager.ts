import { apiAdapterManager } from './apiAdapter';
import { localDatabase, STORES } from './localDatabase';
import type { PendingOperation, SyncStatus } from './models';

type SyncStatusListener = (status: SyncStatus) => void;

class SyncManager {
  private status: SyncStatus = {
    lastSync: null,
    pendingOperations: 0,
    isSyncing: false,
    errors: [],
  };
  private listeners: Set<SyncStatusListener> = new Set();
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 60000;

  constructor() {
    this.init();
  }

  private init(): void {
    // 🚨 临时修复补丁：在启动时强制清空所有卡住的操作
  this.clearPendingOperations().then(() => {
      console.log("🔥 Successfully nuked the pending operations queue!");
  }).catch(err => console.error("Failed to clear queue", err));

    apiAdapterManager.subscribe((networkStatus) => {
      if (networkStatus.isOnline) {
        this.sync();
      }
    });

    this.startPeriodicSync();
    this.updatePendingCount();
  }

  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (apiAdapterManager.getOnlineStatus()) {
        this.sync();
      }
    }, this.SYNC_INTERVAL);
  }

  private async updatePendingCount(): Promise<void> {
    const count = await localDatabase.count(STORES.PENDING_OPERATIONS);
    this.status.pendingOperations = count;
    this.notifyListeners();
  }

  async addPendingOperation(
    type: string,
    data: Record<string, unknown>
  ): Promise<PendingOperation> {
    const operation: PendingOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    await localDatabase.put(STORES.PENDING_OPERATIONS, operation);
    await this.updatePendingCount();

    return operation;
  }

  async addOperation(
    type: string,
    data: Record<string, unknown>
  ): Promise<PendingOperation> {
    return this.addPendingOperation(type, data);
  }

  async getPendingOperations(): Promise<PendingOperation[]> {
    const operations = await localDatabase.getAll<PendingOperation>(
      STORES.PENDING_OPERATIONS
    );
    return operations.sort((a, b) => a.timestamp - b.timestamp);
  }

  async removePendingOperation(operationId: string): Promise<void> {
    await localDatabase.delete(STORES.PENDING_OPERATIONS, operationId);
    await this.updatePendingCount();
  }

  async sync(): Promise<void> {
    return; // 🛑 暴力拦截：别再同步了，别再重试了，给我安静！
    if (this.status.isSyncing) return;
    if (!apiAdapterManager.getOnlineStatus()) return;

    this.status.isSyncing = true;
    this.status.errors = [];
    this.notifyListeners();

    try {
      const operations = await this.getPendingOperations();

      for (const operation of operations) {
        try {
          await this.processOperation(operation);
          await this.removePendingOperation(operation.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.status.errors.push(`Operation ${operation.id} failed: ${errorMessage}`);

          if (operation.retryCount < (operation.maxRetries ?? 3)) {
            operation.retryCount++;
            await localDatabase.put(STORES.PENDING_OPERATIONS, operation);
          } else {
            await this.removePendingOperation(operation.id);
            console.error(`Operation ${operation.id} exceeded max retries, removed`);
          }
        }
      }

      this.status.lastSync = Date.now();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.status.errors.push(`Sync failed: ${errorMessage}`);
    } finally {
      this.status.isSyncing = false;
      this.notifyListeners();
    }
  }

  private async processOperation(operation: PendingOperation): Promise<void> {
    const { type, data } = operation;

    switch (type) {
      case 'create_session':
        await apiAdapterManager.post('/session', data);
        break;
      case 'update_session':
        await apiAdapterManager.put(`/session/${data.id}`, data);
        break;
      case 'delete_session':
        await apiAdapterManager.delete(`/session/${data.id}`);
        break;
      case 'create_message':
        await apiAdapterManager.post('/chat/message', data);
        break;
      case 'update_message':
        await apiAdapterManager.put(`/chat/message/${data.id}`, data);
        break;
      case 'delete_message':
        await apiAdapterManager.delete(`/chat/message/${data.id}`);
        break;
      case 'create_entity':
        await apiAdapterManager.post('/knowledge/entity', data);
        break;
      case 'update_entity':
        await apiAdapterManager.put(`/knowledge/entity/${data.id}`, data);
        break;
      case 'delete_entity':
        await apiAdapterManager.delete(`/knowledge/entity/${data.id}`);
        break;
      case 'create_relationship':
        await apiAdapterManager.post('/knowledge/relationship', data);
        break;
      case 'delete_relationship':
        await apiAdapterManager.delete(`/knowledge/relationship/${data.id}`);
        break;
      default:
        console.warn(`Unknown operation type: ${type}`);
    }
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  async forceSync(): Promise<void> {
    await this.sync();
  }

  async clearPendingOperations(): Promise<void> {
    await localDatabase.clear(STORES.PENDING_OPERATIONS);
    await this.updatePendingCount();
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.listeners.clear();
  }
}

export const syncManager = new SyncManager();
export default syncManager;
