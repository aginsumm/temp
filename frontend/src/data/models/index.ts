export interface MessageVersion {
  id: string;
  content: string;
  created_at: string;
  is_current: boolean;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  sources?: Source[];
  entities?: KnowledgeEntity[];
  keywords?: string[];
  feedback?: 'helpful' | 'unclear' | null;
  is_favorite?: boolean;
  versions?: MessageVersion[];
  parent_message_id?: string;
  is_edited?: boolean;
  version_group_id?: string;
}

export interface Session {
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

export interface Source {
  id: string;
  title: string;
  content: string;
  url?: string;
  page?: number;
  relevance: number;
}

export type EntityType =
  | 'inheritor'
  | 'technique'
  | 'work'
  | 'pattern'
  | 'region'
  | 'period'
  | 'material';

export interface KnowledgeEntity {
  id: string;
  name: string;
  type: EntityType;
  description?: string;
  url?: string;
  relevance?: number;
  metadata?: {
    period?: string;
    region?: string;
    category?: string;
  };
  properties?: Record<string, unknown>;
}

export interface KnowledgeEntityFull {
  id: string;
  name: string;
  type: EntityType;
  description?: string;
  region?: string;
  period?: string;
  coordinates?: { lat: number; lng: number };
  metadata?: Record<string, unknown>;
  importance: number;
  created_at: string;
  updated_at: string;
}

export interface Relationship {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  weight: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface FavoriteItem {
  id: string;
  user_id: string;
  entity_id: string;
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

export interface SearchHistoryItem {
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

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  nickname?: string;
  created_at: string;
}

export interface GraphNode {
  id: string;
  name: string;
  category: string;
  symbolSize: number;
  value?: number;
  itemStyle?: { color: string };
}

export interface GraphEdge {
  source: string;
  target: string;
  relationType: string;
  lineStyle?: { width: number; curveness: number; opacity: number };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  categories: Array<{ name: string; itemStyle?: { color: string } }>;
}

export interface PendingOperation {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
  maxRetries?: number;
}

export interface PaginatedResult<T> {
  results: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UserSettings {
  id: string;
  user_id: string;
  theme: string;
  language: string;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}
