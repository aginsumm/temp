/**
 * 图谱数据中心 v2
 * 统一的图谱数据管理中心，负责 Chat 和 Knowledge 模块之间的数据同步
 * 支持冲突解决、版本控制、队列处理和持久化
 */

import { EventEmitter } from 'eventemitter3';
import type { Entity, Relation } from '../types/chat';

/**
 * 图谱数据状态接口
 */
export interface GraphDataState {
  entities: Entity[];
  relations: Relation[];
  keywords: string[];
  sessionId?: string;
  messageId?: string;
  source: 'chat' | 'knowledge' | 'snapshot' | 'sync';
  timestamp: number;
  version: number;
}

/**
 * 图谱数据 Hub 事件类型定义
 */
export interface GraphDataHubEvents {
  'graph:update': (data: GraphDataState) => void;
  'graph:clear': () => void;
  'graph:sync': (data: GraphDataState) => void;
  'graph:conflict': (local: GraphDataState, remote: GraphDataState) => void;
}

/**
 * 冲突解决策略接口
 */
export interface ConflictResolver {
  resolve(local: GraphDataState, remote: GraphDataState): GraphDataState;
}

/**
 * 基于时间戳的冲突解决器（最新获胜）
 */
export class TimestampConflictResolver implements ConflictResolver {
  resolve(local: GraphDataState, remote: GraphDataState): GraphDataState {
    return local.timestamp > remote.timestamp ? local : remote;
  }
}

/**
 * 合并冲突解决器（合并数据）
 */
export class MergeConflictResolver implements ConflictResolver {
  resolve(local: GraphDataState, remote: GraphDataState): GraphDataState {
    const mergedEntities = [
      ...local.entities,
      ...remote.entities.filter((e) => !local.entities.find((le) => le.id === e.id)),
    ];

    const mergedRelations = [
      ...local.relations,
      ...remote.relations.filter(
        (r) =>
          !local.relations.find(
            (lr) => lr.source === r.source && lr.target === r.target && lr.type === r.type
          )
      ),
    ];

    const mergedKeywords = [...new Set([...local.keywords, ...remote.keywords])];

    return {
      ...local,
      entities: mergedEntities,
      relations: mergedRelations,
      keywords: mergedKeywords,
      timestamp: Date.now(),
    };
  }
}

/**
 * 图谱数据中心类
 * 使用单例模式，确保全局只有一个实例
 */
class GraphDataHub extends EventEmitter<GraphDataHubEvents> {
  private static instance: GraphDataHub;

  private currentState: GraphDataState | null = null;
  private versionCounter = 0;
  private updateQueue: GraphDataState[] = [];
  private isProcessing = false;
  private conflictResolver: ConflictResolver;

  private constructor() {
    super();
    this.conflictResolver = new MergeConflictResolver();
    this.initEventListeners();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): GraphDataHub {
    if (!GraphDataHub.instance) {
      GraphDataHub.instance = new GraphDataHub();
    }
    return GraphDataHub.instance;
  }

  /**
   * 设置冲突解决策略
   */
  setConflictResolver(resolver: ConflictResolver): void {
    this.conflictResolver = resolver;
  }

  /**
   * 初始化事件监听器
   */
  private initEventListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('chatGraphUpdate', (event) => {
      const customEvent = event as CustomEvent<GraphDataState>;
      this.enqueueUpdate({
        ...customEvent.detail,
        source: 'chat',
      });
    });

    window.addEventListener('knowledgeGraphUpdate', (event) => {
      const customEvent = event as CustomEvent<GraphDataState>;
      this.enqueueUpdate({
        ...customEvent.detail,
        source: 'knowledge',
      });
    });

