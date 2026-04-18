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
  entities?: Entity[];
  keywords?: string[];
  relations?: Relation[];
  feedback?: 'helpful' | 'unclear' | null;
  is_favorite?: boolean;
  versions?: MessageVersion[];
  parent_message_id?: string;
  is_edited?: boolean;
  version_group_id?: string;
  isStreaming?: boolean;
  is_regenerating?: boolean;
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

export interface Entity {
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
  // Knowledge 模块扩展字段
  importance?: number;
  region?: string;
  period?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  images?: string[];
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  aliases?: string[];
  external_ids?: Record<string, string>;
}

export type EntityType =
  | 'inheritor'
  | 'technique'
  | 'work'
  | 'pattern'
  | 'region'
  | 'period'
  | 'material';

export interface FavoriteQuestion {
  id: string;
  user_id: string;
  question: string;
  category: string;
  created_at: string;
}

export interface RecommendedQuestion {
  id: string;
  question: string;
  category?: string;
}

export interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export interface UIState {
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  created_at: string;
}

export interface VoiceInputState {
  isListening: boolean;
  transcript: string;
  error: string | null;
}

export interface ChatRequest {
  session_id: string;
  content: string;
  message_type?: 'text' | 'voice';
}

export interface ChatResponse {
  message_id: string;
  content: string;
  role: 'assistant';
  sources?: Source[];
  entities?: Entity[];
  keywords?: string[];
  relations?: Relation[];
  created_at: string;
}

export interface SessionListResponse {
  sessions: Session[];
  total: number;
  page: number;
  page_size: number;
}

export interface MessageListResponse {
  messages: Message[];
  total: number;
  has_more: boolean;
}

export interface Relation {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  confidence?: number;
  evidence?: string;
  bidirectional?: boolean;
}

export type RelationType =
  | 'inherits'
  | 'origin'
  | 'creates'
  | 'flourished_in'
  | 'located_in'
  | 'uses_material'
  | 'has_pattern'
  | 'related_to'
  | 'influenced_by'
  | 'contains';

export interface GraphNode {
  id: string;
  name: string;
  category: EntityType;
  symbolSize?: number;
  value?: number;
  x?: number;
  y?: number;
  itemStyle?: {
    color?: string;
    borderColor?: string;
    borderWidth?: number;
  };
  description?: string;
  metadata?: Entity['metadata'];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: RelationType;
  value?: number;
  lineStyle?: {
    color?: string;
    width?: number;
    curveness?: number;
    opacity?: number;
  };
}

export interface GraphCategory {
  name: EntityType;
  baseColor: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  categories?: GraphCategory[];
}

export interface GraphSnapshot {
  id: string;
  session_id: string;
  message_id: string;
  graph_data: GraphData;
  keywords: string[];
  entities: Entity[];
  relations: Relation[];
  created_at: string;
  updated_at?: string;
  title?: string;
  description?: string;
  is_shared?: boolean;
  share_url?: string;
  user_id?: string;
  node_count?: number;
  edge_count?: number;
}

export interface CreateSnapshotRequest {
  session_id: string;
  message_id: string;
  graph_data: GraphData;
  keywords: string[];
  entities: Entity[];
  relations: Relation[];
  title?: string;
  description?: string;
}

export interface SnapshotListResponse {
  snapshots: GraphSnapshot[];
  total: number;
  page: number;
  page_size: number;
}

export interface SSEEvent {
  type: 'content_chunk' | 'entities' | 'keywords' | 'relations' | 'complete' | 'error';
  data: unknown;
  timestamp?: string;
}

export interface ContentChunkEvent {
  type: 'content_chunk';
  content: string;
  accumulated_length: number;
}

export interface EntitiesEvent {
  type: 'entities';
  entities: Entity[];
  is_incremental: boolean;
}

export interface KeywordsEvent {
  type: 'keywords';
  keywords: string[];
}

export interface RelationsEvent {
  type: 'relations';
  relations: Relation[];
}

export interface CompleteEvent {
  type: 'complete';
  message_id: string;
  content: string;
  sources?: Source[];
  entities?: Entity[];
  keywords?: string[];
  relations?: Relation[];
}

export interface ErrorEvent {
  type: 'error';
  code: string;
  message: string;
  recoverable: boolean;
}

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  inheritor: '传承人',
  technique: '技艺',
  work: '作品',
  pattern: '纹样',
  region: '地区',
  period: '时期',
  material: '材料',
};

export const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  inherits: '传承',
  origin: '发源地',
  creates: '用于制作',
  flourished_in: '兴盛于',
  located_in: '位于',
  uses_material: '使用材料',
  has_pattern: '包含纹样',
  related_to: '相关',
  influenced_by: '受影响于',
  contains: '包含',
};

export const ENTITY_COLORS: Record<EntityType, string> = {
  inheritor: '#FF6B6B',
  technique: '#4ECDC4',
  work: '#45B7D1',
  pattern: '#96CEB4',
  region: '#FFEAA7',
  period: '#DDA0DD',
  material: '#98D8C8',
};
