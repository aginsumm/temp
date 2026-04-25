import { networkStatusService, type NetworkStatus } from './networkStatus';
import { chatRepository } from '../data/repositories/chatRepository';
import { dataInitializer } from '../data/dataInitializer';
import type { Session, Message } from '../types/chat';

const CURRENT_USER_KEY = 'heritage_current_user';

function getCurrentUserId(): string {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      return user.id || 'guest_user';
    }
  } catch {
    console.warn('Failed to parse current user');
  }
  return 'guest_user';
}

type Mode = 'online' | 'offline';

interface StreamState {
  aborted: boolean;
  intervalId: NodeJS.Timeout | null;
  timeoutId: NodeJS.Timeout | null;
}

interface UnifiedChatService {
  getSessions: () => Promise<Session[]>;
  createSession: (title?: string) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSession: (sessionId: string, updates: Partial<Session>) => Promise<Session>;
  getMessages: (sessionId: string) => Promise<Message[]>;
  sendMessage: (sessionId: string, content: string) => Promise<Message>;
  sendMessageStream: (
    sessionId: string,
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: (message: Message) => void,
    onError?: (error: Error) => void
  ) => Promise<() => void>;
  regenerateMessageStream: (
    messageId: string,
    onChunk: (chunk: string) => void,
    onComplete: (message: Message) => void,
    onError?: (error: Error) => void
  ) => Promise<() => void>;
  submitFeedback: (messageId: string, feedback: 'helpful' | 'unclear') => Promise<void>;
  toggleFavorite: (messageId: string, currentStatus?: boolean) => Promise<boolean>;
  getRecommendedQuestions: (sessionId?: string) => Promise<{ id: string; question: string }[]>;
  getFavoriteQuestions: () => Promise<
    { id: string; question: string; category: string; timestamp: string }[]
  >;
  getFavoriteMessages: (page?: number, pageSize?: number) => Promise<Message[]>;
}

const STREAM_TIMEOUT = 60000;
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_BASE = 1000;

class ChatDataService implements UnifiedChatService {
  private mode: Mode = 'offline';
  private initialized = false;
  private activeStreams: Map<string, StreamState> = new Map();

  constructor() {
    networkStatusService.subscribe((status: NetworkStatus) => {
      this.mode = status.mode === 'online' ? 'online' : 'offline';
    });

    this.mode = networkStatusService.isOnline() ? 'online' : 'offline';
    this.init();
  }

