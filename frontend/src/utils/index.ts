/**
 * 统一工具函数导出
 * 方便其他模块导入使用
 */

// 图谱数据转换
export {
  entitiesToGraphData,
  filterGraphData,
  mergeGraphData,
  calculateGraphStats,
  getConnectedNodes,
  getTopKNodes,
  getEntityColor,
  getRelationColor,
  calculateNodeSize,
} from './graphConverter';

// 重试机制
export {
  withRetry,
  withRetryAndTimeout,
  createRetryableOperation,
  isNetworkError,
  delay,
} from './retry';

// 快照处理
export {
  loadSnapshot,
  restoreSnapshotFromSession,
  clearSnapshotFromSession,
  saveSnapshotToSession,
  extractFiltersFromSnapshot,
} from './snapshotHandler';

// 服务导出
export { unifiedFavoriteService } from '../services/unifiedFavoriteService';
export { unifiedSearchHistoryService } from '../services/unifiedSearchHistoryService';
export { llmSearchService } from '../services/llmSearchService';

// Hook 导出
export { useLLMSearch } from '../hooks/useLLMSearch';

// 类型导出
export type {
  KnowledgeEntity,
  KnowledgeEntityCreate,
  KnowledgeEntityUpdate,
  KnowledgeEntityFull,
  KnowledgeRelationship,
  KnowledgeRelationshipCreate,
  KnowledgeRelationshipUpdate,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  KnowledgeGraphCategory,
  KnowledgeGraphData,
  KnowledgeSearchRequest,
  KnowledgeSearchResponse,
  KnowledgeSearchHistoryItem,
  KnowledgePathRequest,
  KnowledgePathResponse,
  KnowledgeStatsResponse,
  KnowledgeFavoriteItem,
  KnowledgeFeedbackItem,
  KnowledgeGraphFilter,
  KnowledgeGraphLayoutOptions,
  convertChatEntityToKnowledgeEntity,
  convertKnowledgeEntityToChatEntity,
  convertChatRelationToKnowledgeRelation,
  convertKnowledgeRelationToChatRelation,
} from '../types/knowledge';

// 服务类型导出
export type {
  UnifiedFavoriteItem,
  UnifiedFavoriteListResponse,
} from '../services/unifiedFavoriteService';

export type {
  UnifiedSearchHistoryItem,
  UnifiedSearchHistoryResponse,
} from '../services/unifiedSearchHistoryService';

export type {
  SearchOptions,
  SearchResult,
  SearchResponse as LLMSearchResponse,
} from '../services/llmSearchService';
