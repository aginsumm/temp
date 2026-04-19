import { mockChatService } from '../data/mockServices/mockChatService';
import { apiAdapterManager } from '../data/apiAdapter';
import { chatRepository } from '../data/repositories/chatRepository';
import type {
  ChatRequest,
  ChatResponse,
  Session,
  SessionListResponse,
  MessageListResponse,
  Entity,
  EntityType,
  Source,
  Relation,
} from '../types/chat';

function transformSession(data: Record<string, unknown>): Session {
  return {
    id: data.id as string,
    user_id: data.user_id as string,
    title: data.title as string,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
    message_count: (data.message_count as number) || 0,
    is_pinned: (data.is_pinned as boolean) || false,
    is_archived: (data.is_archived as boolean) || false,
    tags: (data.tags as string[]) || [],
  };
}

function transformMessage(data: Record<string, unknown>) {
  const validEntityTypes: EntityType[] = [
    'inheritor',
    'technique',
    'work',
    'pattern',
    'region',
    'period',
    'material',
  ];

  const entities = (data.entities as Array<Record<string, unknown>>)?.map(
    (e: Record<string, unknown>) => {
      const entityType = e.type as EntityType;
      return {
        id: e.id as string,
        name: e.name as string,
        type: validEntityTypes.includes(entityType) ? entityType : ('technique' as EntityType),
        description: e.description as string | undefined,
        url: e.url as string | undefined,
        relevance: e.relevance as number | undefined,
        metadata: e.metadata as Entity['metadata'],
      };
    }
  ) as Entity[];

  return {
    id: data.id as string,
    session_id: data.session_id as string,
    role: data.role as 'user' | 'assistant',
    content: data.content as string,
    created_at: data.created_at as string,
    sources: ((data.sources as unknown[]) || []) as Source[],
    entities,
    keywords: data.keywords as string[],
    feedback: data.feedback as 'helpful' | 'unclear' | null | undefined,
    is_favorite: (data.is_favorite as boolean) || false,
    is_edited: (data.is_edited as boolean) || false,
  };
}

