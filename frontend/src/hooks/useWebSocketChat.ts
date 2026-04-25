import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

interface WebSocketIncomingMessage {
  type: 'stream' | 'chat' | 'assistant' | 'error' | string;
  id?: string;
  chunk?: string;
  content?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
  message?: string;
}

interface WebSocketMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: number;
  sessionId: string;
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
    sources?: string[];
    confidence?: number;
  };
  status?: 'pending' | 'streaming' | 'complete' | 'error';
}

interface WebSocketState {
  status: ConnectionStatus;
  messages: WebSocketMessage[];
  sessionId: string | null;
  error: string | null;
  reconnectAttempts: number;
  lastHeartbeat: number | null;
}

interface WebSocketActions {
  connect: (sessionId: string) => void;
  disconnect: () => void;
  sendMessage: (content: string, metadata?: Record<string, unknown>) => void;
  clearMessages: () => void;
  updateMessage: (messageId: string, updates: Partial<WebSocketMessage>) => void;
}

interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  messageTimeout: number;
}

const defaultConfig: WebSocketConfig = {
  url: `ws://${window.location.host}/ws/chat`,
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
  messageTimeout: 60000,
};

class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: string[] = [];
  private pendingMessages: Map<
    string,
    {
      timeout: NodeJS.Timeout;
      resolve: (value: WebSocketMessage) => void;
      reject: (error: Error) => void;
    }
  > = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private sessionId: string | null = null;

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  connect(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sessionId = sessionId;
      const url = `${this.config.url}?session_id=${sessionId}`;

      try {
        this.ws = new WebSocket(url);
        this.emit('status', 'connecting');

        this.ws.onopen = () => {
          this.emit('status', 'connected');
          this.startHeartbeat();
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onclose = (event) => {
          this.stopHeartbeat();
          this.emit('status', 'disconnected');

          if (!event.wasClean && this.sessionId) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.emit('status', 'error');
          this.emit('error', { message: 'WebSocket connection error', error });
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.emit('status', 'error');
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.sessionId = null;
    this.emit('status', 'disconnected');
  }

  send(
    type: string,
    data: Record<string, unknown>,
    expectResponse: boolean = false
  ): Promise<WebSocketMessage | string> {
    return new Promise((resolve, reject) => {
      const message = {
        id: this.generateId(),
        type,
        ...data,
        timestamp: Date.now(),
      };

      const messageStr = JSON.stringify(message);

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(messageStr);

        if (expectResponse) {
          const timeout = setTimeout(() => {
            this.pendingMessages.delete(message.id);
            reject(new Error('Message timeout'));
          }, this.config.messageTimeout);

          this.pendingMessages.set(message.id, { timeout, resolve, reject });
        } else {
          resolve(message.id);
        }
      } else {
        this.messageQueue.push(messageStr);
        resolve(message.id);
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, callback: (...args: any[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data?: unknown): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'chat':
        case 'stream':
          this.emit('message', message);
          break;

        case 'response': {
          const pending = this.pendingMessages.get(message.requestId);
          if (pending) {
            clearTimeout(pending.timeout);
            pending.resolve(message);
            this.pendingMessages.delete(message.requestId);
          }
          break;
        }

        case 'pong':
          this.emit('heartbeat', Date.now());
          break;

        case 'error':
          this.emit('error', message);
          break;

        default:
          this.emit('message', message);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.emit('status', 'reconnecting');

    this.reconnectTimer = setTimeout(() => {
      if (this.sessionId) {
        this.connect(this.sessionId).catch(() => {
          this.emit('reconnect_failed');
        });
      }
    }, this.config.reconnectInterval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift()!;
      this.ws.send(message);
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

const wsManager = new WebSocketManager();

export const useWebSocketStore = create<WebSocketState & WebSocketActions>()(
  persist(
    (set, get) => ({
      status: 'disconnected',
      messages: [],
      sessionId: null,
      error: null,
      reconnectAttempts: 0,
      lastHeartbeat: null,

      connect: (sessionId: string) => {
        set({ sessionId, status: 'connecting', error: null });
        wsManager.connect(sessionId);
      },

      disconnect: () => {
        wsManager.disconnect();
        set({ status: 'disconnected', sessionId: null });
      },

      sendMessage: async (content: string, metadata?: Record<string, unknown>) => {
        const state = get();
        const message: WebSocketMessage = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          type: 'user',
          content,
          timestamp: Date.now(),
          sessionId: state.sessionId || '',
          status: 'pending',
          metadata,
        };

        set((state) => ({
          messages: [...state.messages, message],
        }));

        try {
          await wsManager.send('chat', {
            content,
            sessionId: state.sessionId,
            metadata,
          });
        } catch (error) {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === message.id ? { ...m, status: 'error' } : m
            ),
            error: (error as Error).message,
          }));
        }
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      updateMessage: (messageId: string, updates: Partial<WebSocketMessage>) => {
        set((state) => ({
          messages: state.messages.map((m) => (m.id === messageId ? { ...m, ...updates } : m)),
        }));
      },
    }),
    {
      name: 'websocket-storage',
      partialize: (state) => ({
        sessionId: state.sessionId,
        messages: state.messages.slice(-100),
      }),
    }
  )
);

export function useWebSocketChat(sessionId: string) {
  const {
    status,
    messages,
    error,
    connect,
    disconnect,
    sendMessage,
    clearMessages,
    updateMessage,
  } = useWebSocketStore();

  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const unsubStatus = wsManager.on('status', (newStatus: ConnectionStatus) => {
      useWebSocketStore.setState({ status: newStatus });
    });

    const unsubMessage = wsManager.on('message', (message: WebSocketIncomingMessage) => {
      if (message.type === 'stream') {
        setStreamingMessage((prev) => prev + (message.chunk || ''));
        setIsTyping(true);
      } else if (message.type === 'chat' || message.type === 'assistant') {
        const newMessage: WebSocketMessage = {
          id: message.id || `${Date.now()}`,
          type: 'assistant',
          content: message.content || streamingMessage,
          timestamp: message.timestamp || Date.now(),
          sessionId: sessionId,
          status: 'complete',
          metadata: message.metadata,
        };

        useWebSocketStore.setState((state) => ({
          messages: [...state.messages, newMessage],
        }));

        setStreamingMessage('');
        setIsTyping(false);
      } else if (message.type === 'error') {
        useWebSocketStore.setState({ error: message.message });
        setIsTyping(false);
      }
    });

    const unsubError = wsManager.on('error', (error: Error) => {
      useWebSocketStore.setState({ error: error.message || 'Unknown error' });
    });

    const unsubHeartbeat = wsManager.on('heartbeat', (timestamp: number) => {
      useWebSocketStore.setState({ lastHeartbeat: timestamp });
    });

    connect(sessionId);

    return () => {
      unsubStatus();
      unsubMessage();
      unsubError();
      unsubHeartbeat();
    };
  }, [sessionId, connect, streamingMessage]);

  const sendChatMessage = useCallback(
    async (content: string, metadata?: Record<string, unknown>) => {
      setStreamingMessage('');
      await sendMessage(content, metadata);
    },
    [sendMessage]
  );

  const reconnect = useCallback(() => {
    if (sessionId) {
      connect(sessionId);
    }
  }, [sessionId, connect]);

  return {
    status,
    messages,
    error,
    streamingMessage,
    isTyping,
    sendMessage: sendChatMessage,
    clearMessages,
    disconnect,
    reconnect,
    updateMessage,
  };
}

export function useWebSocketStatus() {
  const { status, error, lastHeartbeat, reconnectAttempts } = useWebSocketStore();

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'reconnecting';
  const isDisconnected = status === 'disconnected';
  const hasError = status === 'error';

  return {
    status,
    error,
    lastHeartbeat,
    reconnectAttempts,
    isConnected,
    isConnecting,
    isDisconnected,
    hasError,
  };
}

export { WebSocketManager, wsManager };
export type { WebSocketMessage, WebSocketConfig, ConnectionStatus };
