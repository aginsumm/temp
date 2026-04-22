/**
 * 统一的快照加载处理函数
 * 确保 Chat 和 Knowledge 模块以一致的方式加载和恢复快照
 */

import type { GraphSnapshot } from '../types/chat';
import type { Entity, Relation } from '../types/chat';

export interface SnapshotLoadResult {
  success: boolean;
  snapshot?: GraphSnapshot;
  entities: Entity[];
  relations: Relation[];
  keywords: string[];
  error?: string;
}

export interface SnapshotLoadOptions {
  /** 是否更新 FilterPanel 的筛选条件 */
  updateFilters?: boolean;
  /** 是否触发全局事件 */
  dispatchEvent?: boolean;
  /** 是否保存到 sessionStorage */
  saveToSession?: boolean;
  /** Session ID（用于恢复图谱状态） */
  sessionId?: string;
}

/**
 * 从快照中提取筛选条件
 */
export function extractFiltersFromSnapshot(snapshot: GraphSnapshot): {
  categories?: string[];
  regions?: string[];
  periods?: string[];
  keywords?: string[];
} {
  const categories = new Set<string>();
  const regions = new Set<string>();
  const periods = new Set<string>();

  // 从实体中提取类别、地区和时期
  snapshot.entities.forEach((entity) => {
    categories.add(entity.type);

    if (entity.metadata?.region) {
      regions.add(entity.metadata.region as string);
    }

    if (entity.metadata?.period) {
      periods.add(entity.metadata.period as string);
    }

    // 也检查 Knowledge 实体的字段
    const knowledgeEntity = entity as unknown as Record<string, unknown>;
    if (knowledgeEntity.region) {
      regions.add(knowledgeEntity.region as string);
    }
    if (knowledgeEntity.period) {
      periods.add(knowledgeEntity.period as string);
    }
  });

  return {
    categories: Array.from(categories),
    regions: Array.from(regions),
    periods: Array.from(periods),
    keywords: snapshot.keywords,
  };
}

/**
 * 加载快照的统一处理函数
 * @param snapshot 要加载的快照
 * @param options 加载选项
 * @returns 加载结果
 */
export async function loadSnapshot(
  snapshot: GraphSnapshot,
  options: SnapshotLoadOptions = {}
): Promise<SnapshotLoadResult> {
  const { updateFilters = true, dispatchEvent = true, saveToSession = false, sessionId } = options;

  try {
    // 提取数据
    const entities = snapshot.entities || [];
    const relations = snapshot.relations || [];
    const keywords = snapshot.keywords || [];

    // 提取筛选条件
    const filters = extractFiltersFromSnapshot(snapshot);

    // 保存到 sessionStorage（用于页面刷新后恢复）
    if (saveToSession && sessionId) {
      try {
        const graphState = {
          entities,
          relations,
          keywords,
          filters: updateFilters ? filters : undefined,
          snapshotId: snapshot.id,
          timestamp: Date.now(),
        };
        sessionStorage.setItem(`graphState_${sessionId}`, JSON.stringify(graphState));
      } catch (error) {
        console.warn('Failed to save snapshot to sessionStorage:', error);
      }
    }

    // 触发全局事件
    if (dispatchEvent) {
      const event = new CustomEvent('loadSnapshot', {
        detail: {
          snapshot,
          entities,
          relations,
          keywords,
          filters: updateFilters ? filters : undefined,
        },
      });
      window.dispatchEvent(event);
    }

    return {
      success: true,
      snapshot,
      entities,
      relations,
      keywords,
    };
  } catch (error) {
    console.error('Failed to load snapshot:', error);
    return {
      success: false,
      entities: [],
      relations: [],
      keywords: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 从 sessionStorage 恢复快照
 * @param sessionId 会话 ID
 * @returns 恢复结果
 */
export async function restoreSnapshotFromSession(
  sessionId: string
): Promise<SnapshotLoadResult | null> {
  try {
    const savedState = sessionStorage.getItem(`graphState_${sessionId}`);
    if (!savedState) {
      return null;
    }

    const { entities, relations, keywords, filters, snapshotId } = JSON.parse(savedState);

    // 检查是否是同一个会话的图谱状态
    if (!entities || entities.length === 0) {
      return null;
    }

    // 构造快照对象
    const snapshot: GraphSnapshot = {
      id: snapshotId || `restored_${Date.now()}`,
      session_id: sessionId,
      message_id: '',
      graph_data: { nodes: [], edges: [] },
      keywords: keywords || [],
      entities,
      relations: relations || [],
      created_at: new Date().toISOString(),
    };

    // 触发加载事件
    const event = new CustomEvent('restoreGraphState', {
      detail: {
        entities,
        relations,
        keywords,
        filters,
      },
    });
    window.dispatchEvent(event);

    return {
      success: true,
      snapshot,
      entities,
      relations,
      keywords,
    };
  } catch (error) {
    console.warn('Failed to restore snapshot from sessionStorage:', error);
    return null;
  }
}

/**
 * 清除 sessionStorage 中的快照
 * @param sessionId 会话 ID
 */
export function clearSnapshotFromSession(sessionId: string): void {
  try {
    sessionStorage.removeItem(`graphState_${sessionId}`);
  } catch (error) {
    console.warn('Failed to clear snapshot from sessionStorage:', error);
  }
}

/**
 * 保存快照到 sessionStorage
 * @param snapshot 快照对象
 * @param sessionId 会话 ID
 */
export function saveSnapshotToSession(snapshot: GraphSnapshot, sessionId: string): void {
  try {
    const graphState = {
      entities: snapshot.entities,
      relations: snapshot.relations,
      keywords: snapshot.keywords,
      filters: extractFiltersFromSnapshot(snapshot),
      snapshotId: snapshot.id,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(`graphState_${sessionId}`, JSON.stringify(graphState));
  } catch (error) {
    console.warn('Failed to save snapshot to sessionStorage:', error);
  }
}
