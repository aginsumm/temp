import { apiClient } from './client';
import type {
  GraphSnapshot,
  CreateSnapshotRequest,
  SnapshotListResponse,
  Entity,
} from '../types/chat';

interface SnapshotStorage {
  snapshots: GraphSnapshot[];
  lastUpdated: string;
}

const STORAGE_KEY = 'heritage_graph_snapshots';
const MAX_LOCAL_SNAPSHOTS = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 秒

// 重试辅助函数
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError =
        errorMessage.includes('network') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('timeout') ||
        (error as Record<string, unknown>)?.code === 'NETWORK_ERROR';

      if (!isNetworkError || attempt === maxRetries) {
        throw error;
      }

      console.warn(`${operationName} failed (attempt ${attempt}/${maxRetries}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * attempt));
    }
  }

  throw lastError;
}

class SnapshotService {
  private storageAvailable: boolean;

  constructor() {
    this.storageAvailable = this.checkStorageAvailability();
  }

  private checkStorageAvailability(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private getLocalSnapshots(): SnapshotStorage {
    if (!this.storageAvailable) {
      return { snapshots: [], lastUpdated: new Date().toISOString() };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to parse local snapshots:', error);
    }

    return { snapshots: [], lastUpdated: new Date().toISOString() };
  }

  private saveLocalSnapshots(storage: SnapshotStorage): void {
    if (!this.storageAvailable) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    } catch (error) {
      console.warn('Failed to save local snapshots:', error);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.pruneOldSnapshots();
      }
    }
  }

  private pruneOldSnapshots(): void {
    const storage = this.getLocalSnapshots();
    if (storage.snapshots.length > MAX_LOCAL_SNAPSHOTS / 2) {
      storage.snapshots = storage.snapshots
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, MAX_LOCAL_SNAPSHOTS / 2);
      this.saveLocalSnapshots(storage);
    }
  }

  async createSnapshot(request: CreateSnapshotRequest): Promise<GraphSnapshot> {
    const snapshot: GraphSnapshot = {
      id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      session_id: request.session_id,
      message_id: request.message_id,
      graph_data: request.graph_data,
      keywords: request.keywords,
      entities: request.entities,
      relations: request.relations,
      created_at: new Date().toISOString(),
      title: request.title || this.generateTitle(request.entities),
      description: request.description,
    };

    try {
      const response = await withRetry(
        () => apiClient.post<GraphSnapshot>('/graph/snapshot', snapshot),
        'createSnapshot'
      );
      const savedSnapshot = response;

      const storage = this.getLocalSnapshots();
      storage.snapshots.unshift(savedSnapshot);
      if (storage.snapshots.length > MAX_LOCAL_SNAPSHOTS) {
        storage.snapshots = storage.snapshots.slice(0, MAX_LOCAL_SNAPSHOTS);
      }
      storage.lastUpdated = new Date().toISOString();
      this.saveLocalSnapshots(storage);

      return savedSnapshot;
    } catch (error) {
      console.warn('Failed to save snapshot to server, saving locally:', error);

      const storage = this.getLocalSnapshots();
      storage.snapshots.unshift(snapshot);
      if (storage.snapshots.length > MAX_LOCAL_SNAPSHOTS) {
        storage.snapshots = storage.snapshots.slice(0, MAX_LOCAL_SNAPSHOTS);
      }
      storage.lastUpdated = new Date().toISOString();
      this.saveLocalSnapshots(storage);

      return snapshot;
    }
  }

  private generateTitle(entities: Entity[]): string {
    if (entities.length === 0) return '知识图谱快照';
    if (entities.length === 1) return `${entities[0].name} 相关图谱`;
    if (entities.length <= 3) {
      return entities.map((e) => e.name).join('、') + ' 关系图谱';
    }
    return `${entities[0].name} 等 ${entities.length} 个实体图谱`;
  }

  async getSnapshot(snapshotId: string): Promise<GraphSnapshot | null> {
    const storage = this.getLocalSnapshots();
    const localSnapshot = storage.snapshots.find((s) => s.id === snapshotId);
    if (localSnapshot) {
      return localSnapshot;
    }

    try {
      const response = await withRetry(
        () => apiClient.get<GraphSnapshot>(`/graph/snapshot/${snapshotId}`),
        'getSnapshot'
      );
      return response;
    } catch (error: unknown) {
      console.warn('Failed to fetch snapshot:', error);

      const errorObj = error as Record<string, unknown>;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus = errorObj?.status as number | undefined;

      const is404 =
        errorStatus === 404 || errorMessage.includes('404') || errorMessage.includes('not found');
      const isPermissionError =
        errorStatus === 403 || errorMessage.includes('permission') || errorMessage.includes('无权');
      const isNetworkError = errorMessage.includes('network') || errorMessage.includes('fetch');

      if (is404 || isPermissionError) {
        return null;
      }

      if (isNetworkError) {
        console.info('Network error, trying local storage...');
        const recentLocal = storage.snapshots.find(
          (s) =>
            s.id === snapshotId &&
            new Date(s.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
        );
        if (recentLocal) {
          console.info('Found snapshot in local storage');
          return recentLocal;
        }
      }

      return null;
    }
  }

  async listSnapshots(
    sessionId?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<SnapshotListResponse> {
    const storage = this.getLocalSnapshots();
    let localSnapshots = storage.snapshots;

    if (sessionId) {
      localSnapshots = localSnapshots.filter((s) => s.session_id === sessionId);
    }

    try {
      const response = await apiClient.get<SnapshotListResponse>('/graph/snapshots', {
        params: { session_id: sessionId, page, page_size: pageSize },
      });

      const serverSnapshotIds = new Set(response.snapshots.map((s) => s.id));
      const localOnlyNew = localSnapshots.filter((s) => !serverSnapshotIds.has(s.id));

      const mergedSnapshots = [...response.snapshots, ...localOnlyNew].sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      const paginatedSnapshots = mergedSnapshots.slice(0, pageSize);

      return {
        snapshots: paginatedSnapshots,
        total: response.total + localOnlyNew.length,
        page,
        page_size: pageSize,
      };
    } catch (error) {
      console.warn('Failed to fetch snapshots from server:', error);

      const sortedSnapshots = [...localSnapshots].sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      const total = sortedSnapshots.length;
      const start = (page - 1) * pageSize;
      const paginatedSnapshots = sortedSnapshots.slice(start, start + pageSize);

      return {
        snapshots: paginatedSnapshots,
        total,
        page,
        page_size: pageSize,
      };
    }
  }

  async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const storage = this.getLocalSnapshots();
    const index = storage.snapshots.findIndex((s) => s.id === snapshotId);

    if (index !== -1) {
      storage.snapshots.splice(index, 1);
      storage.lastUpdated = new Date().toISOString();
      this.saveLocalSnapshots(storage);
    }

    try {
      await apiClient.delete(`/graph/snapshot/${snapshotId}`);
      return true;
    } catch (error) {
      console.warn('Failed to delete snapshot from server:', error);
      return index !== -1;
    }
  }

  async updateSnapshot(
    snapshotId: string,
    updates: Partial<Pick<GraphSnapshot, 'title' | 'description'>>
  ): Promise<GraphSnapshot | null> {
    const storage = this.getLocalSnapshots();
    const index = storage.snapshots.findIndex((s) => s.id === snapshotId);

    if (index !== -1) {
      storage.snapshots[index] = {
        ...storage.snapshots[index],
        ...updates,
      };
      storage.lastUpdated = new Date().toISOString();
      this.saveLocalSnapshots(storage);

      try {
        const response = await apiClient.patch<GraphSnapshot>(
          `/graph/snapshot/${snapshotId}`,
          updates
        );
        return response;
      } catch (error) {
        console.warn('Failed to update snapshot on server:', error);
        return storage.snapshots[index];
      }
    }

    return null;
  }

  async shareSnapshot(
    snapshotId: string,
    expiresDays?: number
  ): Promise<{ share_url: string } | null> {
    try {
      const params = expiresDays ? `?expires_days=${expiresDays}` : '';
      const response = await apiClient.post<{ share_url: string }>(
        `/graph/snapshot/${snapshotId}/share${params}`
      );

      const storage = this.getLocalSnapshots();
      const index = storage.snapshots.findIndex((s) => s.id === snapshotId);
      if (index !== -1) {
        storage.snapshots[index].is_shared = true;
        storage.snapshots[index].share_url = response.share_url;
        storage.lastUpdated = new Date().toISOString();
        this.saveLocalSnapshots(storage);
      }

      return response;
    } catch (error) {
      console.warn('Failed to share snapshot:', error);
      return null;
    }
  }

  async loadSharedSnapshot(shareToken: string): Promise<GraphSnapshot | null> {
    try {
      const response = await apiClient.get<GraphSnapshot>(`shared/graph/${shareToken}`);
      return response;
    } catch (error) {
      console.warn('Failed to load shared snapshot:', error);
      return null;
    }
  }

  async exportSnapshot(snapshotId: string, format: 'json' | 'png' = 'json'): Promise<Blob | null> {
    const snapshot = await this.getSnapshot(snapshotId);
    if (!snapshot) return null;

    if (format === 'json') {
      const json = JSON.stringify(snapshot, null, 2);
      return new Blob([json], { type: 'application/json' });
    }

    return null;
  }

  async importSnapshot(jsonData: string): Promise<GraphSnapshot | null> {
    try {
      const snapshot = JSON.parse(jsonData) as GraphSnapshot;

      if (!snapshot.graph_data || !snapshot.entities) {
        throw new Error('Invalid snapshot format');
      }

      snapshot.id = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      snapshot.created_at = new Date().toISOString();

      const storage = this.getLocalSnapshots();
      storage.snapshots.unshift(snapshot);
      storage.lastUpdated = new Date().toISOString();
      this.saveLocalSnapshots(storage);

      return snapshot;
    } catch (error) {
      console.warn('Failed to import snapshot:', error);
      return null;
    }
  }

  async getSnapshotStats(): Promise<{
    total: number;
    totalEntities: number;
    totalRelations: number;
    oldestDate: string | null;
    newestDate: string | null;
  }> {
    const storage = this.getLocalSnapshots();
    const snapshots = storage.snapshots;

    const total = snapshots.length;
    const totalEntities = snapshots.reduce((sum, s) => sum + s.entities.length, 0);
    const totalRelations = snapshots.reduce((sum, s) => sum + s.relations.length, 0);

    let oldestDate: string | null = null;
    let newestDate: string | null = null;

    if (snapshots.length > 0) {
      const dates = snapshots.map((s) => new Date(s.created_at).getTime());
      oldestDate = new Date(Math.min(...dates)).toISOString();
      newestDate = new Date(Math.max(...dates)).toISOString();
    }

    return {
      total,
      totalEntities,
      totalRelations,
      oldestDate,
      newestDate,
    };
  }

  async searchSnapshots(query: string): Promise<GraphSnapshot[]> {
    const storage = this.getLocalSnapshots();
    const lowerQuery = query.toLowerCase();

    return storage.snapshots.filter(
      (s) =>
        s.title?.toLowerCase().includes(lowerQuery) ||
        s.description?.toLowerCase().includes(lowerQuery) ||
        s.entities.some((e) => e.name.toLowerCase().includes(lowerQuery)) ||
        s.keywords.some((k) => k.toLowerCase().includes(lowerQuery))
    );
  }

  clearLocalSnapshots(): void {
    if (this.storageAvailable) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export const snapshotService = new SnapshotService();
export default snapshotService;