  private async init() {
    await dataInitializer.initialize();
    this.initialized = true;
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  private cleanupStream(streamId: string) {
    const streamState = this.activeStreams.get(streamId);
    if (streamState) {
      if (streamState.intervalId) {
        clearInterval(streamState.intervalId);
      }
      if (streamState.timeoutId) {
        clearTimeout(streamState.timeoutId);
      }
      this.activeStreams.delete(streamId);
    }
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = MAX_RETRY_COUNT
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`${operationName} attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt < maxRetries - 1) {
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`${operationName} failed after ${maxRetries} retries`);
  }

  getMode(): Mode {
    return this.mode;
  }

  isOnline(): boolean {
    return this.mode === 'online';
  }

  async getSessions(): Promise<Session[]> {
    await this.ensureInitialized();
    return this.withRetry(() => chatRepository.getAllSessions(), 'getSessions');
  }

  async createSession(title = '新对话'): Promise<Session> {
    await this.ensureInitialized();
    const userId = getCurrentUserId();
    return this.withRetry(() => chatRepository.createSession(userId, title), 'createSession');
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    return this.withRetry(() => chatRepository.deleteSession(sessionId), 'deleteSession');
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    await this.ensureInitialized();
    const updated = await chatRepository.updateSession(sessionId, updates);
    return updated || ({ id: sessionId, ...updates } as Session);
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    await this.ensureInitialized();
    return this.withRetry(() => chatRepository.getMessagesBySession(sessionId), 'getMessages');
  }

  async sendMessage(sessionId: string, content: string): Promise<Message> {
    await this.ensureInitialized();
    return this.withRetry(() => chatRepository.sendMessage(sessionId, content), 'sendMessage');
  }

  async sendMessageStream(
    sessionId: string,
    content: string,
    onChunk: (chunk: string) => void,
    onComplete: (message: Message) => void,
    onError?: (error: Error) => void
  ): Promise<() => void> {
    await this.ensureInitialized();

    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const streamState: StreamState = {
      aborted: false,
      intervalId: null,
      timeoutId: null,
    };
    this.activeStreams.set(streamId, streamState);

    const cleanup = () => {
      this.cleanupStream(streamId);
    };

    streamState.timeoutId = setTimeout(() => {
      if (!streamState.aborted) {
        streamState.aborted = true;
        cleanup();
        if (onError) {
          onError(new Error('Stream timeout - 响应超时，请重试'));
        }
      }
    }, STREAM_TIMEOUT);

    const abortFn = await chatRepository.sendMessageStream(
      sessionId,
      content,
      (chunk) => {
        if (!streamState.aborted) {
          onChunk(chunk);
        }
      },
      (message) => {
        if (!streamState.aborted) {
          if (streamState.timeoutId) {
            clearTimeout(streamState.timeoutId);
          }
          cleanup();
          chatRepository.addMessage(message).catch((err) => {
            console.error('Failed to save AI message:', err);
          });
          Promise.resolve(onComplete(message)).catch((err) => {
            console.error('Error in onComplete callback:', err);
          });
        }
      },
      (error) => {
        if (!streamState.aborted) {
          cleanup();
          if (onError) {
            onError(error);
          }
        }
      }
    );

    return () => {
      streamState.aborted = true;
      cleanup();
      if (typeof abortFn === 'function') {
        abortFn();
      }
    };
  }

  async regenerateMessageStream(
    messageId: string,
    onChunk: (chunk: string) => void,
    onComplete: (message: Message) => void,
    onError?: (error: Error) => void
  ): Promise<() => void> {
    await this.ensureInitialized();

    const streamId = `regenerate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const streamState: StreamState = {
      aborted: false,
      intervalId: null,
      timeoutId: null,
    };
    this.activeStreams.set(streamId, streamState);

    const cleanup = () => {
      this.cleanupStream(streamId);
    };

    streamState.timeoutId = setTimeout(() => {
      if (!streamState.aborted) {
        streamState.aborted = true;
        cleanup();
        if (onError) {
          onError(new Error('Stream timeout - 重新生成超时，请重试'));
        }
      }
    }, STREAM_TIMEOUT);

    const abortFn = await chatRepository.regenerateMessageStream(
      messageId,
      (chunk) => {
        if (!streamState.aborted) {
          onChunk(chunk);
        }
      },
      (message) => {
        if (!streamState.aborted) {
          if (streamState.timeoutId) {
            clearTimeout(streamState.timeoutId);
          }
          cleanup();
          Promise.resolve(onComplete(message)).catch((err) => {
            console.error('Error in onComplete callback:', err);
          });
        }
      },
      (error) => {
        if (!streamState.aborted) {
          cleanup();
          if (onError) {
            onError(error);
          }
        }
      }
    );

    return () => {
      streamState.aborted = true;
      cleanup();
      if (typeof abortFn === 'function') {
        abortFn();
      }
    };
  }

  async submitFeedback(messageId: string, feedback: 'helpful' | 'unclear'): Promise<void> {
    await this.ensureInitialized();
    await chatRepository.updateMessage(messageId, { feedback });
  }

  async toggleFavorite(messageId: string, currentStatus?: boolean): Promise<boolean> {
    await this.ensureInitialized();
    return chatRepository.toggleFavorite(messageId, currentStatus);
  }

  async getRecommendedQuestions(sessionId?: string): Promise<{ id: string; question: string }[]> {
    console.debug('getRecommendedQuestions for session:', sessionId);
    return chatRepository.getRecommendedQuestions();
  }

  async getFavoriteQuestions(): Promise<
    { id: string; question: string; category: string; timestamp: string }[]
  > {
    await this.ensureInitialized();

    const allMessages = await chatRepository.getAllMessages();
    const favoriteMessages = allMessages.filter((m) => m.is_favorite);

    return favoriteMessages.map((m) => ({
      id: m.id,
      question: m.content,
      category: m.role === 'user' ? '收藏问题' : '收藏回答',
      timestamp: m.created_at,
    }));
  }

  async getFavoriteMessages(page = 1, pageSize = 20): Promise<Message[]> {
    await this.ensureInitialized();

    const favoriteMessages = await chatRepository.getFavoriteMessages();
    return favoriteMessages.slice((page - 1) * pageSize, page * pageSize);
  }

  async forceSync(): Promise<void> {
    console.log('Force sync - local mode only');
  }

  async getStorageStats() {
    const sessionCount = await chatRepository.getSessionCount();
    const messageCount = await chatRepository.getMessageCount();

    return {
      sessions: sessionCount,
      messages: messageCount,
      storage: 'IndexedDB',
      mode: 'local',
    };
  }

  abortAllStreams() {
    this.activeStreams.forEach((state, id) => {
      state.aborted = true;
      this.cleanupStream(id);
    });
  }

  generateSessionTitle(content: string): string {
    return chatRepository.generateSessionTitle(content);
  }
}

export const chatDataService = new ChatDataService();
export type { UnifiedChatService };
