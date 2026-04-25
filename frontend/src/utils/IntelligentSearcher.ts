/**
 * 智能搜索增强工具
 * 提供模糊搜索、拼音搜索、智能推荐等功能
 */

// pinyin 模块导入（如果未安装，使用备用方案）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pinyin: any;
try {
  pinyin = require('pinyin');
} catch {
  pinyin = null;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  id: string;
  name: string;
  category: string;
  score: number;
  matchType: MatchType;
  highlights?: string[];
}

/**
 * 匹配类型
 */
export type MatchType =
  | 'exact' // 精确匹配
  | 'partial' // 部分匹配
  | 'pinyin' // 拼音匹配
  | 'pinyin_initial' // 拼音首字母匹配
  | 'fuzzy' // 模糊匹配
  | 'typo'; // 错别字匹配

/**
 * 搜索建议
 */
export interface SearchSuggestion {
  text: string;
  type: 'hot' | 'history' | 'recommend';
  score?: number;
  icon?: string;
}

/**
 * 搜索配置
 */
export interface SearchConfig {
  // 是否启用拼音搜索
  enablePinyin: boolean;
  // 是否启用模糊搜索
  enableFuzzy: boolean;
  // 是否启用错别字纠正
  enableTypoCorrection: boolean;
  // 是否启用智能推荐
  enableRecommendation: boolean;
  // 最大返回结果数
  maxResults: number;
  // 最小匹配分数
  minScore: number;
  // 热门搜索列表
  hotSearches: string[];
}

const DEFAULT_CONFIG: SearchConfig = {
  enablePinyin: true,
  enableFuzzy: true,
  enableTypoCorrection: true,
  enableRecommendation: true,
  maxResults: 20,
  minScore: 0.3,
  hotSearches: [],
};

/**
 * 常见错别字映射
 */
const TYPO_MAP: Record<string, string[]> = {
  的: ['地', '得'],
  在: ['再'],
  做: ['作'],
  到: ['道'],
  和: ['合', '与'],
  是: ['事'],
  有: ['又'],
  这: ['着'],
  那: ['哪'],
  吗: ['嘛'],
  呢: ['呐'],
  吧: ['罢'],
};

/**
 * 智能搜索器
 */
export class IntelligentSearcher {
  private config: SearchConfig;
  private index: Map<string, SearchableItem> = new Map();
  private pinyinCache: Map<string, string> = new Map();
  private initialCache: Map<string, string> = new Map();

  constructor(config: Partial<SearchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 索引数据
   */
  public indexItems(items: SearchableItem[]): void {
    items.forEach((item) => {
      this.index.set(item.id, item);

      // 预计算拼音
      if (this.config.enablePinyin) {
        const pinyinText = this.getPinyin(item.name);
        const initialText = this.getPinyinInitials(item.name);
        this.pinyinCache.set(item.id, pinyinText);
        this.initialCache.set(item.id, initialText);
      }
    });
  }

  /**
   * 搜索
   */
  public search(query: string): SearchResult[] {
    if (!query.trim()) {
      return [];
    }

    // 记录搜索历史
    this.addToHistory(query);

    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase().trim();

    // 1. 精确匹配
    const exactMatch = this.findExactMatch(queryLower);
    if (exactMatch) {
      results.push(exactMatch);
    }

    // 2. 拼音匹配
    if (this.config.enablePinyin) {
      const pinyinResults = this.findPinyinMatches(queryLower);
      results.push(...pinyinResults);
    }

    // 3. 部分匹配
    const partialResults = this.findPartialMatches(queryLower);
    results.push(...partialResults);

    // 4. 模糊搜索
    if (this.config.enableFuzzy && results.length < this.config.maxResults) {
      const fuzzyResults = this.findFuzzyMatches(queryLower);
      results.push(...fuzzyResults);
    }

    // 5. 错别字纠正
    if (this.config.enableTypoCorrection && results.length < this.config.maxResults) {
      const typoResults = this.findTypoCorrections(queryLower);
      results.push(...typoResults);
    }

    // 去重并排序
    const uniqueResults = this.deduplicateResults(results);
    const sortedResults = uniqueResults
      .filter((r) => r.score >= this.config.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxResults);

    return sortedResults;
  }

  /**
   * 获取搜索建议
   */
  public getSuggestions(query: string, searchHistory?: string[]): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    // 1. 热门搜索
    if (this.config.hotSearches.length > 0) {
      suggestions.push(
        ...this.config.hotSearches.slice(0, 5).map((text) => ({
          text,
          type: 'hot' as const,
          icon: '🔥',
        }))
      );
    }

    // 2. 搜索历史
    if (searchHistory && searchHistory.length > 0) {
      suggestions.push(
        ...searchHistory.slice(0, 5).map((text) => ({
          text,
          type: 'history' as const,
          icon: '🕐',
        }))
      );
    }

    // 3. 智能推荐（基于输入）
    if (query.trim() && this.config.enableRecommendation) {
      const results = this.search(query);
      suggestions.push(
        ...results.slice(0, 5).map((r) => ({
          text: r.name,
          type: 'recommend' as const,
          score: r.score,
          icon: '🔍',
        }))
      );
    }

    return suggestions.slice(0, 10);
  }

