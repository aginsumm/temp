import apiClient, { subscribeToConnectionStatus, getConnectionStatus } from './client';
import { generateMockResponse, getMockRecommendedQuestions } from './mockResponses';
import type {
  ChatRequest,
  ChatResponse,
  Session,
  SessionListResponse,
  MessageListResponse,
} from '../types/chat';

let isApiAvailable = getConnectionStatus();

subscribeToConnectionStatus((connected) => {
  isApiAvailable = connected;
});

export const chatApi = {
  sendMessage: async (request: ChatRequest): Promise<ChatResponse> => {
    try {
      const response = await apiClient.post<ChatResponse>('/api/v1/chat/message', request);
      return response.data;
    } catch (error) {
      console.warn('API unavailable, using intelligent mock response');
      return generateMockResponse(request.content) as ChatResponse;
    }
  },

  sendMessageStream: async (
    request: ChatRequest,
    onChunk: (chunk: string) => void,
    onComplete: (response: ChatResponse) => void
  ): Promise<void> => {
    try {
      const response = await fetch(`${apiClient.defaults.baseURL}/api/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let lastResponse: ChatResponse | null = null;

      if (reader) {
        let done = false;
        while (!done) {
          const { done: readerDone, value } = await reader.read();
          done = readerDone;
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'content') {
                  onChunk(data.content);
                } else if (data.type === 'complete') {
                  lastResponse = data.response;
                }
              } catch {
                console.warn('Failed to parse SSE data:', line);
              }
            }
          }
        }
      }

      if (lastResponse) {
        onComplete(lastResponse);
      }
    } catch (error) {
      console.warn('Stream API unavailable, using intelligent mock response');
      const mockResponse = generateMockResponse(request.content);
      const paragraphs = mockResponse.content.split('\n\n');
      let currentParagraph = 0;
      let currentChar = 0;

      const interval = setInterval(() => {
        if (currentParagraph < paragraphs.length) {
          const paragraph = paragraphs[currentParagraph];
          if (currentChar < paragraph.length) {
            const char = paragraph[currentChar];
            onChunk(char);
            currentChar++;
          } else {
            onChunk('\n\n');
            currentParagraph++;
            currentChar = 0;
          }
        } else {
          clearInterval(interval);
          onComplete(mockResponse as ChatResponse);
        }
      }, 20);
    }
  },

  getSessions: async (page = 1, pageSize = 20): Promise<SessionListResponse> => {
    try {
      const response = await apiClient.get<SessionListResponse>('/api/v1/session', {
        params: { page, pageSize },
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable for sessions, returning empty list');
      return {
        sessions: [],
        total: 0,
        page,
        pageSize,
      };
    }
  },

  createSession: async (title = '新对话'): Promise<Session> => {
    try {
      const response = await apiClient.post<Session>('/api/v1/session', { title });
      return response.data;
    } catch (error) {
      console.warn('API unavailable for creating session, using mock');
      return {
        id: `mock_session_${Date.now()}`,
        userId: 'mock_user',
        title,
        createdAt: new Date(),
        updatedAt: new Date(),
        messageCount: 0,
        isPinned: false,
      };
    }
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    try {
      await apiClient.delete(`/api/v1/session/${sessionId}`);
    } catch (error) {
      console.warn('API unavailable for deleting session');
    }
  },

  updateSession: async (sessionId: string, updates: Partial<Session>): Promise<Session> => {
    try {
      const response = await apiClient.put<Session>(`/api/v1/session/${sessionId}`, updates);
      return response.data;
    } catch (error) {
      console.warn('API unavailable for updating session');
      return {
        id: sessionId,
        userId: 'mock_user',
        title: updates.title || '更新后的会话',
        createdAt: new Date(),
        updatedAt: new Date(),
        messageCount: 0,
        ...updates,
      };
    }
  },

  getMessages: async (sessionId: string, page = 1, pageSize = 50): Promise<MessageListResponse> => {
    try {
      const response = await apiClient.get<MessageListResponse>(
        `/api/v1/session/${sessionId}/messages`,
        {
          params: { page, pageSize },
        }
      );
      return response.data;
    } catch (error) {
      console.warn('API unavailable for messages');
      return {
        messages: [],
        total: 0,
        hasMore: false,
      };
    }
  },

  getRecommendedQuestions: async (
    sessionId?: string
  ): Promise<{ questions: { id: string; question: string }[] }> => {
    try {
      const response = await apiClient.get('/api/v1/chat/recommendations', {
        params: { sessionId },
      });
      return response.data;
    } catch (error) {
      console.warn('API unavailable for recommendations, using intelligent mock data');
      return { questions: getMockRecommendedQuestions() };
    }
  },

  toggleFavorite: async (messageId: string): Promise<{ isFavorite: boolean }> => {
    try {
      const response = await apiClient.post(`/api/v1/chat/message/${messageId}/favorite`);
      return response.data;
    } catch (error) {
      console.warn('API unavailable for toggle favorite');
      return { isFavorite: true };
    }
  },

  submitFeedback: async (messageId: string, feedback: 'helpful' | 'unclear'): Promise<void> => {
    try {
      await apiClient.post(`/api/v1/chat/message/${messageId}/feedback`, { feedback });
    } catch (error) {
      console.warn('API unavailable for feedback');
    }
  },

  isApiConnected: () => isApiAvailable,
};

export default chatApi;
