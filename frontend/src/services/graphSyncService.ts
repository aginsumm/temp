/**
 * 图谱数据同步服务 v4
 * 基于 graphStore 的统一数据同步层
 * 所有图谱数据通过 graphStore 存储，本服务只负责事件分发
 */

import type { Entity, Relation } from '../types/graph';
import { useGraphStore } from '../stores/graphStore';

export enum SyncEventType {
  UPDATE = 'UPDATE',
  SNAPSHOT = 'SNAPSHOT',
  CLEAR = 'CLEAR',
  MERGE = 'MERGE',
}

export enum SyncSource {
  CHAT = 'chat',
  KNOWLEDGE = 'knowledge',
  SNAPSHOT = 'snapshot',
}

export interface GraphSyncEvent {
  type: SyncEventType;
  source: SyncSource;
  entities: Entity[];
  relations: Relation[];
  keywords: string[];
  sessionId?: string;
  messageId?: string;
  timestamp: number;
  version: number;
}

type SyncListener = (event: GraphSyncEvent) => void;

class GraphSyncService {
  private static instance: GraphSyncService;
  private listeners: Map<string, Set<SyncListener>> = new Map();
  private version: number = 0;
  private unsubscribeFromStore: (() => void) | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingEvent: GraphSyncEvent | null = null;
  private lastNotifiedVersion = 0;
  private readonly DEBOUNCE_DELAY = 100;

  private constructor() {
    this.initStoreSubscription();
  }

  static getInstance(): GraphSyncService {
    if (!GraphSyncService.instance) {
      GraphSyncService.instance = new GraphSyncService();
    }
    return GraphSyncService.instance;
  }

