/**
 * LLM 智能搜索 Hook
 * 提供基于自然语言的智能搜索功能
 */

import { useState, useCallback, useRef } from 'react';
import { knowledgeApi } from '../api/knowledge';
import type { Entity } from '../api/knowledge';

export interface LLMSearchResult {
  id: string;
  name: string;
  description?: string;
  type: string;
  relevance_score: number;
  match_reasons?: string[];
  data: Entity;
}

export interface LLMSearchResponse {
  results: LLMSearchResult[];
  search_time_ms: number;
  explanation?: string;
  suggestions?: string[];
}

export interface SearchSuggestion {
  query: string;
  type: 'entity' | 'relation' | 'attribute';
  confidence: number;
}

export interface UseLLMSearchOptions {
  autoSearch?: boolean;
  debounceMs?: number;
  defaultTopK?: number;
  enableCache?: boolean;
  onSearchComplete?: (response: LLMSearchResponse) => void;
}

export function useLLMSearch(options: UseLLMSearchOptions = {}) {
  const {
    autoSearch = false,
    debounceMs = 300,
    defaultTopK = 20,
    enableCache = true,
    onSearchComplete,
  } = options;

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [response, setResponse] = useState<LLMSearchResponse | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout>();
  const cache = useRef<Map<string, LLMSearchResponse>>(new Map());

  // 简单的关键词提取（替代 LLM）
  const extractKeywords = useCallback((text: string): string[] => {
    // 移除常见停用词
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
    ]);
    const keywords = text
      .split(/[\s,，。、？！?!]+/)
      .filter((word) => word.length > 0 && !stopWords.has(word));
    return keywords.slice(0, 10);
  }, []);

  // 执行搜索
  const performSearch = useCallback(
    async (
      searchQuery: string,
      filters?: {
        entity_types?: string[];
        regions?: string[];
        periods?: string[];
      }
    ) => {
      if (!searchQuery.trim()) {
        setResponse(null);
        return;
      }

      setLoading(true);
      setError(null);

      const startTime = Date.now();

      try {
        // 检查缓存
        const cacheKey = `${searchQuery}:${JSON.stringify(filters || {})}`;
        if (enableCache && cache.current.has(cacheKey)) {
          const cached = cache.current.get(cacheKey);
          if (cached) {
            setResponse(cached);
            setLoading(false);
            onSearchComplete?.(cached);
            return;
          }
        }

        // 提取关键词
        const keywords = extractKeywords(searchQuery);

        // 使用现有的 knowledge API 进行搜索
        const searchResults = await knowledgeApi.search({
          keyword: keywords.join(' '),
          category: filters?.entity_types?.[0],
          region: filters?.regions,
          period: filters?.periods,
          page: 1,
          page_size: defaultTopK,
        });

        // 转换结果格式
        const results: LLMSearchResult[] = searchResults.results.map((entity) => {
          const matchReasons: string[] = [];

          // 计算匹配原因
          if (keywords.some((kw) => entity.name.includes(kw))) {
            matchReasons.push('名称匹配');
          }
          if (entity.description && keywords.some((kw) => entity.description?.includes(kw))) {
            matchReasons.push('描述匹配');
          }
          if (filters?.entity_types?.includes(entity.type)) {
            matchReasons.push('类型匹配');
          }

          return {
            id: entity.id,
            name: entity.name,
            description: entity.description,
            type: entity.type,
            relevance_score: entity.importance || 0.5,
            match_reasons: matchReasons,
            data: entity,
          };
        });

        // 生成建议查询
        const suggestedQueries = keywords
          .slice(0, 3)
          .flatMap((kw) => [`${kw} 的历史`, `${kw} 的传承`, `${kw} 的特点`]);

        const searchTime = Date.now() - startTime;

        const searchResponse: LLMSearchResponse = {
          results,
          search_time_ms: searchTime,
          explanation: `基于关键词 "${keywords.join(', ')}" 找到 ${results.length} 个相关结果`,
          suggestions: suggestedQueries,
        };

        // 缓存结果
        if (enableCache) {
          cache.current.set(cacheKey, searchResponse);
        }

        setResponse(searchResponse);
        onSearchComplete?.(searchResponse);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('搜索失败');
        setError(error);
        console.error('LLM Search error:', error);
      } finally {
        setLoading(false);
      }
    },
    [defaultTopK, enableCache, extractKeywords, onSearchComplete]
  );

  // 带防抖的搜索
  const search = useCallback(
    (searchQuery: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        performSearch(searchQuery);
      }, debounceMs);
    },
    [debounceMs, performSearch]
  );

  // 立即搜索（无防抖）
  const searchNow = useCallback(
    (
      newQuery?: string,
      filters?: {
        entity_types?: string[];
        regions?: string[];
        periods?: string[];
      }
    ) => {
      const queryToSearch = newQuery ?? query;
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      return performSearch(queryToSearch, filters);
    },
    [performSearch, query]
  );

  // 处理查询变化
  const handleQueryChange = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      if (autoSearch) {
        search(newQuery);
      }
    },
    [autoSearch, search]
  );

  // 是否有结果
  const hasResults = response && response.results.length > 0;
  const resultCount = response?.results.length || 0;
  const searchTime = response?.search_time_ms || 0;

  return {
    query,
    loading,
    response,
    error,
    setQuery,
    search,
    searchNow,
    handleQueryChange,
    hasResults,
    resultCount,
    searchTime,
  };
}
