import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore, pruneVersions } from '../../stores/chatStore';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import { chatDataService } from '../../services/chat';
import { graphSyncService } from '../../services/graphSyncService';
import { fileUploadService } from '../../services/fileUpload';
import { categorizeError } from '../../services/errorHandler';
import { useToast } from '../../components/common/Toast';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useChatMessageActions } from '../../hooks/useChatMessageActions';
import { useAccessibility } from '../../contexts/AccessibilityContext';
// performanceMonitor 暂未集成，可根据需要添加
import type {
  Entity,
  Source,
  Message,
  Relation,
  GraphSnapshot,
  MessageVersion,
} from '../../types/chat';
import type { UploadedFile } from '../../components/chat/UnifiedInputArea';

import Sidebar from '../../components/chat/Sidebar';
import RightPanel from '../../components/chat/RightPanel';
import UnifiedInputArea from '../../components/chat/UnifiedInputArea';
import ChatToolbar from '../../components/chat/ChatToolbar';
import CommandPalette from '../../components/chat/CommandPalette';
import WelcomeScreen from '../../components/chat/WelcomeScreen';
import MessageSearch from '../../components/chat/MessageSearch';
import SessionSettings from '../../components/chat/SessionSettings';
import KeyboardShortcuts from '../../components/chat/KeyboardShortcuts';
import { MessageQuote } from '../../components/chat/MessageQuote';
import { VirtualMessageList } from '../../components/common/VirtualMessageList';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useThemeStore } from '../../stores/themeStore';
import { streamingLockManager } from '../../services/streamingLockManager';
import MobileMenuButton from '../../components/chat/MobileMenuButton';
import { GlobalErrorBoundary } from '../../components/common/GlobalErrorBoundary';
import { AccessibilityAnnouncer } from '../../contexts/AccessibilityContext';

// 导入响应式样式
import '../../styles/chat-responsive.css';