  /**
   * 订阅 graphStore 的更新，自动分发事件（带防抖）
   */
  private initStoreSubscription(): void {
    this.unsubscribeFromStore = useGraphStore.subscribe((state, prevState) => {
      const entitiesChanged = state.entities !== prevState.entities;
      const relationsChanged = state.relations !== prevState.relations;
      const keywordsChanged = state.keywords !== prevState.keywords;

      if (entitiesChanged || relationsChanged || keywordsChanged) {
        this.version++;

        const event: GraphSyncEvent = {
          type: SyncEventType.UPDATE,
          source: (state.source as SyncSource) || SyncSource.CHAT,
          entities: state.entities,
          relations: state.relations,
          keywords: state.keywords,
          sessionId: state.sessionId || undefined,
          messageId: state.messageId || undefined,
          timestamp: state.lastUpdated,
          version: this.version,
        };

        this.pendingEvent = event;

        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
          if (this.pendingEvent) {
            this.notifyListeners(this.pendingEvent);
            this.lastNotifiedVersion = this.pendingEvent.version;
            this.pendingEvent = null;
          }
        }, this.DEBOUNCE_DELAY);
      }
    });
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(event: GraphSyncEvent): void {
    if (import.meta.env.DEV) {
      console.log('🔵 graphSyncService.notifyListeners:', {
        source: event.source,
        entities: event.entities.length,
        relations: event.relations.length,
        listenersCount: this.listeners.size,
      });
    }

    this.listeners.forEach((listenerSet, moduleId) => {
      if (import.meta.env.DEV) {
        console.log(`  → 通知模块：${moduleId}, 监听器数量：${listenerSet.size}`);
      }
      listenerSet.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error('Graph sync listener error:', error);
        }
      });
    });
  }

  /**
   * 添加监听器
   */
  addListener(moduleId: string, listener: SyncListener): () => void {
    if (!this.listeners.has(moduleId)) {
      this.listeners.set(moduleId, new Set());
    }

    const listenerSet = this.listeners.get(moduleId)!;
    listenerSet.add(listener);

    const cleanup = () => {
      this.removeListener(moduleId, listener);
    };

    return cleanup;
  }

  /**
   * 移除监听器
   */
  removeListener(moduleId: string, listener?: SyncListener): void {
    const listenerSet = this.listeners.get(moduleId);
    if (listenerSet) {
      if (listener) {
        listenerSet.delete(listener);
      } else {
        listenerSet.clear();
      }
      if (listenerSet.size === 0) {
        this.listeners.delete(moduleId);
      }
    }
  }

  /**
   * 从 Chat 模块更新图谱数据
   * 使用增量合并，避免全量覆盖
   */
  updateFromChat(
    entities: Entity[],
    relations: Relation[],
    keywords: string[],
    sessionId?: string,
    messageId?: string
  ): void {
    if (import.meta.env.DEV) {
      console.log('🔵 graphSyncService.updateFromChat 被调用:', {
        entities: entities.length,
        relations: relations.length,
        keywords: keywords.length,
      });
    }

    const currentState = useGraphStore.getState();
    const hasExistingData = currentState.entities.length > 0 || currentState.relations.length > 0;

    if (hasExistingData) {
      useGraphStore.getState().mergeGraphData(entities, relations, keywords);
    } else {
      useGraphStore
        .getState()
        .updateGraphData(entities, relations, keywords, sessionId, messageId, 'chat');
    }

    if (import.meta.env.DEV) {
      console.log('✅ graphStore 已更新，事件将自动分发');
    }
  }

  /**
   * 从 Knowledge 模块更新图谱数据
   */
  updateFromKnowledge(entities: Entity[], relations: Relation[], keywords: string[]): void {
    useGraphStore
      .getState()
      .updateGraphData(entities, relations, keywords, undefined, undefined, 'knowledge');
  }

  /**
   * 从快照加载图谱数据
   */
  updateFromSnapshot(
    entities: Entity[],
    relations: Relation[],
    keywords: string[],
    sessionId?: string,
    messageId?: string
  ): void {
    useGraphStore
      .getState()
      .updateGraphData(entities, relations, keywords, sessionId, messageId, 'snapshot');
  }

  /**
   * 清空图谱数据
   */
  clear(): void {
    useGraphStore.getState().clearGraphData();
  }

  /**
   * 获取当前图谱状态
   */
  getCurrentState(): {
    entities: Entity[];
    relations: Relation[];
    keywords: string[];
  } | null {
    const state = useGraphStore.getState();
    if (state.entities.length === 0 && state.relations.length === 0) {
      return null;
    }

    return {
      entities: state.entities,
      relations: state.relations,
      keywords: state.keywords,
    };
  }

  /**
   * 从 sessionStorage 恢复图谱状态
   */
  async restoreFromSessionStorage(sessionId: string): Promise<void> {
    const stored = sessionStorage.getItem(`graph-storage-${sessionId}`);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.updateFromSnapshot(
          data.entities || [],
          data.relations || [],
          data.keywords || [],
          sessionId,
          undefined
        );
      } catch (error) {
        console.error('Failed to restore graph from session storage:', error);
      }
    }
  }

  /**
   * 订阅图谱数据更新
   */
  subscribe(
    moduleId: string,
    callback: (data: {
      entities: Entity[];
      relations: Relation[];
      keywords: string[];
      source: SyncSource;
    }) => void
  ): () => void {
    const handler = (event: GraphSyncEvent) => {
      if (event.source === moduleId) return;

      callback({
        entities: event.entities,
        relations: event.relations,
        keywords: event.keywords,
        source: event.source,
      });
    };

    return this.addListener(moduleId, handler);
  }

  /**
   * 创建图谱同步订阅（简化版本，移除 React Hooks 依赖）
   * 注意：这个方法已被废弃，建议直接使用 subscribe/unsubscribe
   */
  createGraphSync(
    moduleId: string,
    onSync?: (event: GraphSyncEvent) => void
  ): {
    subscribe: () => void;
    unsubscribe: () => void;
    updateFromChat: (
      entities: Entity[],
      relations: Relation[],
      keywords: string[],
      sessionId?: string,
      messageId?: string
    ) => void;
    updateFromKnowledge: (entities: Entity[], relations: Relation[], keywords: string[]) => void;
    updateFromSnapshot: (
      entities: Entity[],
      relations: Relation[],
      keywords: string[],
      sessionId?: string,
      messageId?: string
    ) => void;
    clear: () => void;
  } {
    const listenerId = 'graphSync_' + moduleId;

    return {
      subscribe: () => {
        if (onSync) {
          this.addListener(listenerId, onSync);
        }
      },
      unsubscribe: () => {
        this.removeListener(listenerId);
      },
      updateFromChat: this.updateFromChat.bind(this),
      updateFromKnowledge: this.updateFromKnowledge.bind(this),
      updateFromSnapshot: this.updateFromSnapshot.bind(this),
      clear: this.clear.bind(this),
    };
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.unsubscribeFromStore) {
      this.unsubscribeFromStore();
    }
    this.listeners.clear();
  }
}

export const graphSyncService = GraphSyncService.getInstance();

export { GraphSyncService };

export default graphSyncService;
