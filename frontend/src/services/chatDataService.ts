import { networkStatusService, type NetworkStatus } from './networkStatus';
import { dataSyncService } from './dataSync';
import { offlineStorage } from './offlineStorage';
import chatApi from '../api/chat';
import { generateMockResponse, getMockRecommendedQuestions } from '../api/mockResponses';
import type { Session, Message } from '../types/chat';

type Mode = 'online' | 'offline';

interface UnifiedChatService {
  getSessions: () => Promise<Session[]>;
  createSession: (title?: string) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;
  getMessages: (sessionId: string) => Promise<Message[]>;
  sendMessage: (sessionId: string, content: string) => Promise<Message>;
  submitFeedback: (messageId: string, feedback: 'helpful' | 'unclear') => Promise<void>;
  toggleFavorite: (messageId: string) => Promise<boolean>;
  getRecommendedQuestions: (sessionId?: string) => Promise<{ id: string; question: string }[]>;
}

class ChatDataService implements UnifiedChatService {
  private mode: Mode = 'online';
  private initialized = false;

  constructor() {
    networkStatusService.subscribe((status: NetworkStatus) => {
      this.mode = status.mode === 'online' ? 'online' : 'offline';
    });

    this.mode = networkStatusService.isOnline() ? 'online' : 'offline';
    this.init();
  }

  private async init() {
    await offlineStorage.init();
    this.initialized = true;
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  getMode(): Mode {
    return this.mode;
  }

  isOnline(): boolean {
    return this.mode === 'online';
  }

  async getSessions(): Promise<Session[]> {
    await this.ensureInitialized();
    if (this.mode === 'online') {
      try {
        const response = await chatApi.getSessions();
        const sessions = response.sessions;

        for (const session of sessions) {
          await offlineStorage.saveSession(session);
        }

        return sessions;
      } catch (error) {
        console.warn('Failed to get sessions from server, using local data');
        return await offlineStorage.getAllSessions();
      }
    } else {
      return await offlineStorage.getAllSessions();
    }
  }

  async createSession(title = '新对话'): Promise<Session> {
    await this.ensureInitialized();
    const session: Session = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'default',
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
    };

    await offlineStorage.saveSession(session);

    if (this.mode === 'online') {
      try {
        const serverSession = await chatApi.createSession(title);
        await offlineStorage.saveSession(serverSession);
        return serverSession;
      } catch (error) {
        console.warn('Failed to create session on server, saved locally only');
      }
    } else {
      await dataSyncService.saveSessionLocally(session);
    }

    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    await offlineStorage.deleteSession(sessionId);

    if (this.mode === 'online') {
      try {
        await chatApi.deleteSession(sessionId);
      } catch (error) {
        console.warn('Failed to delete session on server');
      }
    } else {
      await dataSyncService.deleteSessionLocally(sessionId);
    }
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    await this.ensureInitialized();
    if (this.mode === 'online') {
      try {
        const response = await chatApi.getMessages(sessionId);
        const messages = response.messages;

        for (const message of messages) {
          await offlineStorage.saveMessage(message);
        }

        return messages;
      } catch (error) {
        console.warn('Failed to get messages from server, using local data');
        return await offlineStorage.getMessages(sessionId);
      }
    } else {
      return await offlineStorage.getMessages(sessionId);
    }
  }

  async sendMessage(sessionId: string, content: string): Promise<Message> {
    await this.ensureInitialized();
    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      sessionId,
      role: 'user',
      content,
      createdAt: new Date(),
    };

    await offlineStorage.saveMessage(userMessage);

    let aiMessage: Message;

    if (this.mode === 'online') {
      try {
        const response = await chatApi.sendMessage({
          sessionId,
          content,
        });

        aiMessage = {
          id: response.messageId,
          sessionId,
          role: 'assistant',
          content: response.content,
          createdAt: new Date(response.createdAt),
          sources: response.sources || [],
          entities: response.entities || [],
          keywords: response.keywords || [],
        };

        await offlineStorage.saveMessage(aiMessage);
      } catch (error) {
        console.warn('Failed to send message to server, using mock response');
        aiMessage = await this.generateOfflineResponse(sessionId, content);
      }
    } else {
      aiMessage = await this.generateOfflineResponse(sessionId, content);
      await dataSyncService.saveMessageLocally(userMessage);
    }

    return aiMessage;
  }

  private async generateOfflineResponse(sessionId: string, content: string): Promise<Message> {
    const mockResponse = generateMockResponse(content);

    const aiMessage: Message = {
      id: `msg_${Date.now()}_assistant`,
      sessionId,
      role: 'assistant',
      content: mockResponse.content,
      createdAt: new Date(),
      sources: mockResponse.sources || [],
      entities: mockResponse.entities || [],
      keywords: mockResponse.keywords || [],
    };

    await offlineStorage.saveMessage(aiMessage);
    return aiMessage;
  }

  async submitFeedback(messageId: string, feedback: 'helpful' | 'unclear'): Promise<void> {
    await offlineStorage.updateMessage(messageId, { feedback });

    if (this.mode === 'online') {
      try {
        await chatApi.submitFeedback(messageId, feedback);
      } catch (error) {
        console.warn('Failed to submit feedback to server');
      }
    } else {
      await dataSyncService.updateMessageFeedbackLocally(messageId, feedback);
    }
  }

  async toggleFavorite(messageId: string, currentStatus?: boolean): Promise<boolean> {
    const newFavoriteStatus = currentStatus !== undefined ? !currentStatus : true;
    await offlineStorage.updateMessage(messageId, { isFavorite: newFavoriteStatus });

    if (this.mode === 'online') {
      try {
        const response = await chatApi.toggleFavorite(messageId);
        return response.isFavorite;
      } catch (error) {
        console.warn('Failed to toggle favorite on server');
      }
    }

    return newFavoriteStatus;
  }

  async getRecommendedQuestions(sessionId?: string): Promise<{ id: string; question: string }[]> {
    if (this.mode === 'online') {
      try {
        const response = await chatApi.getRecommendedQuestions(sessionId);
        return response.questions || [];
      } catch (error) {
        console.warn('Failed to get recommendations from server, using mock data');
        return getMockRecommendedQuestions();
      }
    } else {
      return getMockRecommendedQuestions();
    }
  }

  async forceSync(): Promise<void> {
    if (this.mode === 'online') {
      await dataSyncService.syncPendingOperations();
    }
  }

  async getStorageStats() {
    return await offlineStorage.getStorageStats();
  }
}

export const chatDataService = new ChatDataService();
export type { UnifiedChatService };
