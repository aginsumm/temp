import type { Entity as ChatEntity, EntityType, Source } from '../types/chat';

export interface KnowledgeEntityBase {
  id: string;
  name: string;
  type: EntityType;
  description?: string;
  region?: string;
  period?: string;
  coordinates?: { lat: number; lng: number };
  metadata?: Record<string, unknown>;
  importance: number;
  images?: string[];
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEntityFull extends KnowledgeEntityBase {
  relationships: KnowledgeRelationship[];
  related_entities: KnowledgeEntityBase[];
  sources?: Source[];
  content?: string;
}

export interface KnowledgeRelationship {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  weight: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  categories?: KnowledgeGraphCategory[];
}

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  category: string;
  symbolSize?: number;
  value?: number;
  x?: number;
  y?: number;
  itemStyle?: { color: string };
  [key: string]: unknown;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  relationType?: string;
  weight?: number;
  lineStyle?: { width?: number; curveness?: number; opacity?: number };
  [key: string]: unknown;
}

export interface KnowledgeGraphCategory {
  name: string;
  itemStyle?: { color: string };
}

export interface KnowledgeSearchRequest {
  keyword?: string;
  category?: string;
  region?: string[];
  period?: string[];
  page?: number;
  page_size?: number;
  sort_by?: string;
}

export interface KnowledgeSearchResponse {
  results: KnowledgeEntityBase[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface KnowledgePathRequest {
  source_id: string;
  target_id: string;
  max_depth?: number;
}

export interface KnowledgePathResponse {
  paths: string[][];
  entities: KnowledgeEntityBase[];
}

export interface KnowledgeStatsResponse {
  total_entities: number;
  total_relationships: number;
  entities_by_type: Record<string, number>;
  relationships_by_type: Record<string, number>;
  top_entities: Array<{ id: string; name: string; type: string; importance: number }>;
}

export interface KnowledgeCategory {
  value: string;
  label: string;
  color: string;
}

export interface KnowledgeSearchHistoryItem {
  id: string;
  keyword: string;
  filters: {
    category?: string;
    region?: string[];
    period?: string[];
  };
  result_count: number;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  is_pinned?: boolean;
  is_archived?: boolean;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  sources?: Source[];
  entities?: ChatEntity[];
  keywords?: string[];
  relations?: import('../types/chat').Relation[];
  feedback?: 'helpful' | 'unclear' | null;
  is_favorite?: boolean;
  versions?: ChatMessageVersion[];
  parent_message_id?: string;
  is_edited?: boolean;
  version_group_id?: string;
}

export interface ChatMessageVersion {
  id: string;
  content: string;
  created_at: string;
  is_current: boolean;
}

export interface FavoriteItem {
  id: string;
  user_id: string;
  entity_id: string;
  entity_type: string;
  entity_name: string;
  created_at: string;
}

export interface FeedbackItem {
  id: string;
  user_id: string;
  entity_id: string;
  feedback_type: string;
  content?: string;
  rating?: number;
  created_at: string;
}

export interface PendingOperation {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface SyncStatus {
  lastSync: number | null;
  pendingOperations: number;
  isSyncing: boolean;
  errors: string[];
}

export interface ApiAdapterConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

export type ConnectionMode = 'online' | 'offline';

export interface NetworkStatus {
  mode: ConnectionMode;
  isOnline: boolean;
  lastChecked: number;
}
