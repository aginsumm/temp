/**
 * LLM 智能搜索组件
 * 展示如何使用 LLM 智能搜索功能
 */

import React, { useState, useCallback } from 'react';
import { Search, Sparkles, X, ChevronRight } from 'lucide-react';
import { useLLMSearch } from '../../../hooks/useLLMSearch';
import { useToast } from '../../common/Toast';
import type { LLMSearchResult } from '../../../hooks/useLLMSearch';

interface LLMSearchPanelProps {
  /** 搜索完成回调 */
  onSearchComplete?: (results: LLMSearchResult[]) => void;
  /** 选择实体回调 */
  onEntitySelect?: (entityId: string) => void;
  /** 是否显示高级模式 */
  advancedMode?: boolean;
}

export function LLMSearchPanel({
  onSearchComplete,
  onEntitySelect,
  advancedMode = false,
}: LLMSearchPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(advancedMode);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedFilters, setSelectedFilters] = useState<{
    entity_types?: string[];
    regions?: string[];
    periods?: string[];
  }>({});

  const toast = useToast();

  const {
    query,
    loading,
    response,
    error,
    setQuery,
    searchNow,
    handleQueryChange,
    hasResults,
    resultCount,
    searchTime,
  } = useLLMSearch({
    autoSearch: false,
    debounceMs: 300,
    defaultTopK: 20,
    enableCache: true,
    onSearchComplete: (result) => {
      onSearchComplete?.(result.results);
      if (result.results.length > 0) {
        toast.success('搜索完成', `找到 ${result.results.length} 个相关结果`);
      } else {
        toast.info('暂无结果', '没有找到相关内容');
      }
    },
  });

  // 处理搜索提交
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        searchNow(undefined, {
          entity_types: selectedFilters.entity_types,
          regions: selectedFilters.regions,
          periods: selectedFilters.periods,
        });
      }
    },
    [query, searchNow, selectedFilters]
  );

  // 清除搜索
  const handleClear = useCallback(() => {
    setQuery('');
    setSelectedFilters({});
  }, [setQuery]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* 搜索框 */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="relative">
          <div className="flex items-center gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
            <Sparkles className="w-5 h-5 text-blue-500 flex-shrink-0" />

            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="用自然语言描述你想找的内容，例如：'明朝时期的瓷器制作工艺'..."
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400"
            />

            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">搜索</span>
            </button>
          </div>

          {/* 高级模式切换 */}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
            >
              {showAdvanced ? '收起' : '展开'}高级选项
              <ChevronRight
                className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* 高级选项 */}
        {showAdvanced && (
          <div className="mt-3 p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  实体类型
                </label>
                <select
                  multiple
                  value={selectedFilters.entity_types}
                  onChange={(e) =>
                    setSelectedFilters({
                      ...selectedFilters,
                      entity_types: Array.from(e.target.selectedOptions, (option) => option.value),
                    })
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="inheritor">传承人</option>
                  <option value="technique">技艺</option>
                  <option value="work">作品</option>
                  <option value="pattern">纹样</option>
                  <option value="region">地区</option>
                  <option value="period">时期</option>
                  <option value="material">材料</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  地区
                </label>
                <select
                  multiple
                  value={selectedFilters.regions}
                  onChange={(e) =>
                    setSelectedFilters({
                      ...selectedFilters,
                      regions: Array.from(e.target.selectedOptions, (option) => option.value),
                    })
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="北京">北京</option>
                  <option value="江苏">江苏</option>
                  <option value="浙江">浙江</option>
                  <option value="江西">江西</option>
                  <option value="广东">广东</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  时期
                </label>
                <select
                  multiple
                  value={selectedFilters.periods}
                  onChange={(e) =>
                    setSelectedFilters({
                      ...selectedFilters,
                      periods: Array.from(e.target.selectedOptions, (option) => option.value),
                    })
                  }
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="唐代">唐代</option>
                  <option value="宋代">宋代</option>
                  <option value="元代">元代</option>
                  <option value="明代">明代</option>
                  <option value="清代">清代</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* 加载状态 */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-500 dark:text-gray-400">AI 正在智能搜索中...</p>
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-red-600 dark:text-red-400">搜索失败：{error.message}</p>
        </div>
      )}

      {/* 搜索结果 */}
      {hasResults && response && (
        <div className="space-y-4">
          {/* 搜索统计 */}
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>找到 {resultCount} 个结果</span>
            <span>用时 {searchTime}ms</span>
          </div>

          {/* 结果列表 */}
          <div className="space-y-3">
            {response.results.map((result) => (
              <div
                key={result.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
                onClick={() => onEntitySelect?.(result.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(result.data as any).name}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(result.data as any).description || '暂无描述'}
                    </p>
                    {result.match_reasons && result.match_reasons.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {result.match_reasons.map((reason: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs rounded-full"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-600 dark:text-green-400">
                      {(result.relevance_score * 100).toFixed(0)}% 相关
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 搜索结果 */}
      {hasResults && response && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>搜索耗时 {searchTime}ms</span>
            <span>共 {resultCount} 个结果</span>
          </div>
          {response.explanation && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              {response.explanation}
            </div>
          )}
          <div className="space-y-2">
            {response.results.map((result) => (
              <div
                key={result.id}
                className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onEntitySelect?.(result.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">{result.name}</h4>
                      <span className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {result.type}
                      </span>
                    </div>
                    {result.description && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {result.description}
                      </p>
                    )}
                    {result.match_reasons && result.match_reasons.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {result.match_reasons.map((reason, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {(result.relevance_score * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">相关度</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LLMSearchPanel;
