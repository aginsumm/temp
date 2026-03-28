export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  sources?: Source[];
  entities?: Entity[];
  keywords?: string[];
  feedback?: "helpful" | "unclear" | null;
  isFavorite?: boolean;
}

export interface Session {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  isPinned?: boolean;
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
  properties?: Record<string, unknown>;
}

export type EntityType = 
  | "inheritor"
  | "technique"
  | "work"
  | "pattern"
  | "region"
  | "period"
  | "material";

export interface FavoriteQuestion {
  id: string;
  userId: string;
  question: string;
  category: string;
  createdAt: Date;
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
  theme: "light" | "dark";
  fontSize: "small" | "medium" | "large";
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  createdAt: Date;
}

export interface VoiceInputState {
  isListening: boolean;
  transcript: string;
  error: string | null;
}

export interface ChatRequest {
  sessionId: string;
  content: string;
  messageType?: "text" | "voice";
}

export interface ChatResponse {
  messageId: string;
  content: string;
  role: "assistant";
  sources?: Source[];
  entities?: Entity[];
  keywords?: string[];
  createdAt: string;
}

export interface SessionListResponse {
  sessions: Session[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MessageListResponse {
  messages: Message[];
  total: number;
  hasMore: boolean;
}
