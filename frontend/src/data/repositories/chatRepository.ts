import { localDatabase, STORES } from '../localDatabase';
import type { ChatSession, ChatMessage } from '../models';
import type { Session, Message, Entity, Source } from '../../types/chat';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sessionToDb(session: Session): ChatSession {
  return {
    id: session.id,
    user_id: session.user_id,
    title: session.title,
    created_at: session.created_at,
    updated_at: session.updated_at,
    message_count: session.message_count,
    is_pinned: session.is_pinned,
    is_archived: session.is_archived,
    tags: session.tags,
  };
}

function dbToSession(db: ChatSession): Session {
  return {
    id: db.id,
    user_id: db.user_id,
    title: db.title,
    created_at: db.created_at,
    updated_at: db.updated_at,
    message_count: db.message_count,
    is_pinned: db.is_pinned,
    is_archived: db.is_archived,
    tags: db.tags,
  };
}

function messageToDb(message: Message): ChatMessage {
  return {
    id: message.id,
    session_id: message.session_id,
    role: message.role,
    content: message.content,
    created_at: message.created_at,
    sources: message.sources,
    entities: message.entities,
    keywords: message.keywords,
    feedback: message.feedback,
    is_favorite: message.is_favorite,
    versions: message.versions,
    parent_message_id: message.parent_message_id,
    is_edited: message.is_edited,
    version_group_id: message.version_group_id,
  };
}

function dbToMessage(db: ChatMessage): Message {
  return {
    id: db.id,
    session_id: db.session_id,
    role: db.role,
    content: db.content,
    created_at: db.created_at,
    sources: db.sources,
    entities: db.entities,
    keywords: db.keywords,
    feedback: db.feedback,
    is_favorite: db.is_favorite,
    versions: db.versions,
    parent_message_id: db.parent_message_id,
    is_edited: db.is_edited,
    version_group_id: db.version_group_id,
  };
}

const HERITAGE_RESPONSES = [
  '根据非遗知识库的资料，您询问的内容涉及传统技艺的核心传承。这项技艺已有数百年历史，是中华传统文化的重要组成部分。',
  '关于您的问题，从非遗保护的角度来看，这体现了先民智慧的结晶。传承人在技艺传承中扮演着关键角色，需要长期的学习和实践。',
  '这是一个很好的问题！非遗文化强调"活态传承"，每一代传承人都会在保持核心技艺的同时，融入时代特色。',
  '根据史料记载，这项非遗技艺起源于古代，经过代代相传，形成了独特的艺术风格和工艺特点。',
  '您提到的内容属于非物质文化遗产的重要范畴。保护和传承这些技艺，是我们共同的责任。',
];

const HERITAGE_KEYWORDS = [
  '传承', '技艺', '非遗', '传统', '文化',
  '工艺', '匠心', '民俗', '手艺', '古老',
  '历史', '艺术', '民间', '国粹', '经典',
];

const ENTITY_TEMPLATES: Record<string, { type: Entity['type']; description: string }> = {
  '传承人': { type: 'inheritor', description: '非物质文化遗产传承人' },
  '技艺': { type: 'technique', description: '传统技艺技法' },
  '工艺': { type: 'technique', description: '传统制作工艺' },
  '历史': { type: 'period', description: '历史时期背景' },
  '保护': { type: 'technique', description: '非遗保护措施' },
};

const RECOMMENDED_QUESTIONS = [
  { id: 'q1', question: '什么是非物质文化遗产？' },
  { id: 'q2', question: '如何成为非遗传承人？' },
  { id: 'q3', question: '非遗保护有哪些重要意义？' },
  { id: 'q4', question: '传统技艺如何与现代生活结合？' },
  { id: 'q5', question: '中国有哪些世界级非遗项目？' },
  { id: 'q6', question: '非遗传承面临哪些挑战？' },
];

function generateHeritageResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('传承人') || lowerMessage.includes('传人')) {
    return '传承人是非遗保护的核心。他们不仅掌握着精湛的技艺，更承载着文化的记忆。目前我国已建立了完善的传承人认定和保护机制，确保这些珍贵技艺得以延续。';
  }

  if (lowerMessage.includes('历史') || lowerMessage.includes('起源')) {
    return '这项非遗技艺历史悠久，可追溯至数百年前。它凝聚了先民的智慧，在历史长河中不断发展演变，形成了独特的艺术风格。';
  }

  if (lowerMessage.includes('工艺') || lowerMessage.includes('制作')) {
    return '该技艺的制作工艺十分讲究，需要经过多道工序，每一步都需要精心操作。传统工艺强调"慢工出细活"，体现了匠人精神。';
  }

  if (lowerMessage.includes('保护') || lowerMessage.includes('传承')) {
    return '非遗保护工作需要全社会的参与。目前采取了多种保护措施，包括建立传承基地、开展培训课程、数字化记录等，确保技艺得以完整保存和传承。';
  }

  const randomIndex = Math.floor(Math.random() * HERITAGE_RESPONSES.length);
  return HERITAGE_RESPONSES[randomIndex];
}

function extractKeywords(message: string): string[] {
  const keywords: string[] = [];
  HERITAGE_KEYWORDS.forEach((keyword) => {
    if (message.includes(keyword)) {
      keywords.push(keyword);
    }
  });

  if (keywords.length === 0) {
    keywords.push('非遗文化');
  }

  return keywords.slice(0, 5);
}

function extractEntities(message: string): Entity[] {
  const entities: Entity[] = [];
  let entityId = 0;

  Object.entries(ENTITY_TEMPLATES).forEach(([keyword, template]) => {
    if (message.includes(keyword)) {
      entities.push({
        id: `entity_${++entityId}_${Date.now()}`,
        name: keyword,
        type: template.type,
        description: template.description,
        relevance: 0.85,
      });
    }
  });

  return entities.slice(0, 5);
}

function generateSources(message: string): Source[] {
  const sources: Source[] = [];
  
  if (message.includes('传承') || message.includes('技艺')) {
    sources.push({
      id: 'source_1',
      title: '《中国非物质文化遗产保护名录》',
      content: '详细记录了国家级非遗项目的传承谱系、技艺特点和保护措施...',
      page: 128,
      relevance: 0.95,
    });
  }

  if (message.includes('历史') || message.includes('起源')) {
    sources.push({
      id: 'source_2',
      title: '《地方志·传统技艺卷》',
      content: '记载了传统技艺的历史渊源、发展脉络和地域特色...',
      page: 56,
      relevance: 0.88,
    });
  }

  if (sources.length === 0) {
    sources.push({
      id: 'source_default',
      title: '《非遗知识库》',
      content: '综合性的非遗知识数据库，涵盖各类传统技艺和文化...',
      relevance: 0.75,
    });
  }

  return sources;
}

