import { offlineStorage } from './offlineStorage';
import { networkStatusService } from './networkStatus';
import chatApi from '../api/chat';
import type { Session, Message } from '../types/chat';
import type { PendingOperation } from './offlineStorage';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'completed';

interface SyncResult {
  success: boolean;
  syncedOperations: number;
  failedOperations: number;
  errors: string[];
}

type SyncStatusListener = (status: SyncStatus, result?: SyncResult) => void;

class DataSyncService {
  private status: SyncStatus = 'idle';
  private listeners = new Set<SyncStatusListener>();
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 30000;
  private readonly MAX_RETRY_COUNT = 3;
  private isSyncing = false;

  constructor() {
    this.init();
  }

  private init() {
    networkStatusService.subscribe((networkStatus) => {
      if (networkStatus.mode === 'online' && this.status !== 'syncing') {
        this.syncPendingOperations();
      }
    });

    this.startPeriodicSync();
  }

  private startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (networkStatusService.isOnline() && !this.isSyncing) {
        this.syncPendingOperations();
      }
    }, this.SYNC_INTERVAL);
  }

  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(result?: SyncResult) {
    this.listeners.forEach((listener) => {
      try {
        listener(this.status, result);
      } catch (error) {
        console.error('Error in sync status listener:', error);
      }
    });
  }

  async syncPendingOperations(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        syncedOperations: 0,
        failedOperations: 0,
        errors: ['Sync in progress'],
      };
    }

    if (!networkStatusService.isOnline()) {
      return { success: false, syncedOperations: 0, failedOperations: 0, errors: ['Offline'] };
    }

    this.isSyncing = true;
    this.status = 'syncing';
    this.notifyListeners();

    const result: SyncResult = {
      success: true,
      syncedOperations: 0,
      failedOperations: 0,
      errors: [],
    };

    try {
      const pendingOps = await offlineStorage.getPendingOperations();

      for (const op of pendingOps) {
        if (op.retryCount >= this.MAX_RETRY_COUNT) {
          await offlineStorage.removePendingOperation(op.id);
          result.failedOperations++;
          result.errors.push(`Operation ${op.id} exceeded max retries`);
          continue;
        }

        try {
          await this.processOperation(op);
          await offlineStorage.removePendingOperation(op.id);
          result.syncedOperations++;
        } catch (error) {
          await offlineStorage.updatePendingOperationRetryCount(op.id, op.retryCount + 1);
          result.failedOperations++;
          result.errors.push(`Failed to sync operation ${op.id}: ${error}`);
        }
      }

      this.status = 'completed';
      result.success = result.failedOperations === 0;
    } catch (error) {
      this.status = 'error';
      result.success = false;
      result.errors.push(`Sync failed: ${error}`);
    } finally {
      this.isSyncing = false;
      this.notifyListeners(result);
    }

    return result;
  }

  private async processOperation(op: PendingOperation): Promise<void> {
    switch (op.type) {
      case 'create_session':
        await chatApi.createSession(op.data.title);
        break;

      case 'delete_session':
        await chatApi.deleteSession(op.data.sessionId);
        break;

      case 'send_message':
        await chatApi.sendMessage({
          sessionId: op.data.sessionId,
          content: op.data.content,
        });
        break;

      case 'update_message':
        if (op.data.feedback) {
          await chatApi.submitFeedback(op.data.messageId, op.data.feedback);
        }
        break;

      default:
        throw new Error(`Unknown operation type: ${op.type}`);
    }
  }

  async saveSessionLocally(session: Session): Promise<void> {
    await offlineStorage.saveSession(session);

    if (networkStatusService.isOffline()) {
      await offlineStorage.addPendingOperation({
        type: 'create_session',
        data: { title: session.title },
      });
    }
  }

  async saveMessageLocally(message: Message): Promise<void> {
    await offlineStorage.saveMessage(message);

    if (networkStatusService.isOffline() && message.role === 'user') {
      await offlineStorage.addPendingOperation({
        type: 'send_message',
        data: {
          sessionId: message.sessionId,
          content: message.content,
        },
      });
    }
  }

  async deleteSessionLocally(sessionId: string): Promise<void> {
    await offlineStorage.deleteSession(sessionId);

    if (networkStatusService.isOffline()) {
      await offlineStorage.addPendingOperation({
        type: 'delete_session',
        data: { sessionId },
      });
    }
  }

  async updateMessageFeedbackLocally(
    messageId: string,
    feedback: 'helpful' | 'unclear'
  ): Promise<void> {
    await offlineStorage.updateMessage(messageId, { feedback });

    if (networkStatusService.isOffline()) {
      await offlineStorage.addPendingOperation({
        type: 'update_message',
        data: { messageId, feedback },
      });
    }
  }

  async loadSessionsFromLocal(): Promise<Session[]> {
    return await offlineStorage.getAllSessions();
  }

  async loadMessagesFromLocal(sessionId: string): Promise<Message[]> {
    return await offlineStorage.getMessages(sessionId);
  }

  async syncFromServer(): Promise<void> {
    if (!networkStatusService.isOnline()) {
      return;
    }

    try {
      const serverSessions = await chatApi.getSessions();

      for (const serverSession of serverSessions.sessions) {
        const localSession = await offlineStorage.getSession(serverSession.id);

        if (!localSession) {
          await offlineStorage.saveSession(serverSession);
        } else {
          const serverTime = new Date(serverSession.updatedAt).getTime();
          const localTime = new Date(localSession.updatedAt).getTime();

          if (serverTime > localTime) {
            await offlineStorage.saveSession(serverSession);
          }
        }
      }
    } catch (error) {
      console.error('Failed to sync sessions from server:', error);
    }
  }

  async syncMessagesFromServer(sessionId: string): Promise<Message[]> {
    if (!networkStatusService.isOnline()) {
      return await offlineStorage.getMessages(sessionId);
    }

    try {
      const response = await chatApi.getMessages(sessionId);
      const serverMessages = response.messages;

      for (const message of serverMessages) {
        await offlineStorage.saveMessage(message);
      }

      return serverMessages;
    } catch (error) {
      console.error('Failed to sync messages from server:', error);
      return await offlineStorage.getMessages(sessionId);
    }
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  async getPendingOperationsCount(): Promise<number> {
    const ops = await offlineStorage.getPendingOperations();
    return ops.length;
  }

  async clearPendingOperations(): Promise<void> {
    const ops = await offlineStorage.getPendingOperations();
    for (const op of ops) {
      await offlineStorage.removePendingOperation(op.id);
    }
  }

  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.listeners.clear();
  }
}

export const dataSyncService = new DataSyncService();
export type { SyncStatus, SyncResult };
