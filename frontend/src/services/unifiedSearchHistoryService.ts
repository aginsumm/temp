/**
 * 统一的搜索历史服务
 * 为 Chat 和 Knowledge 模块提供一致的搜索历史管理
 * 修复 userId 处理问题，统一使用 auth store 获取当前用户 ID
 */

import { useAuthStore } from '../stores/authStore';
import { knowledgeApi } from '../api/knowledge';

/**
 * 统一的搜索历史项
 */
export interface UnifiedSearchHistoryItem {
  id: string;
  user_id: string;
  query: string;
  query_type: 'chat' | 'knowledge' | 'entity' | 'relationship';
  filters?: {
    types?: string[];
    regions?: string[];
    periods?: string[];
    categories?: string[];
  };
  result_count?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  created_at: string;
}

/**
 * 搜索历史列表响应
 */
export interface UnifiedSearchHistoryResponse {
  items: UnifiedSearchHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

class UnifiedSearchHistoryService {
  private localCache: Map<string, UnifiedSearchHistoryItem[]> = new Map();
  private readonly MAX_LOCAL_ITEMS = 50;

  /**
   * 获取当前用户 ID（统一使用 auth store）
   */
  private getCurrentUserId(): string | null {
    // 使用 Zustand store 获取当前用户
    const authStore = useAuthStore.getState();
    return authStore.user?.id || null;
  }

  /**
   * 保存搜索历史（统一入口）
   */
  async saveSearch(
    query: string,
    queryType: 'chat' | 'knowledge' | 'entity' | 'relationship',
    filters?: UnifiedSearchHistoryItem['filters'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>
  ): Promise<boolean> {
    const userId = this.getCurrentUserId();

    // 如果没有用户 ID，保存到本地缓存
    if (!userId) {
      this.saveToLocal(query, queryType, filters, metadata);
      return true;
    }

    try {
      // 调用后端 API 保存
      if (queryType === 'knowledge' || queryType === 'entity' || queryType === 'relationship') {
        await knowledgeApi.saveSearchHistory(
          userId,
          query,
          {
            category: filters?.categories?.[0],
            region: filters?.regions,
            period: filters?.periods,
          },
          metadata?.resultCount || 0
        );
      }

      // 同时更新本地缓存
      this.updateLocalCache(userId, query, queryType, filters, metadata);

      return true;
    } catch (error) {
      console.error('Failed to save search history:', error);
      // 失败时保存到本地
      this.saveToLocal(query, queryType, filters, metadata);
      return false;
    }
  }

  /**
   * 获取搜索历史列表
   */
  async getHistory(
    options: {
      page?: number;
      pageSize?: number;
      queryType?: 'chat' | 'knowledge' | 'entity' | 'relationship';
      days?: number; // 最近 N 天的记录
    } = {}
  ): Promise<UnifiedSearchHistoryResponse> {
    const { page = 1, pageSize = 20, queryType, days } = options;
    const userId = this.getCurrentUserId();

    // 如果没有用户 ID，返回本地缓存
    if (!userId) {
      return this.getFromLocal(queryType);
    }

    try {
      // 从后端获取历史记录
      const items = await knowledgeApi.getSearchHistory(userId, pageSize);

      // 转换为统一格式
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unifiedItems: UnifiedSearchHistoryItem[] = items.map((item: any) => ({
        id: item.id || `history_${Date.now()}_${Math.random()}`,
        user_id: userId,
        query: item.keyword || item.query,
        query_type: 'knowledge',
        filters: {
          categories: item.category ? [item.category] : undefined,
          regions: item.region
            ? Array.isArray(item.region)
              ? item.region
              : [item.region]
            : undefined,
          periods: item.period
            ? Array.isArray(item.period)
              ? item.period
              : [item.period]
            : undefined,
        },
        result_count: item.result_count,
        created_at: item.created_at || new Date().toISOString(),
      }));

      // 过滤类型
      let filteredItems = unifiedItems;
      if (queryType) {
        filteredItems = unifiedItems.filter((item) => item.query_type === queryType);
      }

      // 过滤时间范围
      if (days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        filteredItems = filteredItems.filter((item) => new Date(item.created_at) >= cutoffDate);
      }

      return {
        items: filteredItems.slice(0, pageSize),
        total: filteredItems.length,
        page,
        page_size: pageSize,
        has_more: filteredItems.length > pageSize,
      };
    } catch (error) {
      console.error('Failed to get search history:', error);
      return this.getFromLocal(queryType);
    }
  }

  /**
   * 删除搜索历史
   */
  async deleteHistory(historyId: string): Promise<boolean> {
    const userId = this.getCurrentUserId();

    if (!userId) {
      // 从本地缓存删除
      this.deleteFromLocal(historyId);
      return true;
    }

    try {
      // 调用后端 API 删除
      await knowledgeApi.deleteSearchHistory(historyId);

      // 同时从本地缓存删除
      this.deleteFromLocal(historyId);

      return true;
    } catch (error) {
      console.error('Failed to delete search history:', error);
      this.deleteFromLocal(historyId);
      return false;
    }
  }

  /**
   * 清空搜索历史
   */
  async clearHistory(
    queryType?: 'chat' | 'knowledge' | 'entity' | 'relationship'
  ): Promise<boolean> {
    const userId = this.getCurrentUserId();

    if (!userId) {
      // 清空本地缓存
      this.clearLocal(queryType);
      return true;
    }

    try {
      // 调用后端 API 清空
      await knowledgeApi.clearSearchHistory(userId);

      // 同时清空本地缓存
      this.clearLocal(queryType);

      return true;
    } catch (error) {
      console.error('Failed to clear search history:', error);
      this.clearLocal(queryType);
      return false;
    }
  }

  /**
   * 搜索搜索历史（支持关键词搜索）
   */
  async searchHistory(
    keyword: string,
    options: {
      queryType?: 'chat' | 'knowledge' | 'entity' | 'relationship';
      limit?: number;
    } = {}
  ): Promise<UnifiedSearchHistoryItem[]> {
    const { queryType, limit = 20 } = options;
    const history = await this.getHistory({ queryType, pageSize: 100 });

    // 过滤匹配的搜索历史
    const matched = history.items.filter((item) =>
      item.query.toLowerCase().includes(keyword.toLowerCase())
    );

    return matched.slice(0, limit);
  }

  /**
   * 获取热门搜索（统计高频搜索词）
   */
  async getPopularSearches(limit: number = 10): Promise<string[]> {
    const history = await this.getHistory({ pageSize: 1000 });

    // 统计词频
    const frequency = new Map<string, number>();
    history.items.forEach((item) => {
      const query = item.query.toLowerCase().trim();
      if (query) {
        frequency.set(query, (frequency.get(query) || 0) + 1);
      }
    });

    // 排序并返回 Top N
    const sorted = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query]) => query);

