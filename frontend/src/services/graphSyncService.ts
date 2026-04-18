/**
 * 图谱数据同步服务
 * 用于在 Chat 和 Knowledge 模块之间同步图谱数据
 * 确保两个模块的图谱状态保持一致
 */

import { useState, useEffect } from 'react';
import type { Entity, Relation } from '../types/chat';
import { useGraphStore } from '../stores/graphStore';

export interface GraphSyncState {
  entities: Entity[];
  relations: Relation[];
  keywords: string[];
  sessionId?: string;
  messageId?: string;
  lastUpdated: number;
}

type GraphSyncListener = (state: GraphSyncState) => void;

class GraphSyncService {
  private static instance: GraphSyncService;
  private listeners: Set<GraphSyncListener> = new Set();
  private eventListeners: Map<string, (event: Event) => void> = new Map();

  private constructor() {
    this.initEventListeners();
  }

  static getInstance(): GraphSyncService {
    if (!GraphSyncService.instance) {
      GraphSyncService.instance = new GraphSyncService();
    }
    return GraphSyncService.instance;
  }

  private initEventListeners(): void {
    // 监听 loadSnapshot 事件
    const loadSnapshotHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { entities, relations, keywords, snapshot } = customEvent.detail;

      if (entities && entities.length > 0) {
        // 更新 graphStore
        useGraphStore.getState().updateGraphData(
          entities,
          relations || [],
          keywords || [],
          snapshot?.session_id,
          snapshot?.message_id,
          'snapshot'
        );

        this.notifyListeners({
          entities,
          relations: relations || [],
          keywords: keywords || [],
          sessionId: snapshot?.session_id,
          lastUpdated: Date.now(),
        });
      }
    };

    // 监听 restoreGraphState 事件
    const restoreGraphStateHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { entities, relations, keywords } = customEvent.detail;

      if (entities && entities.length > 0) {
        // 更新 graphStore
        useGraphStore.getState().updateGraphData(
          entities,
          relations || [],
          keywords || [],
          undefined,
          undefined,
          'snapshot'
        );

        this.notifyListeners({
          entities,
          relations: relations || [],
          keywords: keywords || [],
          lastUpdated: Date.now(),
        });
      }
    };

    // 监听 syncGraphFromChat 事件
    const syncGraphFromChatHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { entities, relations, keywords, sessionId, messageId } = customEvent.detail;

      if (entities && entities.length > 0) {
        useGraphStore.getState().updateGraphData(
          entities,
          relations || [],
          keywords || [],
          sessionId,
          messageId,
          'chat'
        );
      }
    };

    // 监听 syncGraphFromKnowledge 事件
    const syncGraphFromKnowledgeHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { entities, relations, keywords } = customEvent.detail;

      if (entities && entities.length > 0) {
        useGraphStore.getState().updateGraphData(
          entities,
          relations || [],
          keywords || [],
          undefined,
          undefined,
          'knowledge'
        );
      }
    };

    window.addEventListener('loadSnapshot', loadSnapshotHandler);
    window.addEventListener('restoreGraphState', restoreGraphStateHandler);
    window.addEventListener('syncGraphFromChat', syncGraphFromChatHandler);
    window.addEventListener('syncGraphFromKnowledge', syncGraphFromKnowledgeHandler);

    this.eventListeners.set('loadSnapshot', loadSnapshotHandler);
    this.eventListeners.set('restoreGraphState', restoreGraphStateHandler);
    this.eventListeners.set('syncGraphFromChat', syncGraphFromChatHandler);
    this.eventListeners.set('syncGraphFromKnowledge', syncGraphFromKnowledgeHandler);
  }

  private notifyListeners(state: GraphSyncState): void {
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('Graph sync listener error:', error);
      }
    });
  }

  /**
   * 订阅图谱状态变化
   */
  subscribe(listener: GraphSyncListener): () => void {
    this.listeners.add(listener);

    // 立即通知当前状态
    const graphState = useGraphStore.getState();
    if (graphState.entities.length > 0) {
      listener({
        entities: graphState.entities,
        relations: graphState.relations,
        keywords: graphState.keywords,
        sessionId: graphState.sessionId || undefined,
        messageId: graphState.messageId || undefined,
        lastUpdated: graphState.lastUpdated,
      });
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 获取当前图谱状态
   */
  getState(): GraphSyncState | null {
    const graphState = useGraphStore.getState();
    if (graphState.entities.length === 0) {
      return null;
    }
    return {
      entities: graphState.entities,
      relations: graphState.relations,
      keywords: graphState.keywords,
      sessionId: graphState.sessionId || undefined,
      messageId: graphState.messageId || undefined,
      lastUpdated: graphState.lastUpdated,
    };
  }

  /**
   * 更新图谱数据（从 Chat 模块）
   */
  updateFromChat(
    entities: Entity[],
    relations: Relation[],
    keywords: string[],
    sessionId?: string,
    messageId?: string
  ): void {
    useGraphStore.getState().updateGraphData(
      entities,
      relations,
      keywords,
      sessionId,
      messageId,
      'chat'
    );

    // 触发事件通知 Knowledge 模块
    const event = new CustomEvent('syncGraphFromChat', {
      detail: {
        entities,
        relations,
        keywords,
        sessionId,
        messageId,
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * 更新图谱数据（从 Knowledge 模块）
   */
  updateFromKnowledge(entities: Entity[], relations: Relation[], keywords: string[]): void {
    useGraphStore.getState().updateGraphData(
      entities,
      relations,
      keywords,
      undefined,
      undefined,
      'knowledge'
    );

    // 触发事件通知 Chat 模块
    const event = new CustomEvent('syncGraphFromKnowledge', {
      detail: {
        entities,
        relations,
        keywords,
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * 清除图谱状态
   */
  clear(): void {
    useGraphStore.getState().clearGraphData();
  }

  /**
   * 销毁服务（移除所有事件监听）
   */
  destroy(): void {
    this.eventListeners.forEach((handler, eventName) => {
      window.removeEventListener(eventName, handler);
    });
    this.eventListeners.clear();
    this.listeners.clear();
  }
}

// 导出单例
export const graphSyncService = GraphSyncService.getInstance();

// 辅助 Hook：在组件中使用图谱同步
export function useGraphSync(onSync?: (state: GraphSyncState) => void): {
  state: GraphSyncState | null;
  updateFromChat: typeof graphSyncService.updateFromChat;
  updateFromKnowledge: typeof graphSyncService.updateFromKnowledge;
  clear: typeof graphSyncService.clear;
} {
  const [state, setState] = useState<GraphSyncState | null>(null);

  useEffect(() => {
    const unsubscribe = graphSyncService.subscribe((newState) => {
      setState(newState);
      if (onSync) {
        onSync(newState);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onSync]);

  return {
    state,
    updateFromChat: graphSyncService.updateFromChat.bind(graphSyncService),
    updateFromKnowledge: graphSyncService.updateFromKnowledge.bind(graphSyncService),
    clear: graphSyncService.clear.bind(graphSyncService),
  };
}