    window.addEventListener('loadSnapshot', (event) => {
      const customEvent = event as CustomEvent<{
        entities?: Entity[];
        relations?: Relation[];
        keywords?: string[];
        snapshot?: {
          session_id?: string;
          message_id?: string;
        };
      }>;
      const { entities = [], relations = [], keywords = [], snapshot } = customEvent.detail;

      this.enqueueUpdate({
        entities,
        relations,
        keywords,
        sessionId: snapshot?.session_id,
        messageId: snapshot?.message_id,
        source: 'snapshot',
        timestamp: Date.now(),
      });
    });
  }

  /**
   * 入队更新请求（避免竞态条件）
   */
  async enqueueUpdate(data: Omit<GraphDataState, 'version'>): Promise<void> {
    const update: GraphDataState = {
      ...data,
      version: ++this.versionCounter,
    };

    this.updateQueue.push(update);

    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * 处理更新队列
   */
  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    while (this.updateQueue.length > 0) {
      this.updateQueue.sort((a, b) => a.version - b.version);

      const update = this.updateQueue.shift()!;
      await this.applyUpdate(update);
    }

    this.isProcessing = false;
  }

  /**
   * 应用更新
   */
  private async applyUpdate(update: GraphDataState): Promise<void> {
    console.log('🔵 graphDataHub.applyUpdate:', {
      entities: update.entities.length,
      relations: update.relations.length,
      source: update.source,
    });

    if (this.currentState) {
      const hasConflict = this.detectConflict(this.currentState, update);

      if (hasConflict) {
        const resolved = this.conflictResolver.resolve(this.currentState, update);

        this.currentState = resolved;
        this.emit('graph:conflict', this.currentState, update);
      } else {
        this.currentState = update;
      }
    } else {
      this.currentState = update;
    }

    if (update.sessionId) {
      this.persistToSessionStorage(update);
    }

    console.log('✅ graphDataHub 发出 graph:update 事件');
    this.emit('graph:update', this.currentState);
    this.emit('graph:sync', this.currentState);

    this.broadcastToOtherTabs(this.currentState);
  }

  /**
   * 冲突检测
   */
  private detectConflict(current: GraphDataState, update: GraphDataState): boolean {
    if (current.source === update.source) {
      return false;
    }

    const currentEntityIds = new Set(current.entities.map((e) => e.id));
    const updateEntityIds = new Set(update.entities.map((e) => e.id));

    const intersection = [...currentEntityIds].filter((id) => updateEntityIds.has(id));

    return intersection.length > 0;
  }

  /**
   * 持久化到 sessionStorage
   */
  private persistToSessionStorage(data: GraphDataState): void {
    if (!data.sessionId) return;

    try {
      sessionStorage.setItem(
        `graphState_${data.sessionId}`,
        JSON.stringify({
          entities: data.entities,
          relations: data.relations,
          keywords: data.keywords,
          timestamp: data.timestamp,
          version: data.version,
        })
      );
    } catch (error) {
      console.warn('Failed to persist graph state:', error);
    }
  }

  /**
   * 从 sessionStorage 恢复
   */
  async restoreFromSessionStorage(sessionId: string): Promise<GraphDataState | null> {
    if (typeof window === 'undefined') return null;

    try {
      const stored = sessionStorage.getItem(`graphState_${sessionId}`);
      if (!stored) return null;

      const data = JSON.parse(stored);

      return {
        entities: data.entities,
        relations: data.relations,
        keywords: data.keywords,
        sessionId,
        source: 'sync',
        timestamp: data.timestamp,
        version: data.version,
      };
    } catch (error) {
      console.warn('Failed to restore graph state:', error);
      return null;
    }
  }

  /**
   * 广播到其他标签页
   */
  private broadcastToOtherTabs(data: GraphDataState): void {
    if (typeof window === 'undefined') return;

    try {
      const channel = new BroadcastChannel('graph_sync_channel');
      channel.postMessage({
        type: 'GRAPH_UPDATE',
        data,
      });
    } catch (error) {
      console.warn('Failed to broadcast:', error);
    }
  }

  /**
   * 获取当前状态
   */
  getCurrentState(): GraphDataState | null {
    return this.currentState;
  }

  /**
   * 清空图谱数据
   */
  clear(): void {
    this.currentState = null;
    this.emit('graph:clear');
  }

  /**
   * 销毁实例，清理所有监听器
   */
  destroy(): void {
    if (typeof window === 'undefined') return;

    this.removeAllListeners();
    this.updateQueue = [];
    this.currentState = null;
    this.versionCounter = 0;
  }
}

export const graphDataHub = GraphDataHub.getInstance();

export { GraphDataHub };

export default graphDataHub;