function cleanTitleContent(content: string): string {
  return content
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

class ChatRepository {
  async createSession(
    userIdOrSession: string | Session,
    title: string = '新对话'
  ): Promise<Session> {
    let session: ChatSession;

    if (typeof userIdOrSession === 'string') {
      const now = new Date().toISOString();
      session = {
        id: generateId(),
        user_id: userIdOrSession,
        title,
        created_at: now,
        updated_at: now,
        message_count: 0,
        is_pinned: false,
        is_archived: false,
      };
    } else {
      session = sessionToDb(userIdOrSession);
    }

    await localDatabase.put(STORES.SESSIONS, session);
    return dbToSession(session);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const session = await localDatabase.get<ChatSession>(STORES.SESSIONS, sessionId);
    return session ? dbToSession(session) : null;
  }

  async getAllSessions(): Promise<Session[]> {
    const sessions = await localDatabase.getAll<ChatSession>(STORES.SESSIONS);
    return sessions.map(dbToSession).sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }

  async getSessionsByUser(userId: string): Promise<Session[]> {
    const sessions = await localDatabase.getByIndex<ChatSession>(STORES.SESSIONS, 'userId', userId);
    return sessions.map(dbToSession).sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session | null> {
    const existing = await localDatabase.get<ChatSession>(STORES.SESSIONS, sessionId);
    if (!existing) return null;

    const updated: ChatSession = {
      ...existing,
      ...updates,
      id: sessionId,
      updated_at: new Date().toISOString(),
    };

    await localDatabase.put(STORES.SESSIONS, updated);
    return dbToSession(updated);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const messages = await localDatabase.getByIndex<ChatMessage>(
      STORES.MESSAGES,
      'sessionId',
      sessionId
    );

    for (const message of messages) {
      await localDatabase.delete(STORES.MESSAGES, message.id);
    }

    await localDatabase.delete(STORES.SESSIONS, sessionId);
  }

  async deleteSessions(sessionIds: string[]): Promise<void> {
    for (const sessionId of sessionIds) {
      await this.deleteSession(sessionId);
    }
  }

  async getSessionCount(): Promise<number> {
    return localDatabase.count(STORES.SESSIONS);
  }

  async addMessage(message: Message | Omit<Message, 'id' | 'created_at'>): Promise<Message> {
    const hasId = 'id' in message && message.id !== undefined;
    
    const newMessage: ChatMessage = {
      ...message,
      id: hasId ? message.id : generateId(),
      created_at: hasId && message.created_at ? message.created_at : new Date().toISOString(),
    } as ChatMessage;

    await localDatabase.put(STORES.MESSAGES, newMessage);

    await this.updateSessionMessageCount(message.session_id);

    return dbToMessage(newMessage);
  }

  async saveMessage(message: Message | Omit<Message, 'id' | 'created_at'>): Promise<Message> {
    return this.addMessage(message);
  }

  async getMessage(messageId: string): Promise<Message | null> {
    const message = await localDatabase.get<ChatMessage>(STORES.MESSAGES, messageId);
    return message ? dbToMessage(message) : null;
  }

  async getMessagesBySession(sessionId: string): Promise<Message[]> {
    const messages = await localDatabase.getByIndex<ChatMessage>(
      STORES.MESSAGES,
      'sessionId',
      sessionId
    );
    return messages
      .map(dbToMessage)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  async getAllMessages(): Promise<Message[]> {
    const messages = await localDatabase.getAll<ChatMessage>(STORES.MESSAGES);
    return messages.map(dbToMessage);
  }

  async updateMessage(messageId: string, updates: Partial<Message>): Promise<Message | null> {
    const existing = await localDatabase.get<ChatMessage>(STORES.MESSAGES, messageId);
    if (!existing) return null;

    const updated: ChatMessage = {
      ...existing,
      ...updates,
      id: messageId,
    };

    await localDatabase.put(STORES.MESSAGES, updated);
    return dbToMessage(updated);
  }

  async deleteMessage(messageId: string): Promise<void> {
    const message = await localDatabase.get<ChatMessage>(STORES.MESSAGES, messageId);
    if (message) {
      await localDatabase.delete(STORES.MESSAGES, messageId);
      await this.updateSessionMessageCount(message.session_id);
    }
  }

  async getMessageCount(): Promise<number> {
    return localDatabase.count(STORES.MESSAGES);
  }

  async getMessageCountBySession(sessionId: string): Promise<number> {
    return localDatabase.countByIndex(STORES.MESSAGES, 'sessionId', sessionId);
  }

  private async updateSessionMessageCount(sessionId: string): Promise<void> {
    const count = await this.getMessageCountBySession(sessionId);
    await this.updateSession(sessionId, { message_count: count });
  }

  async getFavoriteMessages(): Promise<Message[]> {
    const allMessages = await this.getAllMessages();
    const favoriteMessages = allMessages.filter((m) => m.is_favorite === true);
    return favoriteMessages.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async searchSessions(query: string): Promise<Session[]> {
    const allSessions = await this.getAllSessions();
    const lowerQuery = query.toLowerCase();
    return allSessions.filter((session) => session.title.toLowerCase().includes(lowerQuery));
  }

  async searchMessages(query: string): Promise<Message[]> {
    const allMessages = await this.getAllMessages();
    const lowerQuery = query.toLowerCase();
    return allMessages.filter((message) => message.content.toLowerCase().includes(lowerQuery));
  }

  async clearAllSessions(): Promise<void> {
    await localDatabase.clear(STORES.SESSIONS);
    await localDatabase.clear(STORES.MESSAGES);
  }

  async clearAllMessages(): Promise<void> {
    await localDatabase.clear(STORES.MESSAGES);
  }

  async importSession(session: Session, messages: Message[]): Promise<void> {
    await localDatabase.put(STORES.SESSIONS, sessionToDb(session));
    for (const message of messages) {
      await localDatabase.put(STORES.MESSAGES, messageToDb(message));
    }
  }

  async exportSession(
    sessionId: string
  ): Promise<{ session: Session | null; messages: Message[] }> {
    const session = await this.getSession(sessionId);
    const messages = await this.getMessagesBySession(sessionId);
    return { session, messages };
  }

  async addTagToSession(sessionId: string, tag: string): Promise<Session | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const currentTags = session.tags || [];
    if (!currentTags.includes(tag)) {
      const updatedTags = [...currentTags, tag];
      return this.updateSession(sessionId, { tags: updatedTags });
    }
    return session;
  }

  async removeTagFromSession(sessionId: string, tag: string): Promise<Session | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const currentTags = session.tags || [];
    const updatedTags = currentTags.filter((t) => t !== tag);
    return this.updateSession(sessionId, { tags: updatedTags });
  }

  async sendMessage(sessionId: string, content: string): Promise<Message> {
    await this.addMessage({
      session_id: sessionId,
      role: 'user',
      content,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    const aiContent = generateHeritageResponse(content);
    const keywords = extractKeywords(content);
    const entities = extractEntities(content);
    const sources = generateSources(content);

    const aiMessage = await this.addMessage({
      session_id: sessionId,
      role: 'assistant',
      content: aiContent,
      keywords,
      entities,
      sources,
    });

    return aiMessage;
  }

 async sendMessageStream(
    sessionId: string,
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: (message: Message) => void,
    onError?: (error: Error) => void
  ): Promise<() => void> {
    const userMessage: Message = {
      id: generateId(),
      session_id: sessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
      keywords: [],
      entities: [],
      sources: [],
    };
    await this.addMessage(userMessage);
    let isAborted = false;

    (async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // 🌟 强行请求真实的流式接口
        const response = await fetch(`http://localhost:8000/api/v1/chat/stream`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            session_id: sessionId,
            content: content,
            message_type: 'text'
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, body: ${errText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let lastResponse: any = null;

        if (reader) {
          while (!isAborted) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine && trimmedLine.startsWith('data: ')) {
                try {
                  const jsonStr = trimmedLine.substring(6);
                  if (jsonStr === '[DONE]') continue; 
                  
                  const data = JSON.parse(jsonStr);
                  if (data.type === 'content_chunk' || data.type === 'content') {
                    onChunk(data.content);
                  } else if (data.type === 'complete') {
                    lastResponse = data.response || data;
                  }
                } catch (e) {
                  // 忽略不完整的 JSON 块解析错误
                }
              }
            }
          }
        }

        if (lastResponse && !isAborted) {
          const aiMessage: Message = {
            id: lastResponse.message_id || lastResponse.id || generateId(),
            session_id: sessionId,
            role: 'assistant',
            content: lastResponse.content || '',
            created_at: lastResponse.created_at || new Date().toISOString(),
            sources: lastResponse.sources || [],
            entities: lastResponse.entities || [],
            keywords: lastResponse.keywords || []
          };
          await this.addMessage(aiMessage);
          onComplete(aiMessage);
        }
      } catch (error) {
        console.error('🔥 真实流式请求彻底报错:', error);
        if (onError && !isAborted) onError(error as Error);
      }
    })();

    return () => { isAborted = true; };
  }
  async submitFeedback(messageId: string, feedback: 'helpful' | 'unclear'): Promise<void> {
    await this.updateMessage(messageId, { feedback });
  }

  async toggleFavorite(messageId: string, currentStatus?: boolean): Promise<boolean> {
    const newStatus = currentStatus === undefined ? true : !currentStatus;
    await this.updateMessage(messageId, { is_favorite: newStatus });
    return newStatus;
  }

  getRecommendedQuestions(): { id: string; question: string }[] {
    return RECOMMENDED_QUESTIONS;
  }

  generateSessionTitle(content: string): string {
    const cleaned = cleanTitleContent(content);
    if (!cleaned || cleaned.length === 0) {
      return '新对话';
    }
    const title = cleaned.slice(0, 20);
    return cleaned.length > 20 ? `${title}...` : title;
  }
}

export const chatRepository = new ChatRepository();
export default chatRepository;
