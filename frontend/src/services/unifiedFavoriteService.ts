/**
 * 统一的收藏功能服务
 * 为 Chat 和 Knowledge 模块提供一致的收藏功能
 */

import { favoritesApi } from '../api/favorites';
import { knowledgeApi } from '../api/knowledge';

/**
 * 统一的收藏项类型
 */
export interface UnifiedFavoriteItem {
  id: string;
  user_id: string;
  content_type: 'chat_message' | 'knowledge_entity' | 'knowledge_relationship';
  content_id: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

/**
 * 收藏列表响应
 */
export interface UnifiedFavoriteListResponse {
  favorites: UnifiedFavoriteItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

class UnifiedFavoriteService {
  private localCache: Map<string, UnifiedFavoriteItem> = new Map();
  private cacheTimestamp: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 分钟

  /**
   * 获取所有收藏（支持分页和过滤）
   */
  async getFavorites(
    options: {
      page?: number;
      pageSize?: number;
      contentType?: 'chat_message' | 'knowledge_entity' | 'knowledge_relationship';
      searchQuery?: string;
    } = {}
  ): Promise<UnifiedFavoriteListResponse> {
    const { page = 1, pageSize = 20, contentType, searchQuery } = options;

    try {
      // 从 API 获取收藏列表
      const chatFavorites = await favoritesApi.getFavorites(page, pageSize);

      // 转换为统一格式
      const unifiedFavorites: UnifiedFavoriteItem[] = chatFavorites.favorites.map((item) => ({
        id: item.id,
        user_id: item.user_id,
        content_type: 'chat_message' as const,
        content_id: item.message_id,
        content: item.message_content || '',
        metadata: {
          session_id: item.session_id,
        },
        created_at: item.created_at,
      }));

      // 如果有搜索查询，进行过滤
      let filteredFavorites = unifiedFavorites;
      if (searchQuery) {
        filteredFavorites = unifiedFavorites.filter((item) =>
          item.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // 如果指定了内容类型，进行过滤
      if (contentType) {
        filteredFavorites = filteredFavorites.filter((item) => item.content_type === contentType);
      }

      return {
        favorites: filteredFavorites,
        total: filteredFavorites.length,
        page,
        page_size: pageSize,
        has_more: chatFavorites.favorites.length === pageSize,
      };
    } catch (error) {
      console.error('Failed to load favorites:', error);
      // 返回本地缓存
      return this.getFromCache();
    }
  }

  /**
   * 添加收藏（支持聊天消息和知识实体）
   */
  async addFavorite(
    contentId: string,
    contentType: 'chat_message' | 'knowledge_entity' | 'knowledge_relationship',
    content: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _metadata?: Record<string, unknown>
  ): Promise<UnifiedFavoriteItem> {
    try {
      let favoriteItem: UnifiedFavoriteItem;

      if (contentType === 'chat_message') {
        // 调用聊天 API 添加收藏
        const chatFavorite = await favoritesApi.addFavorite(contentId);
        favoriteItem = {
          id: chatFavorite.id,
          user_id: chatFavorite.user_id,
          content_type: 'chat_message',
          content_id: contentId,
          content: chatFavorite.message_content || content,
          metadata: {
            session_id: chatFavorite.session_id,
          },
          created_at: chatFavorite.created_at,
        };
      } else if (contentType === 'knowledge_entity') {
        // 知识实体收藏（调用 Knowledge API）
        const entity = await knowledgeApi.getEntity(contentId);
        favoriteItem = {
          id: `fav_entity_${contentId}`,
          user_id: entity.id, // 使用 entity.id 作为 user_id 的占位符
          content_type: 'knowledge_entity',
          content_id: contentId,
          content: entity.name,
          metadata: {
            entityType: entity.type,
            description: entity.description,
          },
          created_at: new Date().toISOString(),
        };
      } else {
        throw new Error('Unsupported content type');
      }

      // 更新本地缓存
      this.localCache.set(favoriteItem.id, favoriteItem);
      this.cacheTimestamp.set(favoriteItem.id, Date.now());

      return favoriteItem;
    } catch (error) {
      console.error('Failed to add favorite:', error);
      throw error;
    }
  }

  /**
   * 移除收藏
   */
  async removeFavorite(
    favoriteId: string,
    contentType?: 'chat_message' | 'knowledge_entity'
  ): Promise<boolean> {
    try {
      // 如果是聊天消息收藏，调用聊天 API
      if (!contentType || contentType === 'chat_message') {
        await favoritesApi.removeFavorite(favoriteId);
      }

      // 从本地缓存移除
      this.localCache.delete(favoriteId);
      this.cacheTimestamp.delete(favoriteId);

      return true;
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      return false;
    }
  }

  /**
   * 检查是否已收藏
   */
  async isFavorited(
    contentId: string,
    contentType: 'chat_message' | 'knowledge_entity'
  ): Promise<boolean> {
    try {
      if (contentType === 'chat_message') {
        const result = await favoritesApi.checkFavorite(contentId);
        return result.is_favorite;
      } else if (contentType === 'knowledge_entity') {
        // 知识实体收藏检查（本地实现）
        const cacheKey = `entity_${contentId}`;
        return this.localCache.has(cacheKey);
      }
      return false;
    } catch (error) {
      console.error('Failed to check favorite status:', error);
      return false;
    }
  }

  /**
   * 批量添加收藏
   */
  async addFavorites(
    items: Array<{
      contentId: string;
      contentType: 'chat_message' | 'knowledge_entity';
      content: string;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<UnifiedFavoriteItem[]> {
    const results: UnifiedFavoriteItem[] = [];

    for (const item of items) {
      try {
        const favorite = await this.addFavorite(
          item.contentId,
          item.contentType,
          item.content,
          item.metadata
        );
        results.push(favorite);
      } catch (error) {
        console.error(`Failed to add favorite ${item.contentId}:`, error);
      }
    }

    return results;
  }

  /**
   * 批量移除收藏
   */
  async removeFavorites(favoriteIds: string[]): Promise<number> {
    let successCount = 0;

    for (const id of favoriteIds) {
      const removed = await this.removeFavorite(id);
      if (removed) {
        successCount++;
      }
    }

    return successCount;
  }

  /**
   * 搜索收藏
   */
  async searchFavorites(
    query: string,
    options: {
      contentType?: 'chat_message' | 'knowledge_entity';
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<UnifiedFavoriteItem[]> {
    const allFavorites = await this.getFavorites({
      searchQuery: query,
      contentType: options.contentType,
    });

    let results = allFavorites.favorites;

    // 按日期过滤
    if (options.dateFrom) {
      results = results.filter((item) => new Date(item.created_at) >= options.dateFrom!);
    }
    if (options.dateTo) {
      results = results.filter((item) => new Date(item.created_at) <= options.dateTo!);
    }

    return results;
  }

  /**
   * 获取收藏统计信息
   */
  async getStats(): Promise<{
    totalCount: number;
    chatMessageCount: number;
    knowledgeEntityCount: number;
    recentCount: number; // 最近 7 天的收藏数
  }> {
    try {
      const allFavorites = await this.getFavorites({ page: 1, pageSize: 1000 });
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      return {
        totalCount: allFavorites.total,
        chatMessageCount: allFavorites.favorites.filter(
          (item) => item.content_type === 'chat_message'
        ).length,
        knowledgeEntityCount: allFavorites.favorites.filter(
          (item) => item.content_type === 'knowledge_entity'
        ).length,
        recentCount: allFavorites.favorites.filter(
          (item) => new Date(item.created_at).getTime() > sevenDaysAgo
        ).length,
      };
    } catch (error) {
      console.error('Failed to get favorite stats:', error);
      return {
        totalCount: 0,
        chatMessageCount: 0,
        knowledgeEntityCount: 0,
        recentCount: 0,
      };
    }
  }

  /**
   * 导出收藏数据
   */
  async exportFavorites(format: 'json' | 'csv' = 'json'): Promise<string> {
    const allFavorites = await this.getFavorites({ page: 1, pageSize: 1000 });

    if (format === 'json') {
      return JSON.stringify(allFavorites.favorites, null, 2);
    } else if (format === 'csv') {
      const headers = ['ID', 'Content Type', 'Content', 'Created At'];
      const rows = allFavorites.favorites.map((item) => [
        item.id,
        item.content_type,
        `"${item.content.replace(/"/g, '""')}"`,
        item.created_at,
      ]);

      return [headers, ...rows].map((row) => row.join(',')).join('\n');
    }

    return '';
  }

  /**
   * 从缓存获取数据
   */
  private getFromCache(): UnifiedFavoriteListResponse {
    const now = Date.now();
    const validItems: UnifiedFavoriteItem[] = [];

    this.localCache.forEach((item, id) => {
      const timestamp = this.cacheTimestamp.get(id);
      if (timestamp && now - timestamp < this.CACHE_TTL) {
        validItems.push(item);
      }
    });

    return {
      favorites: validItems,
      total: validItems.length,
      page: 1,
      page_size: 20,
      has_more: false,
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.localCache.clear();
    this.cacheTimestamp.clear();
  }
}

// 导出单例
export const unifiedFavoriteService = new UnifiedFavoriteService();

export default unifiedFavoriteService;