  /**
   * 查找精确匹配
   */
  private findExactMatch(query: string): SearchResult | null {
    for (const [id, item] of this.index.entries()) {
      if (item.name.toLowerCase() === query) {
        return {
          id,
          name: item.name,
          category: item.category,
          score: 1.0,
          matchType: 'exact',
        };
      }
    }
    return null;
  }

  /**
   * 查找拼音匹配
   */
  private findPinyinMatches(query: string): SearchResult[] {
    const results: SearchResult[] = [];

    for (const [id, item] of this.index.entries()) {
      const pinyinText = this.pinyinCache.get(id) || '';
      const initialText = this.initialCache.get(id) || '';

      // 全拼音匹配
      if (pinyinText.includes(query)) {
        results.push({
          id,
          name: item.name,
          category: item.category,
          score: 0.9,
          matchType: 'pinyin',
        });
      }
      // 拼音首字母匹配
      else if (initialText.includes(query)) {
        results.push({
          id,
          name: item.name,
          category: item.category,
          score: 0.8,
          matchType: 'pinyin_initial',
        });
      }
    }

    return results;
  }

  /**
   * 查找部分匹配
   */
  private findPartialMatches(query: string): SearchResult[] {
    const results: SearchResult[] = [];

    for (const [id, item] of this.index.entries()) {
      const nameLower = item.name.toLowerCase();

      // 包含匹配
      if (nameLower.includes(query)) {
        const score = 0.5 + (query.length / nameLower.length) * 0.3;
        results.push({
          id,
          name: item.name,
          category: item.category,
          score,
          matchType: 'partial',
          highlights: this.extractHighlights(item.name, query),
        });
      }
      // 前缀匹配
      else if (nameLower.startsWith(query)) {
        results.push({
          id,
          name: item.name,
          category: item.category,
          score: 0.7,
          matchType: 'partial',
          highlights: [item.name.substring(0, query.length)],
        });
      }
    }

    return results;
  }

  /**
   * 查找模糊匹配
   */
  private findFuzzyMatches(query: string): SearchResult[] {
    const results: SearchResult[] = [];

    for (const [id, item] of this.index.entries()) {
      const nameLower = item.name.toLowerCase();
      const distance = this.levenshteinDistance(query, nameLower);
      const maxLen = Math.max(query.length, nameLower.length);
      const similarity = 1 - distance / maxLen;

      if (similarity >= 0.6) {
        results.push({
          id,
          name: item.name,
          category: item.category,
          score: similarity * 0.7,
          matchType: 'fuzzy',
        });
      }
    }

    return results;
  }

  /**
   * 查找错别字纠正
   */
  private findTypoCorrections(query: string): SearchResult[] {
    const results: SearchResult[] = [];

    // 生成可能的正确词
    const corrections = this.generateCorrections(query);

    for (const correction of corrections) {
      const exactMatch = this.findExactMatch(correction);
      if (exactMatch) {
        results.push({
          ...exactMatch,
          score: 0.85,
          matchType: 'typo',
        });
      }
    }

    return results;
  }

  /**
   * 生成错别字纠正建议
   */
  private generateCorrections(query: string): string[] {
    const corrections: string[] = [];

    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      const typos = TYPO_MAP[char];

      if (typos) {
        for (const typo of typos) {
          const corrected = query.substring(0, i) + typo + query.substring(i + 1);
          corrections.push(corrected);
        }
      }
    }

