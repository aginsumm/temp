import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session, Message, MessageVersion, Entity, Relation } from '../types/chat';
import { networkStatusService, type ConnectionMode } from '../services/networkStatus';
import { chatRepository } from '../data/repositories/chatRepository';
import { dataInitializer } from '../data/dataInitializer';
import { apiAdapterManager } from '../data/apiAdapter';
import { syncManager } from '../data/syncManager';

const MAX_SESSIONS = 100;
const MAX_MESSAGES_PER_SESSION = 500;
const MAX_MESSAGE_VERSIONS = 10;

interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  messagesBySession: Record<string, Message[]>;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  networkMode: ConnectionMode;
  pendingSyncCount: number;
  isDataLoaded: boolean;

  // 图谱数据状态
  currentEntities: Entity[];
  currentRelations: Relation[];
  currentKeywords: string[];

  initializeData: () => Promise<void>;
  loadSessionsFromDB: () => Promise<void>;
  loadMessagesFromDB: (sessionId: string) => Promise<void>;

  createSession: (userId?: string) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  deleteSessions: (ids: string[]) => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  updateSessionTitle: (id: string, title: string) => Promise<void>;
  pinSession: (id: string) => Promise<void>;
  archiveSession: (id: string) => Promise<void>;
  addTagToSession: (id: string, tag: string) => Promise<void>;
  removeTagFromSession: (id: string, tag: string) => Promise<void>;

  addMessage: (message: Message) => Promise<void>;
  updateMessage: (id: string, updates: Partial<Message>) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  clearMessages: () => void;
  clearCurrentSessionMessages: () => void;

  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;

  setSessions: (sessions: Session[] | ((prev: Session[]) => Session[])) => void;
  setMessages: (messages: Message[]) => void;
  setMessagesForSession: (sessionId: string, messages: Message[]) => void;

  setNetworkMode: (mode: ConnectionMode) => void;
  setPendingSyncCount: (count: number) => void;

  getSessionMessages: (sessionId: string) => Message[];
  getCurrentMessages: () => Message[];
  clearError: () => void;

  searchSessions: (query: string) => Session[];
  batchDeleteSessions: (ids: string[]) => Promise<void>;
  batchArchiveSessions: (ids: string[], archive: boolean) => Promise<void>;

  addMessageVersion: (messageId: string, content: string, versionGroupId?: string) => void;
  switchMessageVersion: (messageId: string, versionId: string) => void;
  editAndRegenerate: (messageId: string, newContent: string) => void;
  syncVersionForGroup: (versionGroupId: string, versionIndex: number) => void;

  cleanupOldData: () => void;
  getStorageStats: () => {
    sessionsCount: number;
    totalMessages: number;
    oldestSession: string | null;
  };

  // 图谱数据管理方法
  setCurrentEntities: (entities: Entity[]) => void;
  setCurrentRelations: (relations: Relation[]) => void;
  setCurrentKeywords: (keywords: string[]) => void;
  updateGraphData: (entities?: Entity[], relations?: Relation[], keywords?: string[]) => void;
  clearGraphData: () => void;

  // 消息批量操作方法
  batchDeleteMessages: (messageIds: string[]) => Promise<void>;
  batchFavoriteMessages: (messageIds: string[], favorite: boolean) => Promise<void>;
  batchExportMessages: (
    messageIds: string[],
    format: 'json' | 'txt' | 'md'
  ) => Promise<{ success: boolean; count: number }>;
}

