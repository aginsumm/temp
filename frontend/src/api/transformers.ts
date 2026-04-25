export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function keysToSnakeCase(
  obj: Record<string, unknown> | Record<string, unknown>[]
): Record<string, unknown> | Record<string, unknown>[] {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => keysToSnakeCase(item as Record<string, unknown>)) as Record<
      string,
      unknown
    >[];
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = toSnakeCase(key);
    result[newKey] =
      typeof value === 'object' && value !== null
        ? keysToSnakeCase(value as Record<string, unknown>)
        : value;
  }
  return result;
}

export function keysToCamelCase(
  obj: Record<string, unknown> | Record<string, unknown>[]
): Record<string, unknown> | Record<string, unknown>[] {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => keysToCamelCase(item as Record<string, unknown>)) as Record<
      string,
      unknown
    >[];
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = toCamelCase(key);
    result[newKey] =
      typeof value === 'object' && value !== null
        ? keysToCamelCase(value as Record<string, unknown>)
        : value;
  }
  return result;
}

interface SourceData {
  id?: string;
  title?: string;
  content?: string;
  url?: string;
  page?: number;
  relevance?: number;
}

interface EntityData {
  id?: string;
  name?: string;
  type?: string;
  description?: string;
  properties?: Record<string, unknown>;
}

interface SessionData {
  id: string;
  user_id?: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  message_count?: number;
  is_pinned?: boolean;
}

interface MessageData {
  id: string;
  session_id?: string;
  role?: string;
  content?: string;
  created_at?: string;
  sources?: SourceData[];
  entities?: EntityData[];
  keywords?: string[];
  feedback?: string;
  is_favorite?: boolean;
}

interface ChatData {
  message_id?: string;
  content?: string;
  role?: string;
  sources?: SourceData[];
  entities?: EntityData[];
  keywords?: string[];
  created_at?: string;
}

interface FavoriteData {
  id: string;
  user_id?: string;
  message_id?: string;
  message_content?: string;
  session_id?: string;
  created_at?: string;
}

export function transformSessionResponse(data: SessionData) {
  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    messageCount: data.message_count,
    isPinned: data.is_pinned,
  };
}

export function transformMessageResponse(data: MessageData) {
  return {
    id: data.id,
    sessionId: data.session_id,
    role: data.role,
    content: data.content,
    createdAt: data.created_at,
    sources: data.sources?.map((s: SourceData) => ({
      id: s.id,
      title: s.title,
      content: s.content,
      url: s.url,
      page: s.page,
      relevance: s.relevance,
    })),
    entities: data.entities?.map((e: EntityData) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      description: e.description,
      properties: e.properties,
    })),
    keywords: data.keywords,
    feedback: data.feedback,
    isFavorite: data.is_favorite,
  };
}

export function transformChatResponse(data: ChatData) {
  return {
    messageId: data.message_id,
    content: data.content,
    role: data.role,
    sources: data.sources?.map((s: SourceData) => ({
      id: s.id,
      title: s.title,
      content: s.content,
      url: s.url,
      page: s.page,
      relevance: s.relevance,
    })),
    entities: data.entities?.map((e: EntityData) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      description: e.description,
    })),
    keywords: data.keywords,
    createdAt: data.created_at,
  };
}

export function transformFavoriteResponse(data: FavoriteData) {
  return {
    id: data.id,
    userId: data.user_id,
    messageId: data.message_id,
    messageContent: data.message_content,
    sessionId: data.session_id,
    createdAt: data.created_at,
  };
}
