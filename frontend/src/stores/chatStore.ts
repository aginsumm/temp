import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, Message } from '../types/chat';
import { networkStatusService, type ConnectionMode } from '../services/networkStatus';

interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  messagesBySession: Record<string, Message[]>;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  networkMode: ConnectionMode;
  pendingSyncCount: number;

  createSession: (userId?: string) => Session;
  deleteSession: (id: string) => void;
  switchSession: (id: string) => void;
  updateSessionTitle: (id: string, title: string) => void;
  pinSession: (id: string) => void;

  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;

  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;

  setSessions: (sessions: Session[]) => void;
  setMessages: (messages: Message[]) => void;
  setMessagesForSession: (sessionId: string, messages: Message[]) => void;

  setNetworkMode: (mode: ConnectionMode) => void;
  setPendingSyncCount: (count: number) => void;

  getSessionMessages: (sessionId: string) => Message[];
  clearError: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      messages: [],
      messagesBySession: {},
      isLoading: false,
      isStreaming: false,
      error: null,
      networkMode: 'checking',
      pendingSyncCount: 0,

      createSession: (userId = 'default') => {
        const newSession: Session = {
          id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          title: '新对话',
          createdAt: new Date(),
          updatedAt: new Date(),
          messageCount: 0,
          isPinned: false,
        };
        set((state) => ({
          sessions: [newSession, ...state.sessions],
          currentSessionId: newSession.id,
          messages: [],
          messagesBySession: {
            ...state.messagesBySession,
            [newSession.id]: [],
          },
        }));
        return newSession;
      },

      deleteSession: (id) => {
        set((state) => {
          const newSessions = state.sessions.filter((s) => s.id !== id);
          const newCurrentId =
            state.currentSessionId === id
              ? newSessions.length > 0
                ? newSessions[0].id
                : null
              : state.currentSessionId;

          const newMessagesBySession = { ...state.messagesBySession };
          delete newMessagesBySession[id];

          return {
            sessions: newSessions,
            currentSessionId: newCurrentId,
            messages: state.currentSessionId === id ? [] : state.messages,
            messagesBySession: newMessagesBySession,
          };
        });
      },

      switchSession: (id) => {
        const state = get();
        const sessionMessages = state.messagesBySession[id] || [];
        set({
          currentSessionId: id,
          messages: sessionMessages,
        });
      },

      updateSessionTitle: (id, title) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, title, updatedAt: new Date() } : s
          ),
        }));
      },

      pinSession: (id) => {
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, isPinned: !s.isPinned } : s)),
        }));
      },

      addMessage: (message) => {
        set((state) => {
          const sessionId = message.sessionId;
          const currentMessages = state.messagesBySession[sessionId] || [];

          return {
            messages: [...state.messages, message],
            messagesBySession: {
              ...state.messagesBySession,
              [sessionId]: [...currentMessages, message],
            },
            sessions: state.sessions.map((s) =>
              s.id === sessionId
                ? { ...s, messageCount: s.messageCount + 1, updatedAt: new Date() }
                : s
            ),
          };
        });
      },

      updateMessage: (id, updates) => {
        set((state) => {
          const currentSessionId = state.currentSessionId;
          if (!currentSessionId) return state;

          return {
            messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
            messagesBySession: {
              ...state.messagesBySession,
              [currentSessionId]: (state.messagesBySession[currentSessionId] || []).map((m) =>
                m.id === id ? { ...m, ...updates } : m
              ),
            },
          };
        });
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setStreaming: (streaming) => {
        set({ isStreaming: streaming });
      },

      setError: (error) => {
        set({ error });
      },

      setSessions: (sessions) => {
        set({ sessions });
      },

      setMessages: (messages) => {
        const currentSessionId = get().currentSessionId;
        set((state) => ({
          messages,
          messagesBySession: currentSessionId
            ? { ...state.messagesBySession, [currentSessionId]: messages }
            : state.messagesBySession,
        }));
      },

      setMessagesForSession: (sessionId, messages) => {
        set((state) => ({
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: messages,
          },
        }));
      },

      setNetworkMode: (mode) => {
        set({ networkMode: mode });
      },

      setPendingSyncCount: (count) => {
        set({ pendingSyncCount: count });
      },

      getSessionMessages: (sessionId) => {
        return get().messagesBySession[sessionId] || [];
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        messagesBySession: state.messagesBySession,
      }),
    }
  )
);

networkStatusService.subscribe((status) => {
  useChatStore.getState().setNetworkMode(status.mode);
});