const pruneMessages = (messages: Message[]): Message[] => {
  if (messages.length <= MAX_MESSAGES_PER_SESSION) return messages;

  // 按时间排序，确保时间顺序
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const favoriteMessages = sortedMessages.filter((m) => m.is_favorite);
  const messagesWithEntities = sortedMessages.filter((m) => m.entities && m.entities.length > 0);
  const messagesWithSources = sortedMessages.filter((m) => m.sources && m.sources.length > 0);

  const importantMessageIds = new Set([
    ...favoriteMessages.map((m) => m.id),
    ...messagesWithEntities.map((m) => m.id),
    ...messagesWithSources.map((m) => m.id),
  ]);

  // 分离重要消息和普通消息，保持时间顺序
  const importantMessages: Message[] = [];
  const regularMessages: Message[] = [];

  sortedMessages.forEach((m) => {
    if (importantMessageIds.has(m.id)) {
      importantMessages.push(m);
    } else {
      regularMessages.push(m);
    }
  });

  // 计算保留数量
  const reservedSlots = Math.min(
    importantMessages.length,
    Math.floor(MAX_MESSAGES_PER_SESSION * 0.4)
  );
  const regularSlots = MAX_MESSAGES_PER_SESSION - reservedSlots;

  // 保留最近的重要消息和普通消息，保持时间顺序
  const recentImportantMessages = importantMessages.slice(-reservedSlots);
  const recentRegularMessages = regularMessages.slice(-regularSlots);

  // 合并并按时间排序
  const pruned = [...recentImportantMessages, ...recentRegularMessages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return pruned;
};

export const pruneVersions = (
  versions: MessageVersion[],
  maxVersions: number = MAX_MESSAGE_VERSIONS
): MessageVersion[] => {
  if (versions.length <= maxVersions) return versions;

  const sortedVersions = [...versions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const currentVersionIndex = sortedVersions.findIndex((v) => v.is_current);
  const currentVersion = currentVersionIndex !== -1 ? sortedVersions[currentVersionIndex] : null;

  const firstVersion = sortedVersions[0];
  const lastVersion = sortedVersions[sortedVersions.length - 1];

  const versionMap = new Map<string, MessageVersion>();

  if (firstVersion) versionMap.set(firstVersion.id, firstVersion);
  if (lastVersion) versionMap.set(lastVersion.id, lastVersion);
  if (currentVersion) versionMap.set(currentVersion.id, currentVersion);

  const recentCount = Math.max(0, maxVersions - versionMap.size);
  const recentVersions = sortedVersions.slice(-recentCount);
  recentVersions.forEach((v) => versionMap.set(v.id, v));

  return Array.from(versionMap.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

const pruneSessions = (sessions: Session[]): Session[] => {
  if (sessions.length <= MAX_SESSIONS) return sessions;
  const pinned = sessions.filter((s) => s.is_pinned);
  const unpinned = sessions.filter((s) => !s.is_pinned).slice(-(MAX_SESSIONS - pinned.length));
  return [...pinned, ...unpinned];
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      messagesBySession: {},
      isLoading: false,
      isStreaming: false,
      error: null,
      networkMode: 'checking',
      pendingSyncCount: 0,
      isDataLoaded: false,

      // 图谱数据初始状态
      currentEntities: [],
      currentRelations: [],
      currentKeywords: [],

      initializeData: async () => {
        if (get().isDataLoaded) return;
        try {
          await dataInitializer.initialize();
          const sessions = await chatRepository.getAllSessions();
          set({
            sessions: pruneSessions(sessions),
            isDataLoaded: true,
          });
        } catch (e) {
          console.error('Failed to initialize data:', e);
          set({ isDataLoaded: true });
        }
      },

      loadSessionsFromDB: async () => {
        try {
          const sessions = await chatRepository.getAllSessions();
          set({ sessions: pruneSessions(sessions) });
        } catch (e) {
          console.error('Failed to load sessions from DB:', e);
        }
      },

      loadMessagesFromDB: async (sessionId: string) => {
        try {
          const messages = await chatRepository.getMessagesBySession(sessionId);
          set((state) => ({
            messagesBySession: {
              ...state.messagesBySession,
              [sessionId]: pruneMessages(messages),
            },
          }));
        } catch (e) {
          console.error('Failed to load messages from DB:', e);
        }
      },

      createSession: async (userId = 'default') => {
        const now = new Date().toISOString();
        const newSession: Session = {
          id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          user_id: userId,
          title: '新对话',
          created_at: now,
          updated_at: now,
          message_count: 0,
          is_pinned: false,
          is_archived: false,
        };

        await chatRepository.createSession(newSession);

        set((state) => {
          const newSessions = pruneSessions([newSession, ...state.sessions]);
          return {
            sessions: newSessions,
            currentSessionId: newSession.id,
            messagesBySession: {
              ...state.messagesBySession,
              [newSession.id]: [],
            },
          };
        });

        if (apiAdapterManager.shouldUseRemote()) {
          syncManager
            .addOperation('create_session', newSession as unknown as Record<string, unknown>)
            .catch((err) => {
              console.error('Failed to sync create_session:', err);
            });
        }

        return newSession;
      },

      deleteSession: async (id) => {
        await chatRepository.deleteSession(id);

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
            messagesBySession: newMessagesBySession,
          };
        });

        if (apiAdapterManager.shouldUseRemote()) {
          syncManager.addOperation('delete_session', { id }).catch((err) => {
            console.error('Failed to sync delete_session:', err);
          });
        }
      },

      deleteSessions: async (ids) => {
        await chatRepository.deleteSessions(ids);

        set((state) => {
          const idsSet = new Set(ids);
          const newSessions = state.sessions.filter((s) => !idsSet.has(s.id));
          const newMessagesBySession = { ...state.messagesBySession };

          ids.forEach((id) => delete newMessagesBySession[id]);

          const newCurrentId =
            state.currentSessionId && idsSet.has(state.currentSessionId)
              ? newSessions.length > 0
                ? newSessions[0].id
                : null
              : state.currentSessionId;

          return {
            sessions: newSessions,
            currentSessionId: newCurrentId,
            messagesBySession: newMessagesBySession,
          };
        });

        if (apiAdapterManager.shouldUseRemote()) {
          for (const id of ids) {
            syncManager.addOperation('delete_session', { id }).catch((err) => {
              console.error('Failed to sync delete_session:', err);
            });
          }
        }
      },

      switchSession: async (id) => {
        set({ currentSessionId: id });

        if (!get().messagesBySession[id]) {
          await get().loadMessagesFromDB(id);
        }
      },

      updateSessionTitle: async (id, title) => {
        await chatRepository.updateSession(id, { title });

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, title, updated_at: new Date().toISOString() } : s
          ),
        }));

        if (apiAdapterManager.shouldUseRemote()) {
          syncManager.addOperation('update_session', { id, title }).catch((err) => {
            console.error('Failed to sync update_session:', err);
          });
        }
      },

      pinSession: async (id) => {
        const session = get().sessions.find((s) => s.id === id);
        if (!session) return;

        const newPinned = !session.is_pinned;
        await chatRepository.updateSession(id, { is_pinned: newPinned });

        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, is_pinned: newPinned } : s)),
        }));

        if (apiAdapterManager.shouldUseRemote()) {
          syncManager.addOperation('update_session', { id, is_pinned: newPinned }).catch((err) => {
            console.error('Failed to sync update_session:', err);
          });
        }
      },

      archiveSession: async (id) => {
        const session = get().sessions.find((s) => s.id === id);
        if (!session) return;

        const newArchived = !session.is_archived;
        await chatRepository.updateSession(id, { is_archived: newArchived });

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, is_archived: newArchived } : s
          ),
        }));

        if (apiAdapterManager.shouldUseRemote()) {
          syncManager
            .addOperation('update_session', { id, is_archived: newArchived })
            .catch((err) => {
              console.error('Failed to sync update_session:', err);
            });
        }
      },

      addTagToSession: async (id, tag) => {
        await chatRepository.addTagToSession(id, tag);

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id
              ? { ...s, tags: [...(s.tags || []), tag], updated_at: new Date().toISOString() }
              : s
          ),
        }));

        if (apiAdapterManager.shouldUseRemote()) {
          syncManager
            .addOperation('update_session', {
              id,
              tags: get().sessions.find((s) => s.id === id)?.tags,
            })
            .catch((err) => {
              console.error('Failed to sync update_session:', err);
            });
        }
      },

      removeTagFromSession: async (id, tag) => {
        await chatRepository.removeTagFromSession(id, tag);

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id
              ? {
                  ...s,
                  tags: (s.tags || []).filter((t) => t !== tag),
                  updated_at: new Date().toISOString(),
                }
              : s
          ),
        }));

        if (apiAdapterManager.shouldUseRemote()) {
          syncManager
            .addOperation('update_session', {
              id,
              tags: get().sessions.find((s) => s.id === id)?.tags,
            })
            .catch((err) => {
              console.error('Failed to sync update_session:', err);
            });
        }
      },

      addMessage: async (message) => {
        await chatRepository.saveMessage(message);

        if (apiAdapterManager.shouldUseRemote()) {
          syncManager
            .addOperation('create_message', message as unknown as Record<string, unknown>)
            .catch((err) => {
              console.error('Failed to sync create_message:', err);
            });
        }

        set((state) => {
          const sessionId = message.session_id;
          const currentMessages = state.messagesBySession[sessionId] || [];
          const newMessages = pruneMessages([...currentMessages, message]);

          const session = state.sessions.find((s) => s.id === sessionId);
          let titleUpdate: Partial<Session> = {};

          if (session && session.title === '新对话' && message.role === 'user') {
            const newTitle =
              message.content.slice(0, 20) + (message.content.length > 20 ? '...' : '');
            titleUpdate = { title: newTitle };
            chatRepository.updateSession(sessionId, { title: newTitle }).catch(() => {});

            if (apiAdapterManager.shouldUseRemote()) {
              syncManager
                .addOperation('update_session', { id: sessionId, title: newTitle })
                .catch((err) => {
                  console.error('Failed to sync update_session:', err);
                });
            }
          }

          return {
            messagesBySession: {
              ...state.messagesBySession,
              [sessionId]: newMessages,
            },
            sessions: state.sessions.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    ...titleUpdate,
                    message_count: newMessages.length,
                    updated_at: new Date().toISOString(),
                  }
                : s
            ),
          };
        });
      },

      updateMessage: async (id, updates) => {
        const existingMessage = await chatRepository.getMessage(id);

        if (!existingMessage) {
          console.error(`Message with id ${id} not found in repository`);
          return;
        }

        await chatRepository.updateMessage(id, updates);

        if (apiAdapterManager.shouldUseRemote()) {
          syncManager.addOperation('update_message', { id, ...updates }).catch((err) => {
            console.error('Failed to sync update_message:', err);
          });
        }

        set((state) => {
          // 查找消息所属的会话
          let targetSessionId: string | null = null;
          for (const [sessionId, msgs] of Object.entries(state.messagesBySession)) {
            if (msgs.some((m) => m.id === id)) {
              targetSessionId = sessionId;
              break;
            }
          }

          // 如果没找到，尝试使用 currentSessionId
          if (!targetSessionId) {
            targetSessionId = state.currentSessionId;
          }

          if (!targetSessionId) {
            console.warn(`Could not find session for message ${id}`);
            return state;
          }

          const sessionMessages = state.messagesBySession[targetSessionId] || [];
          const messageExists = sessionMessages.some((m) => m.id === id);

          if (!messageExists) {
            console.warn(`Message ${id} not found in local state`);
            return state;
          }

          const updatedMessages = sessionMessages.map((m) => {
            if (m.id === id) {
              const updated = { ...m, ...updates };
              if (updated.versions) {
                updated.versions = pruneVersions(updated.versions);
              }
              return updated;
            }
            return m;
          });

          return {
            messagesBySession: {
              ...state.messagesBySession,
              [targetSessionId]: updatedMessages,
            },
          };
        });
      },

      deleteMessage: async (id) => {
        // 先获取消息信息以确定所属会话
        const message = await chatRepository.getMessage(id);

        if (!message) {
          console.error(`Message with id ${id} not found`);
          return;
        }

        const sessionId = message.session_id;

        await chatRepository.deleteMessage(id);

        if (apiAdapterManager.shouldUseRemote()) {
          syncManager.addOperation('delete_message', { id }).catch((err) => {
            console.error('Failed to sync delete_message:', err);
          });
        }

        set((state) => {
          // 使用消息所属的会话 ID，如果没有则使用当前会话
          const targetSessionId = sessionId || state.currentSessionId;
          if (!targetSessionId) return state;

          const sessionMessages = state.messagesBySession[targetSessionId] || [];
          const messageExists = sessionMessages.some((m) => m.id === id);

          if (!messageExists) {
            console.warn(`Message ${id} not found in local state, skipping state update`);
            return state;
          }

          const filteredMessages = sessionMessages.filter((m) => m.id !== id);

          return {
            messagesBySession: {
              ...state.messagesBySession,
              [targetSessionId]: filteredMessages,
            },
            sessions: state.sessions.map((s) =>
              s.id === targetSessionId ? { ...s, message_count: filteredMessages.length } : s
            ),
          };
        });
      },

      clearMessages: () => {
        set({ messagesBySession: {} });
      },

      clearCurrentSessionMessages: () => {
        set((state) => {
          const currentSessionId = state.currentSessionId;
          if (!currentSessionId) return state;

          return {
            messagesBySession: {
              ...state.messagesBySession,
              [currentSessionId]: [],
            },
            sessions: state.sessions.map((s) =>
              s.id === currentSessionId ? { ...s, message_count: 0 } : s
            ),
          };
        });
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
        if (typeof sessions === 'function') {
          set((state) => ({ sessions: pruneSessions(sessions(state.sessions)) }));
        } else {
          set({ sessions: pruneSessions(sessions) });
        }
      },

      setMessages: (messages) => {
        const currentSessionId = get().currentSessionId;
        if (!currentSessionId) return;

        set((state) => ({
          messagesBySession: {
            ...state.messagesBySession,
            [currentSessionId]: pruneMessages(messages),
          },
        }));
      },

      setMessagesForSession: (sessionId, messages) => {
        set((state) => ({
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: pruneMessages(messages),
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

      getCurrentMessages: () => {
        const state = get();
        if (!state.currentSessionId) return [];
        return state.messagesBySession[state.currentSessionId] || [];
      },

      clearError: () => set({ error: null }),

      searchSessions: (query: string) => {
        const state = get();
        const lowerQuery = query.toLowerCase();
        return state.sessions.filter((s) => s.title.toLowerCase().includes(lowerQuery));
      },

      batchDeleteSessions: async (ids: string[]) => {
        await chatRepository.deleteSessions(ids);

        set((state) => ({
          sessions: state.sessions.filter((s) => !ids.includes(s.id)),
          currentSessionId: ids.includes(state.currentSessionId || '')
            ? null
            : state.currentSessionId,
        }));

        if (apiAdapterManager.shouldUseRemote()) {
          for (const id of ids) {
            syncManager.addOperation('delete_session', { id }).catch((err) => {
              console.error('Failed to sync delete_session:', err);
            });
          }
        }
      },

      batchArchiveSessions: async (ids: string[], archive: boolean) => {
        for (const id of ids) {
          await chatRepository.updateSession(id, { is_archived: archive });
        }

        set((state) => ({
          sessions: state.sessions.map((s) =>
            ids.includes(s.id) ? { ...s, is_archived: archive } : s
          ),
        }));

        if (apiAdapterManager.shouldUseRemote()) {
          for (const id of ids) {
            syncManager
              .addOperation('update_session', { id, is_archived: archive })
              .catch((err) => {
                console.error('Failed to sync update_session:', err);
              });
          }
        }
      },

      addMessageVersion: (messageId: string, content: string, versionGroupId?: string) => {
        set((state) => {
          // 查找消息所属的会话
          let targetSessionId: string | null = null;
          for (const [sessionId, msgs] of Object.entries(state.messagesBySession)) {
            if (msgs.some((m) => m.id === messageId)) {
              targetSessionId = sessionId;
              break;
            }
          }

          if (!targetSessionId) {
            targetSessionId = state.currentSessionId;
          }

          if (!targetSessionId) return state;

          const sessionMessages = state.messagesBySession[targetSessionId] || [];
          const message = sessionMessages.find((m) => m.id === messageId);

          // 验证：如果内容相同，不创建新版本
          if (message && message.content === content.trim()) {
            console.warn('版本内容未变化，跳过创建新版本');
            return state;
          }

          // 验证：检查是否与上一个版本内容相同
          const lastVersion = message?.versions?.[message.versions.length - 1];
          if (lastVersion && lastVersion.content === content.trim()) {
            console.warn('版本内容与上一版本相同，跳过创建');
            return state;
          }

          const newVersion: MessageVersion = {
            id: `version_${Date.now()}`,
            content: content.trim(),
            created_at: new Date().toISOString(),
            is_current: true,
          };

          // 生成或使用现有的版本组 ID
          const newVersionGroupId =
            versionGroupId || message?.version_group_id || `vg_${Date.now()}`;

          const updatedMessages = sessionMessages.map((m) => {
            if (m.id === messageId) {
              const versions = pruneVersions([
                ...(m.versions || []).map((v) => ({ ...v, is_current: false })),
                newVersion,
              ]);
              return {
                ...m,
                versions,
                content,
                is_edited: true,
                version_group_id: newVersionGroupId,
              };
            }
            return m;
          });

          const updatedMessage = updatedMessages.find((m) => m.id === messageId);
          if (updatedMessage) {
            chatRepository
              .updateMessage(messageId, {
                content,
                versions: updatedMessage.versions,
                is_edited: true,
                version_group_id: newVersionGroupId,
              })
              .catch((err) => {
                console.error('Failed to update message version:', err);
              });

            if (apiAdapterManager.shouldUseRemote()) {
              syncManager
                .addOperation('update_message', {
                  id: messageId,
                  content,
                  versions: updatedMessage.versions,
                  is_edited: true,
                  version_group_id: newVersionGroupId,
                })
                .catch((err) => {
                  console.error('Failed to sync message version:', err);
                });
            }
          }

          return {
            messagesBySession: {
              ...state.messagesBySession,
              [targetSessionId]: updatedMessages,
            },
          };
        });
      },

      switchMessageVersion: (messageId, versionId) => {
        set((state) => {
          // 查找消息所属的会话
          let targetSessionId: string | null = null;
          for (const [sessionId, msgs] of Object.entries(state.messagesBySession)) {
            if (msgs.some((m) => m.id === messageId)) {
              targetSessionId = sessionId;
              break;
            }
          }

          if (!targetSessionId) {
            targetSessionId = state.currentSessionId;
          }

          if (!targetSessionId) return state;

          const sessionMessages = state.messagesBySession[targetSessionId] || [];
          const updatedMessages = sessionMessages.map((m) => {
            if (m.id === messageId && m.versions) {
              const updatedVersions = m.versions.map((v) => ({
                ...v,
                is_current: v.id === versionId,
              }));
              const currentVersion = updatedVersions.find((v) => v.is_current);
              return {
                ...m,
                versions: updatedVersions,
                content: currentVersion?.content || m.content,
              };
            }
            return m;
          });

          const updatedMessage = updatedMessages.find((m) => m.id === messageId);
          if (updatedMessage) {
            // 同时更新本地存储和远程（如果有）
            chatRepository
              .updateMessage(messageId, {
                content: updatedMessage.content,
                versions: updatedMessage.versions,
              })
              .catch((err) => {
                console.error('Failed to switch message version:', err);
              });

            if (apiAdapterManager.shouldUseRemote()) {
              syncManager
                .addOperation('update_message', {
                  id: messageId,
                  content: updatedMessage.content,
                  versions: updatedMessage.versions,
                })
                .catch((err) => {
                  console.error('Failed to sync message version switch:', err);
                });
            }
          }

          return {
            messagesBySession: {
              ...state.messagesBySession,
              [targetSessionId]: updatedMessages,
            },
          };
        });
      },

      editAndRegenerate: (messageId, newContent) => {
        const state = get();

        // 查找消息所属的会话
        let targetSessionId: string | null = null;
        for (const [sessionId, msgs] of Object.entries(state.messagesBySession)) {
          if (msgs.some((m) => m.id === messageId)) {
            targetSessionId = sessionId;
            break;
          }
        }

        if (!targetSessionId) {
          targetSessionId = state.currentSessionId;
        }

        if (!targetSessionId) return;

        const sessionMessages = state.messagesBySession[targetSessionId] || [];
        const messageIndex = sessionMessages.findIndex((m) => m.id === messageId);

        if (messageIndex === -1) return;

        const message = sessionMessages[messageIndex];
        if (message.role !== 'user') return;

        const versionGroupId = message.version_group_id || `vg_${Date.now()}`;

        // 直接在 set 中更新状态，避免 race condition
        set((currentState) => {
          const currentMessages = currentState.messagesBySession[targetSessionId!] || [];
          const targetMessage = currentMessages.find((m) => m.id === messageId);

          if (!targetMessage) return currentState;

          // 验证：如果内容相同，不创建新版本
          if (targetMessage.content === newContent.trim()) {
            console.warn('版本内容未变化，跳过创建新版本');
            return currentState;
          }

          // 验证：检查是否与上一个版本内容相同
          const lastVersion = targetMessage.versions?.[targetMessage.versions.length - 1];
          if (lastVersion && lastVersion.content === newContent.trim()) {
            console.warn('版本内容与上一版本相同，跳过创建');
            return currentState;
          }

          const newVersion: MessageVersion = {
            id: `version_${Date.now()}`,
            content: newContent.trim(),
            created_at: new Date().toISOString(),
            is_current: true,
          };

          const updatedMessages = currentMessages.map((m) => {
            if (m.id === messageId) {
              const versions = pruneVersions([
                ...(m.versions || []).map((v) => ({ ...v, is_current: false })),
                newVersion,
              ]);
              return {
                ...m,
                versions,
                content: newContent,
                is_edited: true,
                version_group_id: versionGroupId,
              };
            }
            return m;
          });

          const updatedMessage = updatedMessages.find((m) => m.id === messageId);
          if (updatedMessage) {
            chatRepository
              .updateMessage(messageId, {
                content: newContent,
                versions: updatedMessage.versions,
                is_edited: true,
                version_group_id: versionGroupId,
              })
              .catch((err) => {
                console.error('Failed to update message version:', err);
              });

            if (apiAdapterManager.shouldUseRemote()) {
              syncManager
                .addOperation('update_message', {
                  id: messageId,
                  content: newContent,
                  versions: updatedMessage.versions,
                  is_edited: true,
                  version_group_id: versionGroupId,
                })
                .catch((err) => {
                  console.error('Failed to sync message version:', err);
                });
            }
          }

          return {
            messagesBySession: {
              ...currentState.messagesBySession,
              [targetSessionId!]: updatedMessages,
            },
          };
        });
      },

      syncVersionForGroup: (versionGroupId, versionIndex) => {
        set((state) => {
          // 查找包含该 version_group_id 的会话
          let targetSessionId: string | null = null;
          for (const [sessionId, msgs] of Object.entries(state.messagesBySession)) {
            if (msgs.some((m) => m.version_group_id === versionGroupId)) {
              targetSessionId = sessionId;
              break;
            }
          }

          if (!targetSessionId) {
            targetSessionId = state.currentSessionId;
          }

          if (!targetSessionId) return state;

          const sessionMessages = state.messagesBySession[targetSessionId] || [];
          const updatedMessages = sessionMessages.map((m) => {
            if (
              m.version_group_id === versionGroupId &&
              m.versions &&
              m.versions.length > versionIndex
            ) {
              const updatedVersions = m.versions.map((v, idx) => ({
                ...v,
                is_current: idx === versionIndex,
              }));
              const currentVersion = updatedVersions[versionIndex];
              return {
                ...m,
                versions: updatedVersions,
                content: currentVersion?.content || m.content,
              };
            }
            return m;
          });

          // 同步更新到本地存储和远程
          const updatedMessagesInGroup = updatedMessages.filter(
            (m) => m.version_group_id === versionGroupId
          );
          updatedMessagesInGroup.forEach((message) => {
            chatRepository
              .updateMessage(message.id, {
                content: message.content,
                versions: message.versions,
              })
              .catch((err) => {
                console.error('Failed to sync version for group:', err);
              });

            if (apiAdapterManager.shouldUseRemote()) {
              syncManager
                .addOperation('update_message', {
                  id: message.id,
                  content: message.content,
                  versions: message.versions,
                })
                .catch((err) => {
                  console.error('Failed to sync version for group to remote:', err);
                });
            }
          });

          return {
            messagesBySession: {
              ...state.messagesBySession,
              [targetSessionId]: updatedMessages,
            },
          };
        });
      },

      cleanupOldData: () => {
        set((state) => {
          const now = Date.now();
          const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

          const activeSessions = state.sessions.filter(
            (s) => s.is_pinned || new Date(s.updated_at).getTime() > thirtyDaysAgo
          );

          const activeSessionIds = new Set(activeSessions.map((s) => s.id));
          const cleanedMessagesBySession: Record<string, Message[]> = {};

          Object.entries(state.messagesBySession).forEach(([sessionId, messages]) => {
            if (activeSessionIds.has(sessionId)) {
              cleanedMessagesBySession[sessionId] = pruneMessages(messages);
            }
          });

          return {
            sessions: pruneSessions(activeSessions),
            messagesBySession: cleanedMessagesBySession,
          };
        });
      },

      getStorageStats: () => {
        const state = get();
        let totalMessages = 0;
        let oldestDate: string | null = null;

        Object.values(state.messagesBySession).forEach((messages) => {
          totalMessages += messages.length;
          if (messages.length > 0) {
            const firstMsgDate = messages[0].created_at;
            if (!oldestDate || firstMsgDate < oldestDate) {
              oldestDate = firstMsgDate;
            }
          }
        });

        return {
          sessionsCount: state.sessions.length,
          totalMessages,
          oldestSession:
            state.sessions.length > 0
              ? state.sessions.reduce((oldest, s) =>
                  s.created_at < oldest.created_at ? s : oldest
                ).id
              : null,
        };
      },

      // 图谱数据管理方法
      setCurrentEntities: (entities) => {
        set({ currentEntities: entities });
      },

      setCurrentRelations: (relations) => {
        set({ currentRelations: relations });
      },

      setCurrentKeywords: (keywords) => {
        set({ currentKeywords: keywords });
      },

      updateGraphData: (entities, relations, keywords) => {
        const updates: Partial<ChatState> = {};
        if (entities) updates.currentEntities = entities;
        if (relations) updates.currentRelations = relations;
        if (keywords) updates.currentKeywords = keywords;
        if (Object.keys(updates).length > 0) {
          set(updates);
        }
      },

      clearGraphData: () => {
        set({ currentEntities: [], currentRelations: [], currentKeywords: [] });
      },

      // 消息批量操作方法
      batchDeleteMessages: async (messageIds: string[]) => {
        const messagesToDelete: { id: string; sessionId: string }[] = [];

        for (const id of messageIds) {
          const message = await chatRepository.getMessage(id);
          if (message) {
            messagesToDelete.push({ id, sessionId: message.session_id });
          }
        }

        for (const { id } of messagesToDelete) {
          await chatRepository.deleteMessage(id);
        }

        set((state) => {
          const newMessagesBySession = { ...state.messagesBySession };
          const sessionUpdates: Record<string, number> = {};

          for (const { id, sessionId } of messagesToDelete) {
            if (!newMessagesBySession[sessionId]) continue;

            newMessagesBySession[sessionId] = newMessagesBySession[sessionId].filter(
              (m) => m.id !== id
            );
            sessionUpdates[sessionId] = (sessionUpdates[sessionId] || 0) + 1;
          }

          return {
            messagesBySession: newMessagesBySession,
            sessions: state.sessions.map((s) =>
              sessionUpdates[s.id]
                ? { ...s, message_count: s.message_count - sessionUpdates[s.id] }
                : s
            ),
          };
        });

        if (apiAdapterManager.shouldUseRemote()) {
          for (const { id } of messagesToDelete) {
            syncManager.addOperation('delete_message', { id }).catch((err) => {
              console.error('Failed to sync delete_message:', err);
            });
          }
        }
      },

      batchFavoriteMessages: async (messageIds: string[], favorite: boolean) => {
        for (const id of messageIds) {
          await chatRepository.updateMessage(id, { is_favorite: favorite });
        }

        set((state) => {
          const newMessagesBySession = { ...state.messagesBySession };

          Object.keys(newMessagesBySession).forEach((sessionId) => {
            newMessagesBySession[sessionId] = newMessagesBySession[sessionId].map((m) =>
              messageIds.includes(m.id) ? { ...m, is_favorite: favorite } : m
            );
          });

          return { messagesBySession: newMessagesBySession };
        });

        if (apiAdapterManager.shouldUseRemote()) {
          for (const id of messageIds) {
            syncManager
              .addOperation('update_message', { id, is_favorite: favorite })
              .catch((err) => {
                console.error('Failed to sync update_message:', err);
              });
          }
        }
      },

      batchExportMessages: async (messageIds: string[], format: 'json' | 'txt' | 'md') => {
        const messages: Message[] = [];

        for (const id of messageIds) {
          const message = await chatRepository.getMessage(id);
          if (message) {
            messages.push(message);
          }
        }

        let content = '';
        let filename = '';
        let mimeType = '';

        switch (format) {
          case 'json':
            content = JSON.stringify(messages, null, 2);
            filename = 'messages.json';
            mimeType = 'application/json';
            break;
          case 'txt':
            content = messages
              .map((m) => `[${m.role.toUpperCase()}] ${m.created_at}\n${m.content}\n`)
              .join('\n---\n\n');
            filename = 'messages.txt';
            mimeType = 'text/plain';
            break;
          case 'md':
            content = messages
              .map(
                (m) => `### ${m.role === 'user' ? '用户' : 'AI'} (${m.created_at})\n\n${m.content}`
              )
              .join('\n\n---\n\n');
            filename = 'messages.md';
            mimeType = 'text/markdown';
            break;
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        return { success: true, count: messages.length };
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
        messagesBySession: state.messagesBySession,
      }),
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          if (state.messages && !state.messagesBySession) {
            const sessionId = state.currentSessionId as string | undefined;
            if (sessionId) {
              state.messagesBySession = {
                [sessionId]: state.messages,
              };
            }
            delete state.messages;
          }
        }
        if (version < 3) {
          const messagesBySession = state.messagesBySession as
            | Record<string, Message[]>
            | undefined;
          if (messagesBySession) {
            Object.keys(messagesBySession).forEach((sessionId) => {
              messagesBySession[sessionId] = messagesBySession[sessionId].map((msg) => ({
                ...msg,
                is_favorite: msg.is_favorite || false,
                version_group_id: msg.version_group_id || undefined,
                is_edited: msg.is_edited || false,
              }));
            });
          }
        }
        return persistedState as ChatState;
      },
    }
  )
);

networkStatusService.subscribe((status) => {
  useChatStore.getState().setNetworkMode(status.mode);
});

apiAdapterManager.subscribe((online) => {
  if (online) {
    useChatStore.getState().loadSessionsFromDB();
  }
});

if (typeof window !== 'undefined') {
  const cleanupInterval = 24 * 60 * 60 * 1000;
  setInterval(() => {
    useChatStore.getState().cleanupOldData();
  }, cleanupInterval);

  dataInitializer.initialize().then(() => {
    useChatStore.getState().initializeData();
  });
}