    return sorted;
  }

  // ============================================================================
  // 本地缓存方法（用于离线或无用户 ID 时）
  // ============================================================================

  private saveToLocal(
    query: string,
    queryType: string,
    filters?: UnifiedSearchHistoryItem['filters'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>
  ): void {
    const localKey = 'unified_search_history';
    const stored = localStorage.getItem(localKey);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let items: UnifiedSearchHistoryItem[] = stored ? JSON.parse(stored) : [];

    const newItem: UnifiedSearchHistoryItem = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      user_id: 'anonymous',
      query,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query_type: queryType as any,
      filters,
      result_count: metadata?.resultCount,
      metadata,
      created_at: new Date().toISOString(),
    };

    // 添加到开头
    items = [newItem, ...items].slice(0, this.MAX_LOCAL_ITEMS);

    localStorage.setItem(localKey, JSON.stringify(items));
  }

  private getFromLocal(queryType?: string): UnifiedSearchHistoryResponse {
    const localKey = 'unified_search_history';
    const stored = localStorage.getItem(localKey);
    const items: UnifiedSearchHistoryItem[] = stored ? JSON.parse(stored) : [];

    let filteredItems = items;
    if (queryType) {
      filteredItems = items.filter((item) => item.query_type === queryType);
    }

    return {
      items: filteredItems.slice(0, 20),
      total: filteredItems.length,
      page: 1,
      page_size: 20,
      has_more: filteredItems.length > 20,
    };
  }

  private updateLocalCache(
    userId: string,
    query: string,
    queryType: string,
    filters?: UnifiedSearchHistoryItem['filters'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>
  ): void {
    const items = this.localCache.get(userId) || [];
    const existingIndex = items.findIndex((item) => item.query === query);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newItem: UnifiedSearchHistoryItem = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      user_id: userId,
      query,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query_type: queryType as any,
      filters,
      result_count: metadata?.resultCount,
      metadata,
      created_at: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      // 更新现有项
      items[existingIndex] = newItem;
      // 移到开头
      items.splice(existingIndex, 1);
      items.unshift(newItem);
    } else {
      // 添加新项
      items.unshift(newItem);
    }

    this.localCache.set(userId, items.slice(0, this.MAX_LOCAL_ITEMS));
  }

  private deleteFromLocal(historyId: string): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    const items = this.localCache.get(userId) || [];
    const filtered = items.filter((item) => item.id !== historyId);
    this.localCache.set(userId, filtered);
  }

  private clearLocal(queryType?: string): void {
    const userId = this.getCurrentUserId();
    if (!userId) {
      // 清空 localStorage
      localStorage.removeItem('unified_search_history');
      return;
    }

    if (queryType) {
      // 只清空指定类型
      const items = this.localCache.get(userId) || [];
      const filtered = items.filter((item) => item.query_type !== queryType);
      this.localCache.set(userId, filtered);
    } else {
      // 清空所有
      this.localCache.delete(userId);
    }
  }
}

// 导出单例
export const unifiedSearchHistoryService = new UnifiedSearchHistoryService();

export default unifiedSearchHistoryService;