    return corrections;
  }

  /**
   * 去重结果
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter((r) => {
      if (seen.has(r.id)) {
        return false;
      }
      seen.add(r.id);
      return true;
    });
  }

  /**
   * 提取高亮部分
   */
  private extractHighlights(text: string, query: string): string[] {
    const highlights: string[] = [];
    const index = text.toLowerCase().indexOf(query.toLowerCase());

    if (index !== -1) {
      highlights.push(text.substring(index, index + query.length));
    }

    return highlights;
  }

  /**
   * 获取拼音
   */
  private getPinyin(text: string): string {
    if (!pinyin) {
      return text;
    }
    try {
      const result = pinyin(text, {
        style: pinyin.STYLE_NORMAL,
        heteronym: false,
      });
      return result.map((p: string[]) => p[0]).join('');
    } catch {
      return text;
    }
  }

  /**
   * 获取拼音首字母
   */
  private getPinyinInitials(text: string): string {
    if (!pinyin) {
      return text.charAt(0).toUpperCase();
    }
    try {
      const result = pinyin(text, {
        style: pinyin.STYLE_FIRST_LETTER,
        heteronym: false,
      });
      return result.map((p: string[]) => p[0]).join('');
    } catch {
      return text.charAt(0).toUpperCase();
    }
  }

  /**
   * 计算编辑距离
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
    }

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1, // 删除
            dp[i][j - 1] + 1, // 插入
            dp[i - 1][j - 1] + 1 // 替换
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<SearchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 设置热门搜索
   */
  public setHotSearches(hotSearches: string[]): void {
    this.config.hotSearches = hotSearches;
  }

  /**
   * 清空索引
   */
  public clearIndex(): void {
    this.index.clear();
    this.pinyinCache.clear();
    this.initialCache.clear();
  }

  // ==================== 搜索历史功能 ====================

  private readonly HISTORY_KEY = 'search_history';
  private readonly MAX_HISTORY = 10;

  /**
   * 添加搜索历史
   */
  public addToHistory(query: string): void {
    if (!query.trim()) return;

    const history = this.getHistory();
    const normalizedQuery = query.trim().toLowerCase();

    // 移除已存在的相同记录（如果有的话）
    const filteredHistory = history.filter((h) => h.toLowerCase() !== normalizedQuery);

    // 添加到开头
    filteredHistory.unshift(query.trim());

    // 限制历史记录数量
    if (filteredHistory.length > this.MAX_HISTORY) {
      filteredHistory.pop();
    }

    // 保存到 localStorage
    try {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(filteredHistory));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }

  /**
   * 获取搜索历史
   */
  public getHistory(): string[] {
    try {
      const historyStr = localStorage.getItem(this.HISTORY_KEY);
      if (!historyStr) {
        return [];
      }
      return JSON.parse(historyStr);
    } catch (error) {
      console.warn('Failed to load search history:', error);
      return [];
    }
  }

  /**
   * 删除单条历史记录
   */
  public removeHistoryItem(query: string): void {
    const history = this.getHistory();
    const normalizedQuery = query.trim().toLowerCase();
    const filteredHistory = history.filter((h) => h.toLowerCase() !== normalizedQuery);

    try {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(filteredHistory));
    } catch (error) {
      console.warn('Failed to remove history item:', error);
    }
  }

  /**
   * 清空所有历史记录
   */
  public clearHistory(): void {
    try {
      localStorage.removeItem(this.HISTORY_KEY);
    } catch (error) {
      console.warn('Failed to clear history:', error);
    }
  }

  /**
   * 获取历史搜索建议
   */
  public getHistorySuggestions(): SearchSuggestion[] {
    const history = this.getHistory();
    return history.slice(0, 5).map((text) => ({
      text,
      type: 'history' as const,
      icon: '🕐',
    }));
  }

  /**
   * 获取完整的搜索建议（包含历史）
   */
  public getFullSuggestions(query?: string): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    // 1. 热门搜索
    if (this.config.hotSearches.length > 0) {
      suggestions.push(
        ...this.config.hotSearches.slice(0, 3).map((text) => ({
          text,
          type: 'hot' as const,
          icon: '🔥',
        }))
      );
    }

    // 2. 搜索历史
    const historySuggestions = this.getHistorySuggestions();
    if (historySuggestions.length > 0) {
      suggestions.push(...historySuggestions);
    }

    // 3. 智能推荐（基于查询的部分匹配）
    if (query && query.trim().length > 0) {
      const partialMatches = this.search(query).slice(0, 5);
      suggestions.push(
        ...partialMatches.map((match) => ({
          text: match.name,
          type: 'recommend' as const,
          score: match.score,
          icon: '💡',
        }))
      );
    }

    return suggestions;
  }
}

/**
 * 可搜索项
 */
export interface SearchableItem {
  id: string;
  name: string;
  category: string;
}

export default IntelligentSearcher;
