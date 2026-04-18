/**
 * LLM 搜索服务
 * 提供智能搜索功能（当前使用关键词匹配替代 LLM）
 */

import type { Entity } from '../types/chat';

export interface SearchOptions {
  topK?: number;
  minRelevance?: number;
  entityTypes?: string[];
  regions?: string[];
  periods?: string[];
}

export interface SearchResult {
  entity: Entity;
  relevanceScore: number;
  matchReasons: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  searchTimeMs: number;
  explanation?: string;
  suggestions?: string[];
}

class LLMSearchService {
  private cache = new Map<string, SearchResponse>();

  /**
   * 提取查询中的关键词
   */
  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      '的',
      '了',
      '在',
      '是',
      '我',
      '有',
      '和',
      '就',
      '不',
      '人',
      '都',
      '一',
      '一个',
      'what',
      'is',
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
    ]);

    const keywords = query
      .split(/[\s,，。、？！?!]+/)
      .filter((word) => word.length > 1 && !stopWords.has(word.toLowerCase()));

    return keywords.slice(0, 10);
  }

  /**
   * 计算实体与查询的相关性
   */
  private calculateRelevance(
    entity: Entity,
    keywords: string[]
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // 名称匹配（权重最高）
    const nameMatch = keywords.filter((kw) => entity.name.toLowerCase().includes(kw.toLowerCase()));
    if (nameMatch.length > 0) {
      score += 0.5 * (nameMatch.length / keywords.length);
      reasons.push('名称匹配');
    }

    // 描述匹配
    if (entity.description) {
      const descMatch = keywords.filter((kw) =>
        entity.description?.toLowerCase().includes(kw.toLowerCase())
      );
      if (descMatch.length > 0) {
        score += 0.3 * (descMatch.length / keywords.length);
        reasons.push('描述匹配');
      }
    }

    // 类型匹配
    if (entity.type) {
      const typeMatch = keywords.some((kw) => entity.type.toLowerCase().includes(kw.toLowerCase()));
      if (typeMatch) {
        score += 0.1;
        reasons.push('类型匹配');
      }
    }

    // 基础相关性
    if (entity.relevance) {
      score += entity.relevance * 0.1;
    }

    return {
      score: Math.min(score, 1.0),
      reasons,
    };
  }

  /**
   * 执行搜索
   */
  async search(
    query: string,
    entities: Entity[],
    options: SearchOptions = {}
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    const { topK = 20, minRelevance = 0.1, entityTypes, regions, periods } = options;

    // 检查缓存
    const cacheKey = `${query}:${JSON.stringify(options)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (!query.trim()) {
      return {
        results: [],
        searchTimeMs: 0,
        explanation: '请输入搜索内容',
      };
    }

    const keywords = this.extractKeywords(query);

    // 过滤实体
    let filteredEntities = entities;

    if (entityTypes && entityTypes.length > 0) {
      filteredEntities = filteredEntities.filter((e) => entityTypes.includes(e.type));
    }

    if (regions && regions.length > 0) {
      filteredEntities = filteredEntities.filter((e) =>
        e.region || e.metadata?.region
          ? regions.includes(e.region || e.metadata?.region || '')
          : false
      );
    }

    if (periods && periods.length > 0) {
      filteredEntities = filteredEntities.filter((e) =>
        e.period || e.metadata?.period
          ? periods.includes(e.period || e.metadata?.period || '')
          : false
      );
    }

    // 计算相关性并排序
    const results: SearchResult[] = filteredEntities
      .map((entity) => {
        const { score, reasons } = this.calculateRelevance(entity, keywords);
        return {
          entity,
          relevanceScore: score,
          matchReasons: reasons,
        };
      })
      .filter((result) => result.relevanceScore >= minRelevance)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, topK);

    const searchTime = Date.now() - startTime;

    // 生成建议
    const suggestions = keywords
      .slice(0, 3)
      .flatMap((kw) => [`${kw} 的历史`, `${kw} 的传承`, `${kw} 的特点`]);

    const response: SearchResponse = {
      results,
      searchTimeMs: searchTime,
      explanation: `基于关键词 "${keywords.join(', ')}" 找到 ${results.length} 个相关结果`,
      suggestions,
    };

    // 缓存结果
    this.cache.set(cacheKey, response);

    return response;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const llmSearchService = new LLMSearchService();
