import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore, pruneVersions } from '../../stores/chatStore';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import { chatDataService } from '../../services/chat';
import { graphSyncService } from '../../services/graphSyncService';
import { useToast } from '../../components/common/Toast';
import type {
  Entity,
  Source,
  Message,
  Relation,
  GraphSnapshot,
  MessageVersion,
} from '../../types/chat';

import Sidebar from '../../components/chat/Sidebar';
import RightPanel from '../../components/chat/RightPanel';
import UnifiedInputArea from '../../components/chat/UnifiedInputArea';
import UnifiedMessageBubble from '../../components/chat/UnifiedMessageBubble';
import ChatToolbar from '../../components/chat/ChatToolbar';
import CommandPalette from '../../components/chat/CommandPalette';
import WelcomeScreen from '../../components/chat/WelcomeScreen';
import MessageSearch from '../../components/chat/MessageSearch';
import SessionSettings from '../../components/chat/SessionSettings';
import KeyboardShortcuts from '../../components/chat/KeyboardShortcuts';
import { TypingIndicator } from '../../components/chat/TypingIndicator';
import { MessageQuote } from '../../components/chat/MessageQuote';
import { useThemeStore } from '../../stores/themeStore';

export default function EnhancedChatPage() {
  const { sessionId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<(() => void) | null>(null);
  const [currentKeywords, setCurrentKeywords] = useState<string[]>([]);
  const [currentEntities, setCurrentEntities] = useState<Entity[]>([]);
  const [currentRelations, setCurrentRelations] = useState<Relation[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState(new Set<string>());
  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showSessionSettings, setShowSessionSettings] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const toast = useToast();

  const {
    sessions,
    currentSessionId,
    messagesBySession,
    isLoading,
    isStreaming,
    switchSession,
    addMessage,
    updateMessage,
    deleteMessage,
    setLoading,
    setStreaming,
    setError,
    pinSession,
    updateSessionTitle,
    deleteSession,
    createSession,
    addMessageVersion,
    switchMessageVersion,
    editAndRegenerate,
    archiveSession,
    addTagToSession,
    removeTagFromSession,
  } = useChatStore();

  const messages = useMemo(
    () => (currentSessionId ? messagesBySession[currentSessionId] || [] : []),
    [currentSessionId, messagesBySession]
  );

  const { toggleSidebar } = useUIStore();
  const { toggleMode } = useThemeStore();

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowMessageSearch(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        toggleMode();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowMessageSearch(false);
        setShowSessionSettings(false);
        setShowKeyboardShortcuts(false);
        setQuotedMessage(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleMode, toggleSidebar]);

  useEffect(() => {
    const initChat = async () => {
      try {
        // 使用 Store 的 initializeData 方法，统一管理初始化流程
        const {
          initializeData,
          createSession,
          switchSession: switchSess,
        } = useChatStore.getState();

        await initializeData();

        // 在 initializeData 完成后重新获取最新的 sessions
        const fetchedSessions = useChatStore.getState().sessions;

        let targetSessionId = sessionId;

        if (!targetSessionId && fetchedSessions.length > 0) {
          targetSessionId = fetchedSessions[0].id;
        } else if (!targetSessionId) {
          const newSession = await createSession();
          targetSessionId = newSession.id;
        }

        if (targetSessionId && fetchedSessions.some((s) => s.id === targetSessionId)) {
          await switchSess(targetSessionId);

          // 恢复该会话的图谱快照（如果存在）
          try {
            const savedGraphState = sessionStorage.getItem(`graphState_${targetSessionId}`);
            if (savedGraphState) {
              const { entities, relations, keywords, filters } = JSON.parse(savedGraphState);

              if (entities && entities.length > 0) {
                setCurrentEntities(entities);
                if (keywords) setCurrentKeywords(keywords);
                if (relations) setCurrentRelations(relations);

                // 触发全局事件通知其他组件
                const event = new CustomEvent('restoreGraphState', {
                  detail: {
                    entities,
                    relations,
                    keywords,
                    filters,
                  },
                });
                window.dispatchEvent(event);

                console.log('Restored graph state from sessionStorage');
              }
            }
          } catch (error) {
            console.warn('Failed to restore graph state:', error);
          }
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        setIsInitialized(true);
      }
    };

    initChat();
  }, [sessionId]);

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // 当消息变化时，自动更新图谱数据（显示最新消息的图谱）
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && lastMessage.entities) {
        setCurrentEntities(lastMessage.entities);
        if (lastMessage.keywords) setCurrentKeywords(lastMessage.keywords);
        if (lastMessage.relations) setCurrentRelations(lastMessage.relations);
      }
    }
  }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setAutoScroll(isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCreateSession = useCallback(async () => {
    try {
      const newSession = await createSession();
      return newSession;
    } catch (error) {
      console.error('Failed to create session:', error);
      toast.error('创建失败', '无法创建新对话');
      return null;
    }
  }, [createSession, toast]);

  // ========== 辅助函数：确保活跃会话 ==========
  const ensureActiveSession = useCallback(async (): Promise<string> => {
    let activeSessionId = currentSessionId;

    if (!activeSessionId) {
      if (sessions.length > 0 && sessions[0]?.id) {
        activeSessionId = sessions[0].id;
        await switchSession(activeSessionId);
      } else {
        const newSession = await handleCreateSession();
        if (!newSession || !newSession.id) {
          throw new Error('无法创建新会话');
        }
        activeSessionId = newSession.id;
      }
    }

    return activeSessionId;
  }, [currentSessionId, sessions, switchSession, handleCreateSession]);

  // ========== 辅助函数：构建用户消息 ==========
  const buildUserMessage = useCallback(
    (sessionId: string, content: string): Message => {
      const messageContent = quotedMessage ? `> ${quotedMessage.content}\n\n${content}` : content;

      // 创建初始版本（V1）
      const initialVersion: MessageVersion = {
        id: `version_${Date.now()}`,
        content: messageContent,
        created_at: new Date().toISOString(),
        is_current: true,
      };

      return {
        id: `msg_${Date.now()}_user`,
        session_id: sessionId,
        role: 'user',
        content: messageContent,
        created_at: new Date().toISOString(),
        parent_message_id: quotedMessage?.id,
        versions: [initialVersion],
      };
    },
    [quotedMessage]
  );

  // ========== 辅助函数：创建流式消息 ==========
  const createStreamingMessage = useCallback(
    (sessionId: string): Message => ({
      id: `msg_${Date.now()}_assistant_streaming`,
      session_id: sessionId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      isStreaming: true,
    }),
    []
  );

  // ========== 辅助函数：更新图谱数据 ==========
  const updateGraphData = useCallback(
    (entities?: Entity[], keywords?: string[], sources?: Source[], relations?: Relation[]) => {
      if (entities) setCurrentEntities(entities);
      if (keywords) setCurrentKeywords(keywords);
      if (relations) setCurrentRelations(relations);

      // 同时更新 chatStore 中的图谱数据
      useChatStore.getState().updateGraphData(entities, relations, keywords);

      // 使用 graphSyncService 更新图谱数据，确保知识图谱板块也能收到数据
      if (entities && entities.length > 0) {
        graphSyncService.updateFromChat(
          entities,
          relations || [],
          keywords || [],
          sessionId,
          undefined
        );
      }

      console.debug('Graph data updated:', { entities, keywords, sources, relations });
    },
    [sessionId]
  );

  // ========== 辅助函数：加载快照 ==========
  const handleLoadSnapshot = useCallback(
    (snapshot: GraphSnapshot) => {
      // 更新所有图谱数据
      if (snapshot.entities && snapshot.entities.length > 0) {
        setCurrentEntities(snapshot.entities);
      }
      if (snapshot.keywords && snapshot.keywords.length > 0) {
        setCurrentKeywords(snapshot.keywords);
      }
      if (snapshot.relations && snapshot.relations.length > 0) {
        setCurrentRelations(snapshot.relations);
      }

      // 更新统一的 graphStore
      useGraphStore
        .getState()
        .updateGraphData(
          snapshot.entities,
          snapshot.relations,
          snapshot.keywords,
          snapshot.session_id,
          snapshot.message_id,
          'snapshot'
        );

      // 通过全局事件通知其他组件（如知识图谱）
      const event = new CustomEvent('loadSnapshot', {
        detail: {
          entities: snapshot.entities,
          relations: snapshot.relations,
          keywords: snapshot.keywords,
        },
      });
      window.dispatchEvent(event);

      toast.success('快照已加载', '请在图谱标签页查看');
    },
    [toast]
  );

  // ========== 核心函数：流式响应处理 ==========
  const startStreamingResponse = useCallback(
    async (sessionId: string, userContent: string, streamingMsgId: string) => {
      setLoading(true);
      setStreaming(true);
      setStreamingContent('');

      await updateMessage(streamingMsgId, { isStreaming: true });

      let accumulatedContent = '';

      const abort = await chatDataService.sendMessageStream(
        sessionId,
        userContent,
        (chunk) => {
          accumulatedContent += chunk;
          setStreamingContent(accumulatedContent);
          updateMessage(streamingMsgId, {
            content: accumulatedContent,
            isStreaming: true,
          });
        },
        async (aiMessage) => {
          setStreamingContent('');

          // 获取当前消息，检查是否已有版本
          const currentMsg = useChatStore
            .getState()
            .messagesBySession[sessionId]?.find((m) => m.id === streamingMsgId);
          const existingVersions = currentMsg?.versions || [];

          // 创建版本
          let versions = existingVersions;
          if (aiMessage.content && aiMessage.content.trim()) {
            if (existingVersions.length === 0) {
              // 没有版本，创建初始版本（V1）
              const initialVersion: MessageVersion = {
                id: `version_${Date.now()}`,
                content: aiMessage.content,
                created_at: new Date().toISOString(),
                is_current: true,
              };
              versions = [initialVersion];
            } else {
              // 有版本（重新生成），创建新版本
              const newVersion: MessageVersion = {
                id: `version_${Date.now()}`,
                content: aiMessage.content,
                created_at: new Date().toISOString(),
                is_current: true,
              };
              // 将所有旧版本标记为 is_current: false，并添加新版本
              versions = pruneVersions([
                ...existingVersions.map((v) => ({ ...v, is_current: false })),
                newVersion,
              ]);
            }
          }

          await updateMessage(streamingMsgId, {
            content: aiMessage.content,
            sources: aiMessage.sources,
            entities: aiMessage.entities,
            keywords: aiMessage.keywords,
            relations: aiMessage.relations,
            versions,
            isStreaming: false,
          });
          setNewMessageIds((prev) => new Set([...prev, streamingMsgId]));

          // 更新图谱数据
          updateGraphData(
            aiMessage.entities,
            aiMessage.keywords,
            aiMessage.sources,
            aiMessage.relations
          );

          setLoading(false);
          setStreaming(false);
        },
        async (error) => {
          setStreamingContent('');
          setLoading(false);
          setStreaming(false);

          await updateMessage(streamingMsgId, {
            content: '抱歉，生成回复时出现错误。请重试。',
            isStreaming: false,
          });
          toast.error('发送失败', error.message || 'AI 回复生成失败');
        }
      );

      return abort;
    },
    [
      updateMessage,
      setLoading,
      setStreaming,
      setStreamingContent,
      setNewMessageIds,
      updateGraphData,
      toast,
    ]
  );

  // ========== 主函数：发送消息 ==========
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content || !content.trim()) {
        console.warn('Empty message content');
        return;
      }

      try {
        // 1. 确保有活跃会话
        const activeSessionId = await ensureActiveSession();

        // 2. 构建并发送用户消息
        const userMessage = buildUserMessage(activeSessionId, content);
        await addMessage(userMessage);
        setNewMessageIds((prev) => new Set([...prev, userMessage.id]));
        setQuotedMessage(null);

        // 3. 创建流式消息
        const streamingMsgId = createStreamingMessage(activeSessionId).id!;
        const streamingMessage = { ...createStreamingMessage(activeSessionId), id: streamingMsgId };
        await addMessage(streamingMessage);

        // 4. 启动流式响应
        const abort = await startStreamingResponse(activeSessionId, content, streamingMsgId);
        abortControllerRef.current = abort;
      } catch (error) {
        console.error('Error in handleSendMessage:', error);
        setLoading(false);
        setStreaming(false);
        toast.error('发送失败', error instanceof Error ? error.message : '发送消息时发生错误');
        throw error;
      }
    },
    [
      ensureActiveSession,
      buildUserMessage,
      createStreamingMessage,
      addMessage,
      startStreamingResponse,
      toast,
      setLoading,
      setStreaming,
    ]
  );

  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current();
      abortControllerRef.current = null;
    }
    setStreamingContent('');
    setStreaming(false);
    setLoading(false);
    toast.info('已停止', '已停止生成回复');
  }, [setStreaming, setLoading, toast]);

  const handleFeedback = useCallback(
    async (messageId: string, feedback: 'helpful' | 'unclear') => {
      try {
        await updateMessage(messageId, { feedback });
        toast.success('感谢反馈', '您的反馈将帮助我们改进');
      } catch (error) {
        console.error('Failed to submit feedback:', error);
        toast.error('反馈失败', '无法提交反馈');
      }
    },
    [updateMessage, toast]
  );

  const handleFavorite = useCallback(
    async (messageId: string, currentStatus: boolean) => {
      try {
        const newStatus = !currentStatus;
        await updateMessage(messageId, { is_favorite: newStatus });
        toast.success(newStatus ? '已收藏' : '已取消收藏');
        window.dispatchEvent(new CustomEvent('favoriteChanged'));
      } catch (error) {
        console.error('Failed to toggle favorite:', error);
        toast.error('操作失败', '无法更新收藏状态');
      }
    },
    [updateMessage, toast]
  );

  const handleCopy = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_content: string) => {
      toast.success('已复制', '内容已复制到剪贴板');
    },
    [toast]
  );

  const handleRegenerate = useCallback(
    async (messageId: string) => {
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex > 0 && currentSessionId) {
        const userMessage = messages[messageIndex - 1];
        if (userMessage.role === 'user') {
          const aiMessage = messages[messageIndex];

          // 将所有现有版本的 is_current 设置为 false，准备接收新版本
          const existingVersions = aiMessage.versions || [];
          const versions = existingVersions.map((v) => ({ ...v, is_current: false }));

          await updateMessage(aiMessage.id, {
            content: '',
            sources: [],
            entities: [],
            keywords: [],
            versions,
            isStreaming: true,
          });

          const abort = await startStreamingResponse(
            currentSessionId,
            userMessage.content,
            aiMessage.id
          );
          abortControllerRef.current = abort;
        }
      }
    },
    [messages, currentSessionId, updateMessage, startStreamingResponse]
  );

  const handleEdit = useCallback(
    async (messageId: string, newContent: string) => {
      try {
        // 获取消息的 version_group_id（如果有）
        const message = messages.find((m) => m.id === messageId);
        const versionGroupId = message?.version_group_id;

        // 使用 addMessageVersion 并传递 versionGroupId，确保版本组功能正常工作
        addMessageVersion(messageId, newContent, versionGroupId);
        toast.success('已修改', '消息内容已更新，版本已保存');
      } catch (error) {
        console.error('Failed to edit message:', error);
        toast.error('修改失败', '无法修改消息内容');
      }
    },
    [addMessageVersion, toast, messages]
  );

  const handleSwitchVersion = useCallback(
    async (messageId: string, versionId: string) => {
      try {
        switchMessageVersion(messageId, versionId);
        // 移除成功提示，界面变化本身就是反馈
      } catch (error) {
        console.error('Failed to switch version:', error);
        toast.error('切换失败', '无法切换消息版本');
      }
    },
    [switchMessageVersion, toast]
  );

  const handleEditAndRegenerate = useCallback(
    async (messageId: string, newContent: string) => {
      try {
        // 使用 chatStore 的 editAndRegenerate 方法
        // 该方法会创建新版本、更新消息内容、设置 version_group_id
        editAndRegenerate(messageId, newContent);

        // 等待状态更新完成（Zustand 的 set 是同步的，但我们需要重新获取最新状态）
        const updatedMessages = useChatStore.getState().messagesBySession[currentSessionId!] || [];
        const messageIndex = updatedMessages.findIndex((m) => m.id === messageId);

        if (messageIndex >= 0 && currentSessionId) {
          const nextMessage = updatedMessages[messageIndex + 1];
          if (nextMessage && nextMessage.role === 'assistant') {
            // 将所有现有版本的 is_current 设置为 false，准备接收新版本
            const existingVersions = nextMessage.versions || [];
            const versions = existingVersions.map((v) => ({ ...v, is_current: false }));

            await updateMessage(nextMessage.id, {
              content: '',
              sources: [],
              entities: [],
              keywords: [],
              versions,
              isStreaming: true,
            });

            const abort = await startStreamingResponse(
              currentSessionId,
              newContent,
              nextMessage.id
            );
            abortControllerRef.current = abort;
          } else {
            const streamingMsgId = `msg_${Date.now()}_assistant_streaming`;
            const streamingMessage: Message = {
              id: streamingMsgId,
              session_id: currentSessionId,
              role: 'assistant',
              content: '',
              created_at: new Date().toISOString(),
              isStreaming: true,
            };
            await addMessage(streamingMessage);

            const abort = await startStreamingResponse(
              currentSessionId,
              newContent,
              streamingMsgId
            );
            abortControllerRef.current = abort;
          }
          toast.success('已重新生成', '答案已根据修改后的问题重新生成');
        }
      } catch (error) {
        console.error('Failed to edit and regenerate:', error);
        toast.error('操作失败', '无法编辑并重新生成');
      }
    },
    [updateMessage, addMessage, editAndRegenerate, toast, currentSessionId, startStreamingResponse]
  );

  const handleDelete = useCallback(
    async (messageId: string) => {
      try {
        await deleteMessage(messageId);
        toast.success('已删除', '消息已删除');
      } catch (error) {
        console.error('Failed to delete message:', error);
        toast.error('删除失败', '无法删除消息');
      }
    },
    [deleteMessage, toast]
  );

  const handleSyncVersionForGroup = useCallback(
    (versionGroupId: string, versionIndex: number) => {
      try {
        const { syncVersionForGroup } = useChatStore.getState();
        syncVersionForGroup(versionGroupId, versionIndex);
      } catch (error) {
        console.error('Failed to sync version for group:', error);
        toast.error('同步失败', '无法同步版本组');
      }
    },
    [toast]
  );

  const handleQuestionClick = useCallback(
    (question: string) => {
      handleSendMessage(question).catch((error) => {
        console.error('Failed to send question:', error);
        toast.error('发送失败', '无法发送问题，请重试');
      });
    },
    [handleSendMessage, toast]
  );

  const handleKeywordClick = useCallback(
    (keyword: string) => {
      handleSendMessage(`${keyword}是什么？`).catch((error) => {
        console.error('Failed to send keyword question:', error);
        toast.error('发送失败', '无法发送问题，请重试');
      });
    },
    [handleSendMessage, toast]
  );

  const handleNewChat = useCallback(async () => {
    await handleCreateSession();
  }, [handleCreateSession]);

  const handleSwitchSession = useCallback(
    async (sid: string) => {
      if (sid === currentSessionId) return;

      // 清空当前图谱数据
      setCurrentEntities([]);
      setCurrentKeywords([]);
      setCurrentRelations([]);

      await switchSession(sid);
    },
    [currentSessionId, switchSession]
  );

  const handleDeleteSession = useCallback(
    async (sid: string) => {
      try {
        await deleteSession(sid);
        toast.success('已删除', '对话已删除');
      } catch (error) {
        console.error('Failed to delete session:', error);
        setError('删除会话失败');
      }
    },
    [deleteSession, setError, toast]
  );

  const handleExport = useCallback(
    (format: 'json' | 'txt' | 'md') => {
      if (!messages.length) {
        toast.warning('无法导出', '对话为空');
        return;
      }

      let content = '';
      const title = currentSession?.title || '对话导出';
      const timestamp = new Date()
        .toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
        .replace(/\//g, '-')
        .replace(/:/g, '');
      const filename = `${title}_${timestamp}`;

      if (format === 'json') {
        const exportData = {
          title,
          exportedAt: new Date().toISOString(),
          metadata: {
            sessionId: currentSession?.id,
            messageCount: messages.length,
            createdAt: currentSession?.created_at,
          },
          messages: messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.created_at,
            isFavorite: m.is_favorite || false,
            feedback: m.feedback || null,
            entities: m.entities || [],
            sources: m.sources || [],
          })),
        };
        content = JSON.stringify(exportData, null, 2);
      } else if (format === 'md') {
        content = `# ${title}\n\n`;
        content += `**导出时间**: ${new Date().toLocaleString('zh-CN')}\n`;
        content += `**消息数量**: ${messages.length}\n\n`;
        content += `---\n\n`;

        messages.forEach((m) => {
          const role = m.role === 'user' ? '🧑 我' : '🤖 AI 助手';
          const time = new Date(m.created_at).toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          content += `## ${role} · ${time}\n\n`;
          content += `${m.content}\n\n`;

          if (m.entities && m.entities.length > 0) {
            content += `**实体**: ${m.entities.map((e) => e.name).join(', ')}\n\n`;
          }

          if (m.sources && m.sources.length > 0) {
            content += `**参考来源**:\n`;
            m.sources.forEach((source, idx) => {
              content += `${idx + 1}. ${source.title}${source.url ? ` - [查看原文](${source.url})` : ''}\n`;
            });
            content += `\n`;
          }

          content += `---\n\n`;
        });

        content += `\n*此文档由智能问答系统自动生成*\n`;
      } else {
        content = `${'='.repeat(60)}\n`;
        content += `${title}\n`;
        content += `${'='.repeat(60)}\n\n`;
        content += `导出时间：${new Date().toLocaleString('zh-CN')}\n`;
        content += `消息数量：${messages.length}\n\n`;
        content += `${'='.repeat(60)}\n\n`;

        messages.forEach((m) => {
          const time = new Date(m.created_at).toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          const role = m.role === 'user' ? '我' : 'AI 助手';

          content += `[${time}] ${role}:\n`;
          content += `${m.content}\n\n`;

          if (m.is_favorite) {
            content += `⭐ 已收藏\n\n`;
          }
          if (m.feedback === 'helpful') {
            content += `👍 有帮助\n\n`;
          }
          if (m.feedback === 'unclear') {
            content += `👎 需改进\n\n`;
          }

          content += `${'-'.repeat(40)}\n\n`;
        });

        content += `\n${'='.repeat(60)}\n`;
        content += `*此文档由智能问答系统自动生成*\n`;
      }

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('导出成功', `对话已导出为${format.toUpperCase()}格式`);
    },
    [messages, currentSession, toast]
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
  }, []);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex h-[calc(100vh-4rem)] min-h-0 overflow-hidden"
      style={{ background: 'var(--color-background)' }}
    >
      <Sidebar
        onNewChat={handleNewChat}
        onSwitchSession={handleSwitchSession}
        onDeleteSession={handleDeleteSession}
        onPinSession={(id) => pinSession(id)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        <ChatToolbar
          sessionId={currentSessionId}
          sessionTitle={currentSession?.title}
          messageCount={messages.length}
          isPinned={currentSession?.is_pinned}
          onPin={() => {
            if (currentSessionId) {
              pinSession(currentSessionId);
            }
          }}
          onExport={handleExport}
          onShare={() => toast.info('分享功能', '分享链接已复制')}
          onDelete={() => {
            if (currentSessionId) {
              handleDeleteSession(currentSessionId);
            }
          }}
          onSettings={() => setShowSessionSettings(true)}
        />

        <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <WelcomeScreen
              onQuestionClick={handleQuestionClick}
              sessionId={currentSessionId || undefined}
            />
          ) : (
            <div className="max-w-2xl mx-auto px-3 py-4 space-y-3">
              {messages.map((message, index) => (
                <div key={message.id}>
                  <UnifiedMessageBubble
                    message={message}
                    onFeedback={handleFeedback}
                    onFavorite={handleFavorite}
                    onCopy={handleCopy}
                    onRegenerate={handleRegenerate}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSwitchVersion={handleSwitchVersion}
                    onEditAndRegenerate={handleEditAndRegenerate}
                    onSyncVersionForGroup={handleSyncVersionForGroup}
                    isHistorical={!newMessageIds.has(message.id)}
                    isLast={index === messages.length - 1}
                    isStreaming={message.isStreaming === true}
                  />
                </div>
              ))}

              {isLoading &&
                messages.length > 0 &&
                messages[messages.length - 1]?.role === 'user' &&
                !streamingContent && <TypingIndicator message="正在思考..." />}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div
          className="flex-shrink-0 border-t"
          style={{
            borderColor: 'var(--color-border-light)',
            background: 'var(--color-surface)',
          }}
        >
          <div className="max-w-2xl mx-auto px-3 py-3">
            {quotedMessage && (
              <div className="mb-2">
                <MessageQuote message={quotedMessage} onRemove={() => setQuotedMessage(null)} />
              </div>
            )}
            <UnifiedInputArea
              onSend={handleSendMessage}
              isLoading={isLoading}
              isStreaming={isStreaming}
              onStop={handleStopStreaming}
            />
          </div>
        </div>

        {!autoScroll && messages.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={scrollToBottom}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 p-3 rounded-full shadow-lg z-20"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </motion.button>
        )}
      </div>

      <RightPanel
        keywords={currentKeywords}
        entities={currentEntities}
        relations={currentRelations}
        sessionId={currentSessionId ?? undefined}
        messageId={messages.length > 0 ? messages[messages.length - 1].id : undefined}
        onKeywordClick={handleKeywordClick}
        onLoadSnapshot={handleLoadSnapshot}
      />

      <AnimatePresence>
        {showCommandPalette && (
          <CommandPalette
            isOpen={showCommandPalette}
            onClose={() => setShowCommandPalette(false)}
            onNewChat={handleNewChat}
            onToggleTheme={toggleMode}
          />
        )}

        {showMessageSearch && (
          <MessageSearch
            isOpen={showMessageSearch}
            messages={messages}
            onClose={() => setShowMessageSearch(false)}
            onMessageClick={(message) => {
              const element = document.getElementById(`message-${message.id}`);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('ring-2', 'ring-amber-500');
                setTimeout(() => {
                  element.classList.remove('ring-2', 'ring-amber-500');
                }, 2000);
              }
              setShowMessageSearch(false);
            }}
          />
        )}

        {showSessionSettings && currentSession && (
          <SessionSettings
            isOpen={showSessionSettings}
            session={currentSession}
            onClose={() => setShowSessionSettings(false)}
            onUpdateTitle={(title) => {
              if (currentSessionId) {
                updateSessionTitle(currentSessionId, title);
              }
            }}
            onPin={() => {
              if (currentSessionId) {
                pinSession(currentSessionId);
              }
            }}
            onArchive={() => {
              if (currentSessionId) {
                archiveSession(currentSessionId);
                toast.success(
                  currentSession?.is_archived ? '取消归档' : '已归档',
                  currentSession?.is_archived ? '对话已取消归档' : '对话已归档'
                );
                setShowSessionSettings(false);
              }
            }}
            onDelete={() => {
              handleDeleteSession(currentSessionId!);
              setShowSessionSettings(false);
            }}
            onAddTag={(tag: string) => {
              if (currentSessionId && tag.trim()) {
                addTagToSession(currentSessionId, tag.trim());
                toast.success('添加标签', `已添加标签 "${tag.trim()}"`);
              }
            }}
            onRemoveTag={(tag: string) => {
              if (currentSessionId) {
                removeTagFromSession(currentSessionId, tag);
                toast.success('移除标签', `已移除标签 "${tag}"`);
              }
            }}
          />
        )}

        {showKeyboardShortcuts && (
          <KeyboardShortcuts
            isOpen={showKeyboardShortcuts}
            onClose={() => setShowKeyboardShortcuts(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
