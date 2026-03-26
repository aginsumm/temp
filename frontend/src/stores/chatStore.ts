import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, Message } from '../types/chat';

interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;

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
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, _get) => ({
      sessions: [],
      currentSessionId: null,
      messages: [],
      isLoading: false,
      isStreaming: false,
      error: null,

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
          return {
            sessions: newSessions,
            currentSessionId: newCurrentId,
            messages: state.currentSessionId === id ? [] : state.messages,
          };
        });
      },

      switchSession: (id) => {
        set({ currentSessionId: id });
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
        set((state) => ({
          messages: [...state.messages, message],
          sessions: state.sessions.map((s) =>
            s.id === message.sessionId
              ? { ...s, messageCount: s.messageCount + 1, updatedAt: new Date() }
              : s
          ),
        }));
      },

      updateMessage: (id, updates) => {
        set((state) => ({
          messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        }));
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
        set({ messages });
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
);