export default function EnhancedChatPage() {
  const { sessionId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<(() => void) | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState(new Set<string>());
  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showSessionSettings, setShowSessionSettings] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [showDeleteMessageConfirm, setShowDeleteMessageConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const toast = useToast();
  useAccessibility();

  const {
    sessions,
    currentSessionId,
    messagesBySession,
    isLoading,
    isStreaming,
    switchSession,
    addMessage,
    updateMessage,
    rekeyMessageInSession,
    // deleteMessage - 保留以备后用
    setLoading,
    setStreaming,
    setError,
    pinSession,
    updateSessionTitle,
    deleteSession,
    createSession,
    // addMessageVersion - 保留以备后用
    // switchMessageVersion - 保留以备后用
    archiveSession,
    addTagToSession,
    removeTagFromSession,
    editAndRegenerate,
  } = useChatStore();

  const messages = useMemo(
    () => (currentSessionId ? messagesBySession[currentSessionId] || [] : []),
    [currentSessionId, messagesBySession]
  );

  const { toggleSidebar } = useUIStore();
  const { toggleMode } = useThemeStore();

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const graphEntities = useGraphStore((state) => state.entities);
  const graphRelations = useGraphStore((state) => state.relations);
  const graphKeywords = useGraphStore((state) => state.keywords);

  // 使用增强的键盘导航 Hook
  useKeyboardNavigation({
    enabled: isInitialized,
    onEscape: () => {
      setShowCommandPalette(false);
      setShowMessageSearch(false);
      setShowSessionSettings(false);
      setShowKeyboardShortcuts(false);
      setQuotedMessage(null);
    },
    customShortcuts: [
      {
        keys: ['mod', 'k'],
        handler: () => setShowCommandPalette(true),
        description: '打开命令面板',
      },
      {
        keys: ['mod', 'f'],
        handler: () => setShowMessageSearch(true),
        description: '搜索消息',
      },
      {
        keys: ['mod', '/'],
        handler: () => setShowKeyboardShortcuts(true),
        description: '查看快捷键',
      },
      {
        keys: ['mod', 'shift', 'd'],
        handler: () => toggleMode(),
        description: '切换主题',
      },
      {
        keys: ['mod', '\\'],
        handler: () => toggleSidebar(),
        description: '切换侧边栏',
      },
    ],
  });

  // 图谱状态恢复函数
  // graphSyncService 是单例模式，不需要在依赖数组中
  const restoreGraphState = useCallback(async (targetSessionId: string) => {
    try {
      const savedGraphState = sessionStorage.getItem(`graphState_${targetSessionId}`);
      if (!savedGraphState) {
        const messages = useChatStore.getState().messagesBySession[targetSessionId] || [];
        if (messages.length > 0) {
          const lastAiWithGraph = [...messages]
            .reverse()
            .find(
              (m) =>
                m.role === 'assistant' &&
                ((m.entities && m.entities.length > 0) ||
                  (m.relations && m.relations.length > 0) ||
                  (m.keywords && m.keywords.length > 0))
            );
          if (lastAiWithGraph) {
            graphSyncService.updateFromSnapshot(
              lastAiWithGraph.entities || [],
              lastAiWithGraph.relations || [],
              lastAiWithGraph.keywords || [],
              targetSessionId,
              lastAiWithGraph.id
            );
            if (import.meta.env.DEV) {
              console.log('Restored graph state from last AI message');
            }
          }
        }
        return;
      }

      const { entities, relations, keywords, filters } = JSON.parse(savedGraphState);

      if (!entities || !Array.isArray(entities) || entities.length === 0) {
        if (import.meta.env.DEV) {
          console.warn('Invalid graph state data');
        }
        return;
      }

      const isValid = entities.every((e) => {
        const entity = e as Record<string, unknown>;
        return entity.id && entity.name && entity.type;
      });
      if (!isValid) {
        if (import.meta.env.DEV) {
          console.warn('Graph state entities have invalid structure');
        }
        return;
      }

      const uniqueEntities = entities.filter(
        (e: Record<string, unknown>, index: number, self: Array<Record<string, unknown>>) =>
          index === self.findIndex((t) => t.id === e.id)
      );

      const uniqueRelations = (relations || []).filter(
        (r: Record<string, unknown>, index: number, self: Array<Record<string, unknown>>) =>
          index ===
          self.findIndex(
            (t) => `${t.source}-${t.target}-${t.type}` === `${r.source}-${r.target}-${r.type}`
          )
      );

      graphSyncService.updateFromSnapshot(
        uniqueEntities,
        uniqueRelations,
        keywords || [],
        targetSessionId,
        undefined
      );

      const event = new CustomEvent('restoreGraphState', {
        detail: {
          entities: uniqueEntities,
          relations: uniqueRelations,
          keywords,
          filters,
        },
      });
      window.dispatchEvent(event);

      if (import.meta.env.DEV) {
        console.log('Restored graph state from sessionStorage');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Failed to restore graph state:', error);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let initTimeoutId: NodeJS.Timeout | null = null;

    const initChat = async () => {
      try {
        setLoading(true);

        const {
          initializeData,
          createSession,
          switchSession: switchSess,
        } = useChatStore.getState();

        await initializeData();

        if (!isMounted) return;

        const { sessions: fetchedSessions, currentSessionId: storeCurrentSessionId } =
          useChatStore.getState();

        let targetSessionId = sessionId;

        if (!targetSessionId) {
          if (
            storeCurrentSessionId &&
            fetchedSessions.some((s) => s.id === storeCurrentSessionId)
          ) {
            targetSessionId = storeCurrentSessionId;
          } else if (fetchedSessions.length > 0) {
            targetSessionId = fetchedSessions[0].id;
          } else {
            const newSession = await createSession();
            targetSessionId = newSession.id;
          }
        }

        if (!isMounted) return;

        if (targetSessionId) {
          await switchSess(targetSessionId);

          if (!isMounted) return;

          await restoreGraphState(targetSessionId);
        }

        if (isMounted) {
          setIsInitialized(true);
        }
      } catch (error) {
        if (isMounted) {
          const errorInfo = categorizeError(error);
          toast.error('初始化失败', errorInfo.userMessage);
          setIsInitialized(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initTimeoutId = setTimeout(() => {
      initChat();
    }, 0);

    return () => {
      isMounted = false;
      if (initTimeoutId) {
        clearTimeout(initTimeoutId);
      }
      streamingLockManager.clear();
    };
  }, [sessionId, setLoading, toast, restoreGraphState]);

  // 自动滚动逻辑已移至 VirtualMessageList 组件中统一处理
  // 避免双重滚动控制导致的冲突和性能问题

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

  useEffect(() => {
    const handleMockFallback = () => {
      toast.warning('服务降级', 'AI 服务暂时不可用，当前使用本地模拟数据');
    };

    window.addEventListener('chat:mockFallback', handleMockFallback);
    return () => window.removeEventListener('chat:mockFallback', handleMockFallback);
  }, [toast]);

  const handleCreateSession = useCallback(async () => {
    try {
      const newSession = await createSession();
      return newSession;
    } catch (error) {
      const errorInfo = categorizeError(error);
      toast.error('创建失败', errorInfo.userMessage);
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
  // 与 graphSyncService.updateFromChat(entities, relations, keywords) 对齐；sources 仅预留
  const updateGraphData = useCallback(
    (entities?: Entity[], relations?: Relation[], keywords?: string[], _sources?: Source[]) => {
      if (import.meta.env.DEV) {
        console.log('🔵 updateGraphData 被调用:', {
          entities: entities?.length || 0,
          relations: relations?.length || 0,
          keywords: keywords?.length || 0,
        });
      }

      const hasGraphPayload =
        (entities && entities.length > 0) ||
        (relations && relations.length > 0) ||
        (keywords && keywords.length > 0);

      if (hasGraphPayload) {
        graphSyncService.updateFromChat(
          entities || [],
          relations || [],
          keywords || [],
          currentSessionId || undefined,
          undefined
        );

        if (import.meta.env.DEV) {
          console.log('✅ graphSyncService.updateFromChat 已调用');
        }
      }
    },
    [currentSessionId]
  );

  // ========== 辅助函数：加载快照 ==========
  // graphSyncService 是单例模式，不需要在依赖数组中
  const handleLoadSnapshot = useCallback((snapshot: GraphSnapshot) => {
    graphSyncService.updateFromSnapshot(
      snapshot.entities || [],
      snapshot.relations || [],
      snapshot.keywords || [],
      snapshot.session_id,
      snapshot.message_id
    );

    const event = new CustomEvent('loadSnapshot', {
      detail: {
        entities: snapshot.entities,
        relations: snapshot.relations,
        keywords: snapshot.keywords,
      },
    });
    window.dispatchEvent(event);
  }, []);

  // ========== 核心函数：流式响应处理 ==========
  // streamingLockManager 是单例模式，不需要在依赖数组中
  const startStreamingResponse = useCallback(
    async (sessionId: string, userContent: string, streamingMsgId: string, fileUrls?: string[]) => {
      // 使用 streamingLockManager 防止并发流式响应
      if (!streamingLockManager.acquire(streamingMsgId)) {
        console.warn('⚠️ Another stream is already running, blocking new stream');
        return () => {};
      }

      try {
        setLoading(true);
        setStreaming(true);
        setIsThinking(true);

        // 初始化消息状态 - 使用 updateMessage 确保触发订阅更新
        await updateMessage(streamingMsgId, { content: '', isStreaming: true });

        let fullContent = '';
        let receivedAnyChunk = false;
        let lastUpdatedContent = ''; // 记录上次更新的内容

        // 使用节流的方式更新消息，避免竞态条件
        const throttledUpdate = async () => {
          // 只有当有新内容时才更新
          if (fullContent === lastUpdatedContent) return;

          const contentToUpdate = fullContent;
          lastUpdatedContent = fullContent;

          try {
            await updateMessage(streamingMsgId, {
              content: contentToUpdate,
              isStreaming: true,
              updated_at: new Date().toISOString(),
            });
          } catch (err) {
            console.error('更新消息失败:', err);
          }
        };

        // ✅ 优化 3：降低更新频率，减少重渲染（100ms → 250ms）
        const updateInterval = setInterval(throttledUpdate, 250);

        const abort = await chatDataService.sendMessageStream(
          sessionId,
          userContent,
          (chunk) => {
            // 接收到第一个 chunk 时，表示 AI 开始生成内容
            if (!receivedAnyChunk) {
              receivedAnyChunk = true;
              setIsThinking(false);
            }

            // 验证 chunk 是否有效（允许空字符串用于格式化）
            if (chunk === null || chunk === undefined || typeof chunk !== 'string') {
              console.warn('⚠️ Received invalid chunk:', chunk);
              return;
            }

            // 直接流式显示，不经过打字机效果
            fullContent += chunk;

            // 更新 streamingContent 状态用于 VirtualMessageList
            setStreamingContent(fullContent);
          },
          async (aiMessage) => {
            try {
              // 流式传输完成
              setIsThinking(false);

              const currentMsg = useChatStore
                .getState()
                .messagesBySession[sessionId]?.find((m) => m.id === streamingMsgId);
              const existingVersions = currentMsg?.versions || [];

              let versions = existingVersions;
              if (fullContent && fullContent.trim()) {
                if (existingVersions.length === 0) {
                  const initialVersion: MessageVersion = {
                    id: `version_${Date.now()}`,
                    content: fullContent,
                    created_at: new Date().toISOString(),
                    is_current: true,
                  };
                  versions = [initialVersion];
                } else {
                  const newVersion: MessageVersion = {
                    id: `version_${Date.now()}`,
                    content: fullContent,
                    created_at: new Date().toISOString(),
                    is_current: true,
                  };
                  versions = pruneVersions([
                    ...existingVersions.map((v) => ({ ...v, is_current: false })),
                    newVersion,
                  ]);
                }
              }

              // 清理定时器
              clearInterval(updateInterval);
              // 确保最后一次更新被执行
              await throttledUpdate();

              // 同步更新最终消息状态 - 使用 updateMessage 确保触发订阅更新
              await updateMessage(streamingMsgId, {
                content: fullContent,
                sources: aiMessage.sources || [],
                entities: aiMessage.entities || [],
                keywords: aiMessage.keywords || [],
                relations: aiMessage.relations || [],
                versions,
                isStreaming: false,
              });

              const serverMsgId = aiMessage.id || streamingMsgId;
              if (serverMsgId !== streamingMsgId) {
                await rekeyMessageInSession(sessionId, streamingMsgId, serverMsgId);
              }

              setNewMessageIds((prev) => new Set([...prev, serverMsgId]));

              const entities = aiMessage.entities || [];
              const keywords = aiMessage.keywords || [];
              const sources = aiMessage.sources || [];
              const relations = aiMessage.relations || [];
              updateGraphData(entities, relations, keywords, sources);

              setLoading(false);
              setStreaming(false);
              setIsThinking(false);
              setStreamingContent(''); // 清空流式内容
              streamingLockManager.release(streamingMsgId);
            } catch (innerError) {
              // 清理定时器
              clearInterval(updateInterval);
              console.error('Error in stream completion handler:', innerError);
              setStreamingContent(''); // 清空流式内容
              streamingLockManager.release(streamingMsgId);
            }
          },
          async (error) => {
            try {
              // 清理定时器
              clearInterval(updateInterval);
              // 确保最后一次更新被执行
              await throttledUpdate();

              setLoading(false);
              setStreaming(false);
              setIsThinking(false);
              setStreamingContent(''); // 清空流式内容

              // 同步更新错误消息 - 使用 updateMessage 确保触发订阅更新
              await updateMessage(streamingMsgId, {
                content: fullContent || '抱歉，生成回复时出现错误。请重试。',
                isStreaming: false,
              });

              toast.error('发送失败', error.message || 'AI 回复生成失败');
              streamingLockManager.release(streamingMsgId);
            } catch (innerError) {
              // 清理定时器
              clearInterval(updateInterval);
              console.error('Error in stream error handler:', innerError);
              setStreamingContent(''); // 清空流式内容
              streamingLockManager.release(streamingMsgId);
            }
          },
          undefined,
          { fileUrls }
        );

        return () => {
          clearInterval(updateInterval);
          abort();
        };
      } catch (error) {
        setIsThinking(false);
        streamingLockManager.release(streamingMsgId);
        throw error;
      }
    },
    [
      setLoading,
      setStreaming,
      setNewMessageIds,
      updateGraphData,
      toast,
      setStreamingContent,
      updateMessage,
      rekeyMessageInSession,
    ]
  );

  // ========== 主函数：发送消息 ==========
  const handleSendMessage = useCallback(
    async (content: string, options?: { files?: UploadedFile[] }) => {
      if (!content || !content.trim()) {
        return;
      }

      try {
        // 1. 确保有活跃会话
        const activeSessionId = await ensureActiveSession();

        // 2. 如果有文件，先上传文件
        let fileUrls: string[] = [];
        if (options?.files && options.files.length > 0) {
          try {
            toast.info('文件上传中', `正在上传 ${options.files.length} 个文件...`);

            const uploadPromises = options.files.map(async (uploadedFile) => {
              const response = await fileUploadService.uploadFile(uploadedFile.file);
              return response.url;
            });

            fileUrls = await Promise.all(uploadPromises);
            toast.success('上传成功', `${fileUrls.length} 个文件已上传`);
          } catch (error) {
            const errorInfo = categorizeError(error);
            toast.error('文件上传失败', errorInfo.userMessage);
          }
        }

        // 3. 构建用户消息（后端会处理文件 URL）
        const userMessage = buildUserMessage(activeSessionId, content);
        await addMessage(userMessage);
        setNewMessageIds((prev) => new Set([...prev, userMessage.id]));
        setQuotedMessage(null);

        // 4. 创建流式消息
        const streamingMessage = createStreamingMessage(activeSessionId);
        const streamingMsgId = streamingMessage.id;
        await addMessage(streamingMessage);

        // 5. 启动流式响应（传递文件 URL 列表）
        const abort = await startStreamingResponse(
          activeSessionId,
          content,
          streamingMsgId,
          fileUrls // 预留参数，用于未来支持文件上传功能
        );
        abortControllerRef.current = abort;
      } catch (error) {
        setLoading(false);
        setStreaming(false);
        const errorInfo = categorizeError(error);
        toast.error('发送失败', errorInfo.userMessage);
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

  // 停止生成：直接调用当前流式请求的 abort 函数
  const handleStopStreaming = useCallback(() => {
    try {
      abortControllerRef.current?.();
    } finally {
      abortControllerRef.current = null;
      setIsThinking(false);
      setStreamingContent('');
      setStreaming(false);
      setLoading(false);
    }
  }, [setLoading, setStreaming]);

  // 重新生成：对同一条 assistant 消息进行流式覆盖
  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (!currentSessionId) return;

      // 防止并发重新生成
      if (!streamingLockManager.acquire(messageId)) {
        return;
      }

      try {
        setLoading(true);
        setStreaming(true);
        setIsThinking(true);
        setStreamingContent('');

        const existingMsg = useChatStore
          .getState()
          .messagesBySession[currentSessionId]?.find((m) => m.id === messageId);

        const existingVersions = existingMsg?.versions || [];

        await updateMessage(messageId, {
          content: '',
          isStreaming: true,
          is_regenerating: true,
        });

        let fullContent = '';
        let updatePending = false;
        let pendingContent = '';

        const throttledUpdate = async () => {
          if (!updatePending || pendingContent === fullContent) return;
          updatePending = false;
          const contentToUpdate = pendingContent;
          await updateMessage(messageId, {
            content: contentToUpdate,
            isStreaming: true,
            is_regenerating: true,
            updated_at: new Date().toISOString(),
          });
        };

        const updateInterval = setInterval(() => {
          throttledUpdate().catch((e) => console.warn('Regenerate update failed:', e));
        }, 100);

        const abort = await chatDataService.regenerateMessageStream(
          messageId,
          (chunk) => {
            if (typeof chunk !== 'string') return;
            if (chunk && setIsThinking) setIsThinking(false);
            fullContent += chunk;
            pendingContent = fullContent;
            setStreamingContent(fullContent);
            updatePending = true;
          },
          async (regenerated) => {
            clearInterval(updateInterval);
            await throttledUpdate();

            const newVersion: MessageVersion = {
              id: `version_${Date.now()}`,
              content: fullContent,
              created_at: new Date().toISOString(),
              is_current: true,
            };

            const versions = pruneVersions([
              ...existingVersions.map((v) => ({ ...v, is_current: false })),
              newVersion,
            ]);

            await updateMessage(messageId, {
              content: fullContent,
              sources: regenerated.sources || [],
              entities: regenerated.entities || [],
              keywords: regenerated.keywords || [],
              relations: regenerated.relations || [],
              versions,
              isStreaming: false,
              is_regenerating: false,
            });

            updateGraphData(
              regenerated.entities || [],
              regenerated.relations || [],
              regenerated.keywords || [],
              regenerated.sources || []
            );

            setLoading(false);
            setStreaming(false);
            setIsThinking(false);
            setStreamingContent('');
            streamingLockManager.release(messageId);
          },
          (error) => {
            clearInterval(updateInterval);
            console.error('Regenerate stream error:', error);
            toast.error('重新生成失败', error.message);
            setLoading(false);
            setStreaming(false);
            setIsThinking(false);
            setStreamingContent('');
            streamingLockManager.release(messageId);
          },
          (status) => {
            // 状态变化处理（可选）
            console.log(`Regenerate status: ${status}`);
          }
        );

        abortControllerRef.current = abort;
      } catch (error) {
        streamingLockManager.release(messageId);
        setLoading(false);
        setStreaming(false);
        setIsThinking(false);
        setStreamingContent('');
        const errorInfo = categorizeError(error);
        toast.error('重新生成失败', errorInfo.userMessage);
      }
    },
    [currentSessionId, setLoading, setStreaming, toast, updateMessage, updateGraphData]
  );

  // 编辑用户消息后自动对下一条 AI 回复走重新生成（与 complete 内嵌的图谱字段一致）
  const handleEditAndRegenerate = useCallback(
    async (userMessageId: string, newContent: string) => {
      if (!newContent.trim()) {
        toast.error('编辑失败', '内容不能为空');
        return;
      }
      if (!currentSessionId) return;

      editAndRegenerate(userMessageId, newContent);
      toast.success('已更新', '正在重新生成回答…');

      const msgs = useChatStore.getState().messagesBySession[currentSessionId] || [];
      const idx = msgs.findIndex((m) => m.id === userMessageId);
      const next = idx >= 0 ? msgs[idx + 1] : undefined;
      if (next?.role === 'assistant') {
        await handleRegenerate(next.id);
      } else {
        toast.info('提示', '未找到下一条 AI 回复，已仅保存您的修改');
      }
    },
    [currentSessionId, editAndRegenerate, handleRegenerate, toast]
  );

  // 使用消息操作 Hook
  const {
    handleFeedback,
    handleFavorite,
    handleCopy,
    handleEdit,
    handleDelete: originalHandleDelete,
    handleSwitchVersion,
    // handleQuote - 保留以备后用
  } = useChatMessageActions({
    sessionId: currentSessionId,
    quotedMessage,
    setQuotedMessage,
  });

  // 包装删除函数，添加确认弹窗
  const handleDeleteWithConfirm = useCallback((messageId: string) => {
    setMessageToDelete(messageId);
    setShowDeleteMessageConfirm(true);
  }, []);

  const confirmDeleteMessage = useCallback(() => {
    if (messageToDelete) {
      originalHandleDelete(messageToDelete);
      setShowDeleteMessageConfirm(false);
      setMessageToDelete(null);
    }
  }, [messageToDelete, originalHandleDelete]);

  const cancelDeleteMessage = useCallback(() => {
    setShowDeleteMessageConfirm(false);
    setMessageToDelete(null);
  }, []);

  // 其他辅助函数
  const handleSyncVersionForGroup = useCallback(
    (versionGroupId: string, versionIndex: number) => {
      try {
        const { syncVersionForGroup } = useChatStore.getState();
        syncVersionForGroup(versionGroupId, versionIndex);
      } catch (error) {
        toast.error('同步失败', '无法同步版本组');
      }
    },
    [toast]
  );

  const handleQuestionClick = useCallback(
    (question: string) => {
      handleSendMessage(question).catch((error) => {
        const errorInfo = categorizeError(error);
        toast.error('发送失败', errorInfo.userMessage);
      });
    },
    [handleSendMessage, toast]
  );

  const handleKeywordClick = useCallback(
    (keyword: string) => {
      handleSendMessage(`${keyword}是什么？`).catch((error) => {
        const errorInfo = categorizeError(error);
        toast.error('发送失败', errorInfo.userMessage);
      });
    },
    [handleSendMessage, toast]
  );

  const handleNewChat = useCallback(async () => {
    try {
      // 创建新会话并自动切换
      const newSession = await handleCreateSession();
      if (newSession?.id) {
        // 清空当前图谱数据
        useGraphStore.getState().clearGraphData();
        // 切换到新会话
        await switchSession(newSession.id);
      }
    } catch (error) {
      console.error('创建新对话失败:', error);
      toast.error('创建失败', '无法创建新对话，请重试');
    }
  }, [handleCreateSession, switchSession, toast]);

  const handleSwitchSession = useCallback(
    async (sid: string) => {
      if (sid === currentSessionId) return;

      // 清空当前图谱数据
      useGraphStore.getState().clearGraphData();

      // 切换会话并等待消息加载完成
      await switchSession(sid);

      // 确保消息已加载，然后恢复图谱数据
      const newMessages = useChatStore.getState().messagesBySession[sid] || [];

      // 查找最后一条带图谱字段的 AI 消息（实体 / 关系 / 关键词任一即可）
      const lastAiWithGraph = [...newMessages]
        .reverse()
        .find(
          (m) =>
            m.role === 'assistant' &&
            ((m.entities && m.entities.length > 0) ||
              (m.relations && m.relations.length > 0) ||
              (m.keywords && m.keywords.length > 0))
        );

      if (lastAiWithGraph) {
        graphSyncService.updateFromChat(
          lastAiWithGraph.entities || [],
          lastAiWithGraph.relations || [],
          lastAiWithGraph.keywords || [],
          sid,
          lastAiWithGraph.id
        );
        if (import.meta.env.DEV) {
          console.log('✅ 切换会话后自动恢复图谱数据:', {
            entities: lastAiWithGraph.entities?.length || 0,
            relations: lastAiWithGraph.relations?.length || 0,
            keywords: lastAiWithGraph.keywords?.length || 0,
          });
        }
      }
    },
    [currentSessionId, switchSession]
  );

  const handleDeleteSession = useCallback(
    async (sid: string) => {
      try {
        await deleteSession(sid);
        toast.success('已删除', '对话已删除');
      } catch (error) {
        const errorInfo = categorizeError(error);
        setError(errorInfo.userMessage);
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
    <GlobalErrorBoundary name="EnhancedChatPage">
      <AccessibilityAnnouncer />
      <div className="chat-layout" style={{ background: 'var(--color-background)' }} role="main">
        {/* 移动端菜单按钮 */}
        <div className="md:hidden fixed top-4 left-4 z-50">
          <MobileMenuButton
            isOpen={isMobileMenuOpen}
            onToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />
        </div>

        <div className={`panel panel-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
          <Sidebar
            onNewChat={handleNewChat}
            onSwitchSession={handleSwitchSession}
            onDeleteSession={handleDeleteSession}
            onPinSession={(id) => pinSession(id)}
          />
        </div>

        <div className="panel panel-main" role="region" aria-label="聊天主区域">
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

          <div
            className="flex-1 overflow-y-auto custom-scrollbar"
            ref={messagesContainerRef}
            style={{ background: 'var(--color-background)' }}
          >
            {messages.length === 0 ? (
              <WelcomeScreen
                onQuestionClick={handleQuestionClick}
                sessionId={currentSessionId || undefined}
              />
            ) : (
              <VirtualMessageList
                messages={messages}
                isThinking={isThinking}
                streamingContent={streamingContent}
                newMessageIds={newMessageIds}
                onFeedback={handleFeedback}
                onFavorite={handleFavorite}
                onCopy={handleCopy}
                onRegenerate={handleRegenerate}
                onEdit={handleEdit}
                onDelete={handleDeleteWithConfirm}
                onSwitchVersion={handleSwitchVersion}
                onEditAndRegenerate={handleEditAndRegenerate}
                onSyncVersionForGroup={handleSyncVersionForGroup}
                onQuote={setQuotedMessage}
                messagesEndRef={messagesEndRef}
              />
            )}
          </div>

          <div
            className="flex-shrink-0"
            style={{
              background: 'var(--color-surface)',
              borderTop: '1px solid var(--color-border-light)',
            }}
          >
            <div className="max-w-3xl mx-auto px-4 py-3">
              {quotedMessage && (
                <div className="mb-2">
                  <MessageQuote message={quotedMessage} onRemove={() => setQuotedMessage(null)} />
                </div>
              )}
              <UnifiedInputArea
                sessionId={currentSessionId || undefined}
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

        <div className="panel panel-right">
          <RightPanel
            keywords={graphKeywords}
            entities={graphEntities}
            relations={graphRelations}
            sessionId={currentSessionId ?? undefined}
            messageId={messages.length > 0 ? messages[messages.length - 1].id : undefined}
            onKeywordClick={handleKeywordClick}
            onLoadSnapshot={handleLoadSnapshot}
          />
        </div>

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

          {/* 删除消息确认弹窗 */}
          <ConfirmDialog
            isOpen={showDeleteMessageConfirm}
            title="删除消息"
            message="确定要删除这条消息吗？此操作无法撤销。"
            type="danger"
            confirmText="删除"
            cancelText="取消"
            onConfirm={confirmDeleteMessage}
            onCancel={cancelDeleteMessage}
          />
        </AnimatePresence>
      </div>
    </GlobalErrorBoundary>
  );
}