export const chatApi = {
  sendMessage: async (request: ChatRequest): Promise<ChatResponse> => {
    // if (apiAdapterManager.shouldUseLocal()) {
    //   const aiMessage = await mockChatService.sendMessage(request.session_id, request.content);
    //   return {
    //     message_id: aiMessage.id,
    //     content: aiMessage.content,
    //     role: 'assistant',
    //     sources: (aiMessage.sources || []) as Source[],
    //     entities: (aiMessage.entities || []) as Entity[],
    //     keywords: aiMessage.keywords || [],
    //     created_at: aiMessage.created_at,
    //   };
    // }

    try {
      const response = await apiAdapterManager.request<ChatResponse>({
        method: 'POST',
        url: '/api/v1/chat/message',
        data: {
          session_id: request.session_id,
          content: request.content,
          message_type: request.message_type || 'text',
        },
      });
      return response.data;
    } catch (error) {
      console.error('🔥 普通接口请求失败，拒绝使用假数据！', error);
      throw error; // 强行抛出错误，绝对不返回假数据
    }
  },

  sendMessageStream: async (
    request: ChatRequest,
    onChunk: (chunk: string) => void,
    onComplete: (response: ChatResponse) => void,
    onEntities?: (entities: Entity[]) => void,
    onKeywords?: (keywords: string[]) => void,
    onRelations?: (relations: Relation[]) => void
  ): Promise<void> => {
    try {
      const token = localStorage.getItem('token') || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 🚨 终极核心修改：绕过所有代理和拦截器，直接强行请求后端的真实完整地址！
      const baseUrl = 'http://localhost:8000/api/v1'; 
      
      const response = await fetch(`${baseUrl}/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session_id: request.session_id,
          content: request.content,
          message_type: request.message_type || 'text',
        }),
        signal: controller.signal,
      });

      // 如果后端没返回成功状态，直接抛出错误，进入 catch
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let lastResponse: ChatResponse | null = null;
      let lastActivityTime = Date.now();

      if (reader) {
        let done = false;
        while (!done) {
          const readPromise = reader.read();

          const result = await Promise.race([
            readPromise,
            new Promise<{ done: boolean; value?: Uint8Array }>((_, reject) => {
              setTimeout(() => {
                if (Date.now() - lastActivityTime > STREAM_TIMEOUT) {
                  reject(new Error('Stream read timeout'));
                }
              }, STREAM_TIMEOUT);
            }),
          ]);

          const { done: readerDone, value } = result;
          done = readerDone;
          if (done) break;

          lastActivityTime = Date.now();
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'content_chunk' || data.type === 'content') {
                  onChunk(data.content);
                } else if (data.type === 'entities') {
                  // 处理实体数据
                  const entities = data.entities || [];
                  onEntities?.(entities);
                } else if (data.type === 'keywords') {
                  // 处理关键词数据
                  const keywords = data.keywords || [];
                  onKeywords?.(keywords);
                } else if (data.type === 'relations') {
                  // 处理关系数据
                  const relations = data.relations || [];
                  onRelations?.(relations);
                } else if (data.type === 'complete') {
                  lastResponse = {
                    message_id: data.message_id,
                    content: data.content,
                    role: 'assistant',
                    sources: data.sources || [],
                    entities: data.entities || [],
                    keywords: data.keywords || [],
                    relations: data.relations || [],
                    created_at: new Date().toISOString(),
                  };
                } else if (data.type === 'error') {
                  throw new Error(data.message || 'Stream error');
                }
              } catch {
                console.warn('Failed to parse SSE data:', line);
              }
            }
          }
        }
      }

      clearTimeout(timeoutId);
      if (lastResponse) {
        onComplete(lastResponse);
      }

    } catch (error) {
      console.warn('Stream API unavailable, using local mock response');
      await mockChatService.sendMessageStream(
        request.session_id,
        request.content,
        onChunk,
        (aiMessage) => {
          onComplete({
            message_id: aiMessage.id,
            content: aiMessage.content,
            role: 'assistant',
            sources: (aiMessage.sources || []) as Source[],
            entities: (aiMessage.entities || []) as Entity[],
            keywords: aiMessage.keywords || [],
            created_at: aiMessage.created_at,
          });
        }
      );
    }
  },

  getSessions: async (page = 1, pageSize = 20): Promise<SessionListResponse> => {
    if (apiAdapterManager.shouldUseLocal()) {
      const sessions = await mockChatService.getSessions();
      const start = (page - 1) * pageSize;
      const paginated = sessions.slice(start, start + pageSize);
      return {
        sessions: paginated,
        total: sessions.length,
        page,
        page_size: pageSize,
      };
    }

    try {
      const response = await apiAdapterManager.request<SessionListResponse>({
        method: 'GET',
        url: '/api/v1/session',
        params: { page, page_size: pageSize },
      });
      return {
        ...response.data,
        sessions: (response.data.sessions as unknown as Array<Record<string, unknown>>).map(
          transformSession
        ),
      };
    } catch (error) {
      console.warn('API unavailable for sessions, using local data');
      const sessions = await mockChatService.getSessions();
      const start = (page - 1) * pageSize;
      return {
        sessions: sessions.slice(start, start + pageSize),
        total: sessions.length,
        page,
        page_size: pageSize,
      };
    }
  },

  createSession: async (title = '新对话'): Promise<Session> => {
    if (apiAdapterManager.shouldUseLocal()) {
      return mockChatService.createSession(title);
    }

    try {
      const response = await apiAdapterManager.request<Record<string, unknown>>({
        method: 'POST',
        url: '/api/v1/session',
        data: { title },
      });
      return transformSession(response.data);
    } catch (error) {
      console.warn('API unavailable for creating session, using local');
      return mockChatService.createSession(title);
    }
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    if (apiAdapterManager.shouldUseLocal()) {
      return mockChatService.deleteSession(sessionId);
    }

    try {
      await apiAdapterManager.request({
        method: 'DELETE',
        url: `/api/v1/session/${sessionId}`,
      });
    } catch (error) {
      console.warn('API unavailable for deleting session, using local');
      return mockChatService.deleteSession(sessionId);
    }
  },

  updateSession: async (sessionId: string, updates: Partial<Session>): Promise<Session> => {
    if (apiAdapterManager.shouldUseLocal()) {
      const updated = await mockChatService.updateSession(sessionId, updates);
      return (
        updated || {
          id: sessionId,
          user_id: 'default',
          title: updates.title || '更新后的会话',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          message_count: 0,
          ...updates,
        }
      );
    }

    try {
      const response = await apiAdapterManager.request<Record<string, unknown>>({
        method: 'PUT',
        url: `/api/v1/session/${sessionId}`,
        data: updates,
      });
      return transformSession(response.data);
    } catch (error) {
      console.warn('API unavailable for updating session, using local');
      const updated = await mockChatService.updateSession(sessionId, updates);
      return (
        updated || {
          id: sessionId,
          user_id: 'default',
          title: updates.title || '更新后的会话',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          message_count: 0,
          ...updates,
        }
      );
    }
  },

  getMessages: async (sessionId: string, page = 1, pageSize = 50): Promise<MessageListResponse> => {
    if (apiAdapterManager.shouldUseLocal()) {
      const messages = await mockChatService.getMessages(sessionId);
      return {
        messages,
        total: messages.length,
        has_more: false,
      };
    }

    try {
      const response = await apiAdapterManager.request<MessageListResponse>({
        method: 'GET',
        url: `/api/v1/session/${sessionId}/messages`,
        params: { page, page_size: pageSize },
      });
      return {
        ...response.data,
        messages: (response.data.messages as unknown as Array<Record<string, unknown>>).map(
          transformMessage
        ),
      };
    } catch (error) {
      console.warn('API unavailable for messages, using local');
      const messages = await mockChatService.getMessages(sessionId);
      return {
        messages,
        total: messages.length,
        has_more: false,
      };
    }
  },

  getRecommendedQuestions: async (
    sessionId?: string
  ): Promise<{ questions: { id: string; question: string }[] }> => {
    if (apiAdapterManager.shouldUseLocal()) {
      return { questions: await mockChatService.getRecommendedQuestions() };
    }

    try {
      const response = await apiAdapterManager.request<{
        questions: { id: string; question: string }[];
      }>({
        method: 'GET',
        url: '/chat/recommendations',
        params: { session_id: sessionId },
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable for recommendations, using local data');
      return { questions: await mockChatService.getRecommendedQuestions() };
    }
  },

  submitFeedback: async (messageId: string, feedback: 'helpful' | 'unclear'): Promise<void> => {
    await mockChatService.submitFeedback(messageId, feedback);

    if (apiAdapterManager.shouldUseRemote()) {
      try {
        await apiAdapterManager.request({
          method: 'POST',
          url: `/chat/message/${messageId}/feedback`,
          data: { feedback },
        });
      } catch (error) {
        console.warn('API unavailable for feedback');
      }
    }
  },

  getSession: async (sessionId: string): Promise<Session> => {
    if (apiAdapterManager.shouldUseLocal()) {
      const session = await chatRepository.getSession(sessionId);
      return (
        session || {
          id: sessionId,
          user_id: 'default',
          title: '会话详情',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          message_count: 0,
        }
      );
    }

    try {
      const response = await apiAdapterManager.request<Record<string, unknown>>({
        method: 'GET',
        url: `/session/${sessionId}`,
      });
      return transformSession(response.data);
    } catch (error) {
      console.warn('API unavailable for getting session, using local');
      const session = await chatRepository.getSession(sessionId);
      return (
        session || {
          id: sessionId,
          user_id: 'default',
          title: '会话详情',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          message_count: 0,
        }
      );
    }
  },

  editMessage: async (
    messageId: string,
    content: string
  ): Promise<{ success: boolean; message: Record<string, unknown> | null }> => {
    try {
      await chatRepository.updateMessage(messageId, { content, is_edited: true });
      return { success: true, message: null };
    } catch (error) {
      return { success: false, message: null };
    }
  },

  deleteMessage: async (messageId: string): Promise<{ success: boolean }> => {
    try {
      await chatRepository.deleteMessage(messageId);
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  },

  exportSession: async (
    sessionId: string,
    format: 'json' | 'txt' | 'md' = 'json'
  ): Promise<unknown> => {
    try {
      const messages = await chatRepository.getMessagesBySession(sessionId);
      const session = await chatRepository.getSession(sessionId);
      return { session, messages, format, exported_at: new Date().toISOString() };
    } catch (error) {
      return null;
    }
  },

  batchDeleteSessions: async (
    sessionIds: string[]
  ): Promise<{ success_count: number; failed_ids: Array<{ id: string; reason: string }> }> => {
    let successCount = 0;
    const failedIds: Array<{ id: string; reason: string }> = [];

    for (const id of sessionIds) {
      try {
        await chatRepository.deleteSession(id);
        successCount++;
      } catch (e) {
        failedIds.push({ id, reason: String(e) });
      }
    }

    return { success_count: successCount, failed_ids: failedIds };
  },

  batchArchiveSessions: async (
    sessionIds: string[],
    archive: boolean
  ): Promise<{ success_count: number; failed_ids: Array<{ id: string; reason: string }> }> => {
    let successCount = 0;
    const failedIds: Array<{ id: string; reason: string }> = [];

    for (const id of sessionIds) {
      try {
        await chatRepository.updateSession(id, { is_archived: archive });
        successCount++;
      } catch (e) {
        failedIds.push({ id, reason: String(e) });
      }
    }

    return { success_count: successCount, failed_ids: failedIds };
  },

  searchSessions: async (
    query: string,
    page = 1,
    pageSize = 20
  ): Promise<{ sessions: Session[]; total: number; page: number; page_size: number }> => {
    const sessions = await chatRepository.searchSessions(query);
    const start = (page - 1) * pageSize;
    return {
      sessions: sessions.slice(start, start + pageSize),
      total: sessions.length,
      page,
      page_size: pageSize,
    };
  },

  searchMessages: async (
    query: string,
    page = 1,
    pageSize = 20
  ): Promise<{
    messages: Record<string, unknown>[];
    total: number;
    page: number;
    page_size: number;
  }> => {
    const messages = await chatRepository.searchMessages(query);
    const start = (page - 1) * pageSize;
    return {
      messages: messages.slice(start, start + pageSize) as unknown as Record<string, unknown>[],
      total: messages.length,
      page,
      page_size: pageSize,
    };
  },

  shareSession: async (
    sessionId: string
  ): Promise<{ share_id: string; share_url: string; expires_at: string }> => {
    console.debug('shareSession called for:', sessionId);
    return {
      share_id: '',
      share_url: '',
      expires_at: '',
    };
  },

  getRecommendations: async (sessionId: string) => {
    if (apiAdapterManager.shouldUseLocal()) {
      return {
        questions: [
          { id: '1', question: '武汉木雕的传承人有哪些？' },
          { id: '2', question: '浮雕技法的特点是什么？' },
          { id: '3', question: '黄鹤楼木雕作品的历史背景？' },
        ],
      };
    }

    try {
      const response = await apiAdapterManager.request<{
        questions: Array<{ id: string; question: string }>;
      }>({
        method: 'GET',
        url: '/chat/recommendations',
        params: { session_id: sessionId },
      });
      return response.data;
    } catch (error) {
      console.warn('Failed to load recommendations, using local data');
      return {
        questions: [
          { id: '1', question: '武汉木雕的传承人有哪些？' },
          { id: '2', question: '浮雕技法的特点是什么？' },
          { id: '3', question: '黄鹤楼木雕作品的历史背景？' },
        ],
      };
    }
  },

  isApiConnected: () => apiAdapterManager.getOnlineStatus(),
};

export default chatApi;
