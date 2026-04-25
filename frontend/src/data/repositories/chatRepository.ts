import { localDatabase, STORES } from '../localDatabase';
import type { ChatSession, ChatMessage } from '../models';
import type { Session, Message, Entity, Source, Relation, ChatResponse } from '../../types/chat';
import { entityExtractor, type ExtractedEntity } from '../../services/entityExtractor';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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
    relations: message.relations,
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
    relations: db.relations,
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
  '传承',
  '技艺',
  '非遗',
  '传统',
  '文化',
  '工艺',
  '匠心',
  '民俗',
  '手艺',
  '古老',
  '历史',
  '艺术',
  '民间',
  '国粹',
  '经典',
];

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
  const extractedEntities = entityExtractor.extract(message);

  return extractedEntities.map((entity: ExtractedEntity) => {
    const mappedType = mapEntityType(entity.type, entity.text);
    return {
      id: `entity_${entity.type}_${entity.startIndex}_${Date.now()}`,
      name: entity.text,
      type: mappedType,
      description: getEntityDescription(mappedType),
      relevance: entity.confidence,
    };
  });
}

function mapEntityType(extractedType: string, entityText?: string): Entity['type'] {
  const typeMap: Record<string, Entity['type']> = {
    // 人物相关
    person: 'inheritor',
    organization: 'inheritor',
    // 地理位置
    location: 'region',
    // 时间相关
    date: 'period',
    // 技艺/概念相关
    number: 'technique',
    concept: 'technique',
    // 作品/产品
    product: 'work',
  };

  // 基于实体文本内容的智能推断
  if (entityText) {
    const text = entityText.toLowerCase();

    // 检查是否是材料相关
    const materialKeywords = [
      '丝',
      '绸',
      '棉',
      '麻',
      '竹',
      '木',
      '陶',
      '瓷',
      '纸',
      '墨',
      '颜料',
      '染料',
    ];
    if (materialKeywords.some((kw) => text.includes(kw))) {
      return 'material';
    }

    // 检查是否是图案/纹样相关
    const patternKeywords = ['纹', '图案', '花', '龙凤', '云纹', '几何', '图腾'];
    if (patternKeywords.some((kw) => text.includes(kw))) {
      return 'pattern';
    }

    // 检查是否是作品相关
    const workKeywords = ['作品', '画作', '雕塑', '器物', '器具', '服饰', '建筑'];
    if (workKeywords.some((kw) => text.includes(kw))) {
      return 'work';
    }

    // 检查是否是传承人相关（包含特定称谓）
    const inheritorKeywords = ['大师', '传承人', '艺人', '工匠', '先生', '女士'];
    if (inheritorKeywords.some((kw) => text.includes(kw))) {
      return 'inheritor';
    }
  }

  return typeMap[extractedType] || 'technique';
}

function getEntityDescription(entityType: string): string {
  const descriptions: Record<string, string> = {
    inheritor: '非遗传承人或相关人物',
    technique: '传统技艺或工艺',
    work: '非遗相关作品或产品',
    pattern: '传统图案或纹样',
    region: '地理位置或区域',
    period: '历史时期',
    material: '传统材料或原料',
  };
  return descriptions[entityType] || '提取的实体';
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
    onError?: (error: Error) => void,
    onStatusChange?: (status: 'connecting' | 'streaming' | 'complete' | 'error') => void
  ): Promise<() => void> {
    let isAborted = false;
    const controller = new AbortController();
    const STREAM_TIMEOUT = 60000; // 60秒超时
    const MAX_RETRIES = 1; // 网络错误时重试1次
    let retryCount = 0;

    const executeStream = async (): Promise<void> => {
      try {
        const token = localStorage.getItem('token') || '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

        onStatusChange?.('connecting');

        // 创建超时控制器
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
          timeoutController.abort();
        }, STREAM_TIMEOUT);

        const response = await fetch(`${apiBaseUrl}/chat/stream`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            session_id: sessionId,
            content: content,
            message_type: 'text',
          }),
          signal: AbortSignal.any([controller.signal, timeoutController.signal]),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          let errorType = 'UNKNOWN_ERROR';

          if (response.status === 401) {
            errorType = 'AUTH_ERROR';
          } else if (response.status === 429) {
            errorType = 'RATE_LIMIT_ERROR';
          } else if (response.status >= 500) {
            errorType = 'SERVER_ERROR';
          }

          throw new Error(`[${errorType}] HTTP ${response.status}: ${errText}`);
        }

        onStatusChange?.('streaming');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let lastResponse: ChatResponse | null = null;
        let latestEntities: Entity[] = [];
        let latestKeywords: string[] = [];
        let latestRelations: Relation[] = [];
        let fullContent = '';
        let sseBuffer = '';
        let lastActivityTime = Date.now();
        const ACTIVITY_TIMEOUT = 30000; // 30秒无活动超时

        if (reader) {
          while (!isAborted) {
            // 检查活动超时
            if (Date.now() - lastActivityTime > ACTIVITY_TIMEOUT) {
              throw new Error('[STREAM_TIMEOUT] 流式响应超时，30秒无数据');
            }

            try {
              const { done, value } = await Promise.race([
                reader.read(),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('[READ_TIMEOUT] 读取超时')), 10000)
                ),
              ]);

              if (done) break;

              lastActivityTime = Date.now();
              sseBuffer += decoder.decode(value, { stream: true });
              const events = sseBuffer.split('\n\n');
              sseBuffer = events.pop() || '';

              for (const rawEvent of events) {
                const dataLines = rawEvent
                  .split('\n')
                  .map((line) => line.trim())
                  .filter((line) => line.startsWith('data:'))
                  .map((line) => line.replace(/^data:\s?/, ''));

                if (dataLines.length === 0) continue;
                const payload = dataLines.join('\n');
                if (payload === '[DONE]') continue;

                try {
                  const data = JSON.parse(payload);
                  if (data.type === 'content_chunk' || data.type === 'content') {
                    const chunkText = String(data.content || '');
                    fullContent += chunkText;
                    onChunk(chunkText);
                  } else if (data.type === 'entities') {
                    latestEntities = Array.isArray(data.entities) ? data.entities : [];
                  } else if (data.type === 'keywords') {
                    latestKeywords = Array.isArray(data.keywords) ? data.keywords : [];
                  } else if (data.type === 'relations') {
                    latestRelations = Array.isArray(data.relations) ? data.relations : [];
                  } else if (data.type === 'complete') {
                    lastResponse = data.response || data;
                  } else if (data.type === 'error') {
                    throw new Error(`[STREAM_ERROR] ${data.message || '流式响应错误'}`);
                  }
                } catch (parseError) {
                  if (parseError instanceof SyntaxError) {
                    // JSON 解析失败，可能是不完整的事件，等待后续分片
                    continue;
                  }
                  throw parseError;
                }
              }
            } catch (readError: unknown) {
              if (readError instanceof Error && readError.message.includes('READ_TIMEOUT')) {
                console.warn('⚠️ 读取超时，继续等待...');
                continue;
              }
              throw readError;
            }
          }
        }

        if (!lastResponse && fullContent.trim()) {
          const responseId = generateId();
          lastResponse = {
            message_id: responseId,
            content: fullContent,
            entities: latestEntities,
            keywords: latestKeywords,
            relations: latestRelations,
            sources: [],
            created_at: new Date().toISOString(),
            role: 'assistant',
          };
        }

        if (lastResponse && !isAborted) {
          const aiMessage: Message = {
            id: lastResponse.message_id || generateId(),
            session_id: sessionId,
            role: 'assistant',
            content: lastResponse.content || fullContent || '',
            created_at: lastResponse.created_at || new Date().toISOString(),
            sources: lastResponse.sources || [],
            entities: lastResponse.entities || latestEntities || [],
            keywords: lastResponse.keywords || latestKeywords || [],
            relations: lastResponse.relations || latestRelations || [],
          };
          await this.addMessage(aiMessage);
          onStatusChange?.('complete');
          onComplete(aiMessage);
        }
      } catch (error: unknown) {
        if (isAborted) return;

        // 判断错误类型
        let shouldRetry = false;
        let errorMessage = '未知错误';

        const err = error instanceof Error ? error : new Error(String(error));

        if (err.name === 'AbortError') {
          errorMessage = '请求已取消';
        } else if (err.message.includes('STREAM_TIMEOUT') || err.message.includes('READ_TIMEOUT')) {
          errorMessage = '响应超时，请稍后重试';
        } else if (err.message.includes('AUTH_ERROR')) {
          errorMessage = '认证失败，请重新登录';
        } else if (err.message.includes('RATE_LIMIT_ERROR')) {
          errorMessage = '请求过于频繁，请稍后重试';
        } else if (err.message.includes('SERVER_ERROR')) {
          errorMessage = '服务器错误，请稍后重试';
          shouldRetry = retryCount < MAX_RETRIES;
        } else if (
          err.message.includes('NetworkError') ||
          err.message.includes('Failed to fetch')
        ) {
          errorMessage = '网络连接失败，请检查网络';
          shouldRetry = retryCount < MAX_RETRIES;
        } else {
          errorMessage = err.message || '请求失败';
          shouldRetry = retryCount < MAX_RETRIES && !err.message.includes('[STREAM_ERROR]');
        }

        console.error(`🔥 流式请求失败 (重试 ${retryCount}/${MAX_RETRIES}):`, errorMessage);

        // 重试逻辑
        if (shouldRetry) {
          retryCount++;
          const delay = 1000 * retryCount; // 指数退避
          console.log(`⏳ ${delay}ms 后重试...`);
          await new Promise((resolve) => setTimeout(resolve, delay));

          if (!isAborted) {
            await executeStream();
            return;
          }
        }

        // 不再重试，报告错误
        console.error('❌ 流式请求最终失败:', errorMessage);
        if (onError) onError(new Error(errorMessage));
        onStatusChange?.('error');
      }
    };

    executeStream();

    return () => {
      isAborted = true;
      controller.abort();
    };
  }

  async regenerateMessageStream(
    messageId: string,
    onChunk: (chunk: string) => void,
    onComplete: (message: Message) => void,
    onError?: (error: Error) => void,
    onStatusChange?: (status: 'connecting' | 'streaming' | 'complete' | 'error') => void
  ): Promise<() => void> {
    let isAborted = false;
    const controller = new AbortController();
    const STREAM_TIMEOUT = 60000;
    const MAX_RETRIES = 1;
    let retryCount = 0;

    const executeStream = async (): Promise<void> => {
      try {
        const token = localStorage.getItem('token') || '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

        onStatusChange?.('connecting');

        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
          timeoutController.abort();
        }, STREAM_TIMEOUT);

        const response = await fetch(`${apiBaseUrl}/chat/message/${messageId}/regenerate/stream`, {
          method: 'POST',
          headers,
          signal: AbortSignal.any([controller.signal, timeoutController.signal]),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          let errorType = 'UNKNOWN_ERROR';

          if (response.status === 401) {
            errorType = 'AUTH_ERROR';
          } else if (response.status === 429) {
            errorType = 'RATE_LIMIT_ERROR';
          } else if (response.status >= 500) {
            errorType = 'SERVER_ERROR';
          }

          throw new Error(`[${errorType}] HTTP ${response.status}: ${errText}`);
        }

        onStatusChange?.('streaming');

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let latestEntities: Entity[] = [];
        let latestKeywords: string[] = [];
        let latestRelations: Relation[] = [];
        let fullContent = '';
        let sseBuffer = '';
        let lastActivityTime = Date.now();
        const ACTIVITY_TIMEOUT = 30000;

        if (reader) {
          while (!isAborted) {
            if (Date.now() - lastActivityTime > ACTIVITY_TIMEOUT) {
              throw new Error('[STREAM_TIMEOUT] 流式响应超时，30秒无数据');
            }

            try {
              const { done, value } = await Promise.race([
                reader.read(),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('[READ_TIMEOUT] 读取超时')), 10000)
                ),
              ]);

              if (done) break;

              lastActivityTime = Date.now();
              sseBuffer += decoder.decode(value, { stream: true });
              const events = sseBuffer.split('\n\n');
              sseBuffer = events.pop() || '';

              for (const rawEvent of events) {
                const dataLines = rawEvent
                  .split('\n')
                  .map((line) => line.trim())
                  .filter((line) => line.startsWith('data:'))
                  .map((line) => line.replace(/^data:\s?/, ''));

                for (const dataStr of dataLines) {
                  try {
                    const data = JSON.parse(dataStr);

                    if (data.type === 'content_chunk') {
                      fullContent += data.content;
                      onChunk(data.content);
                    } else if (data.type === 'entities') {
                      latestEntities = data.entities || [];
                    } else if (data.type === 'keywords') {
                      latestKeywords = data.keywords || [];
                    } else if (data.type === 'relations') {
                      latestRelations = data.relations || [];
                    } else if (data.type === 'complete') {
                      const regeneratedMessage: Message = {
                        id: messageId,
                        session_id: '',
                        role: 'assistant',
                        content: fullContent,
                        created_at: new Date().toISOString(),
                        entities: latestEntities,
                        keywords: latestKeywords,
                        relations: latestRelations,
                        sources: [],
                      };
                      onComplete(regeneratedMessage);
                      onStatusChange?.('complete');
                      return;
                    } else if (data.type === 'error') {
                      throw new Error(data.message || '重新生成失败');
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse SSE event:', dataStr, parseError);
                  }
                }
              }
            } catch (readError) {
              const error = readError as Error & { message?: string };
              if (error.message?.includes('READ_TIMEOUT')) {
                continue;
              }
              throw readError;
            }
          }
        }

        if (!isAborted && fullContent) {
          const regeneratedMessage: Message = {
            id: messageId,
            session_id: '',
            role: 'assistant',
            content: fullContent,
            created_at: new Date().toISOString(),
            entities: latestEntities,
            keywords: latestKeywords,
            relations: latestRelations,
            sources: [],
          };
          onComplete(regeneratedMessage);
          onStatusChange?.('complete');
        }
      } catch (error) {
        const err = error as Error & { message?: string };
        const errorMessage = err.message || '重新生成失败';

        if (
          (errorMessage.includes('网络') || errorMessage.includes('Network')) &&
          retryCount < MAX_RETRIES
        ) {
          retryCount++;
          console.log(`🔄 网络错误，重试 ${retryCount}/${MAX_RETRIES}...`);
          await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
          await executeStream();
          return;
        }

        console.error('❌ 重新生成最终失败:', errorMessage);
        if (onError) onError(new Error(errorMessage));
        onStatusChange?.('error');
      }
    };

    executeStream();

    return () => {
      isAborted = true;
      controller.abort();
    };
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
