import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Sparkles, WifiOff } from 'lucide-react';
import Sidebar from '../../components/chat/Sidebar';
import MessageBubble from '../../components/chat/MessageBubble';
import InputArea from '../../components/chat/InputArea';
import RightPanel from '../../components/chat/RightPanel';
import NetworkIndicator from '../../components/common/NetworkIndicator';
import OfflineBanner from '../../components/common/OfflineBanner';
import { useChatStore } from '../../stores/chatStore';
import { chatDataService } from '../../services/chatDataService';
import { networkStatusService } from '../../services/networkStatus';
import { dataSyncService } from '../../services/dataSync';

export default function ChatPage() {
  const { sessionId } = useParams();
  const messagesEndRef = useRef(null);
  const [currentEntities, setCurrentEntities] = useState([]);
  const [currentKeywords, setCurrentKeywords] = useState([]);
  const [recommendedQuestions, setRecommendedQuestions] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState(new Set());
  const [isSessionSwitching, setIsSessionSwitching] = useState(false);

  const {
    sessions,
    currentSessionId,
    messages,
    isLoading,
    networkMode,
    pendingSyncCount,
    switchSession,
    addMessage,
    updateMessage,
    setLoading,
    setError,
    setSessions,
    setMessages,
    setNetworkMode,
    setPendingSyncCount,
    setMessagesForSession,
  } = useChatStore();

  useEffect(() => {
    const unsubscribeNetwork = networkStatusService.subscribe((status) => {
      setNetworkMode(status.mode);
    });

    const unsubscribeSync = dataSyncService.subscribe(async () => {
      const count = await dataSyncService.getPendingOperationsCount();
      setPendingSyncCount(count);
    });

    return () => {
      unsubscribeNetwork();
      unsubscribeSync();
    };
  }, [setNetworkMode, setPendingSyncCount]);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const loadedSessions = await chatDataService.getSessions();
        setSessions(loadedSessions);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to load sessions:', error);
        setError('加载会话列表失败');
        setIsInitialized(true);
      }
    };
    loadSessions();
  }, [setSessions, setError]);

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        const questions = await chatDataService.getRecommendedQuestions(
          currentSessionId || undefined
        );
        setRecommendedQuestions(questions);
      } catch (error) {
        console.error('Failed to load recommendations:', error);
      }
    };
    loadRecommendations();
  }, [currentSessionId]);

  const loadSessionMessages = useCallback(
    async (sid) => {
      try {
        setIsSessionSwitching(true);
        setNewMessageIds(new Set());
        const loadedMessages = await chatDataService.getMessages(sid);
        setMessages(loadedMessages);
        setTimeout(() => setIsSessionSwitching(false), 100);
      } catch (error) {
        console.error('Failed to load messages:', error);
        setMessages([]);
        setIsSessionSwitching(false);
      }
    },
    [setMessages]
  );

  const handleCreateSession = useCallback(async () => {
    try {
      const session = await chatDataService.createSession('新对话');
      setSessions([session, ...sessions]);
      switchSession(session.id);
      setMessages([]);
      setMessagesForSession(session.id, []);
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      setError('创建会话失败');
      return null;
    }
  }, [sessions, setSessions, switchSession, setMessages, setMessagesForSession, setError]);

  useEffect(() => {
    if (!isInitialized) return;

    if (sessionId && sessionId !== currentSessionId) {
      switchSession(sessionId);
      loadSessionMessages(sessionId);
    } else if (!currentSessionId && sessions.length === 0) {
      handleCreateSession();
    }
  }, [
    sessionId,
    currentSessionId,
    sessions.length,
    switchSession,
    loadSessionMessages,
    handleCreateSession,
    isInitialized,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(
    async (content) => {
      let activeSessionId = currentSessionId;

      if (!activeSessionId) {
        if (sessions.length > 0) {
          activeSessionId = sessions[0].id;
          switchSession(activeSessionId);
        } else {
          const newSession = await handleCreateSession();
          if (!newSession) return;
          activeSessionId = newSession.id;
        }
      }

      const userMessage = {
        id: `msg_${Date.now()}_user`,
        sessionId: activeSessionId,
        role: 'user',
        content,
        createdAt: new Date(),
      };

      addMessage(userMessage);
      setNewMessageIds((prev) => new Set([...prev, userMessage.id]));
      setLoading(true);

      try {
        const aiMessage = await chatDataService.sendMessage(activeSessionId, content);

        addMessage(aiMessage);
        setNewMessageIds((prev) => new Set([...prev, aiMessage.id]));

        if (aiMessage.entities) {
          setCurrentEntities(aiMessage.entities);
        }
        if (aiMessage.keywords) {
          setCurrentKeywords(aiMessage.keywords);
        }

        const updatedSessions = await chatDataService.getSessions();
        setSessions(updatedSessions);
      } catch (error) {
        setError('发送消息失败，请重试');
        console.error('Failed to send message:', error);
      } finally {
        setLoading(false);
      }
    },
    [
      currentSessionId,
      sessions,
      addMessage,
      setLoading,
      setError,
      handleCreateSession,
      switchSession,
      setSessions,
    ]
  );

  const handleFeedback = useCallback(
    async (messageId, feedback) => {
      try {
        await chatDataService.submitFeedback(messageId, feedback);
        updateMessage(messageId, { feedback });
      } catch (error) {
        console.error('Failed to submit feedback:', error);
      }
    },
    [updateMessage]
  );

  const handleFavorite = useCallback(
    async (messageId, currentStatus) => {
      try {
        const isFavorite = await chatDataService.toggleFavorite(messageId, currentStatus);
        updateMessage(messageId, { isFavorite });
      } catch (error) {
        console.error('Failed to toggle favorite:', error);
      }
    },
    [updateMessage]
  );

  const handleRegenerate = useCallback(
    (messageId) => {
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex > 0) {
        const userMessage = messages[messageIndex - 1];
        if (userMessage.role === 'user') {
          handleSendMessage(userMessage.content);
        }
      }
    },
    [messages, handleSendMessage]
  );

  const handleQuestionClick = useCallback(
    (question) => {
      handleSendMessage(question);
    },
    [handleSendMessage]
  );

  const handleEntityClick = useCallback(
    (entity) => {
      handleSendMessage(`请详细介绍${entity.name}`);
    },
    [handleSendMessage]
  );

  const handleNewChat = useCallback(async () => {
    await handleCreateSession();
  }, [handleCreateSession]);

  const handleSwitchSession = useCallback(
    (sid) => {
      switchSession(sid);
      loadSessionMessages(sid);
    },
    [switchSession, loadSessionMessages]
  );

  const handleDeleteSession = useCallback(
    async (sid) => {
      try {
        await chatDataService.deleteSession(sid);
        const updatedSessions = await chatDataService.getSessions();
        setSessions(updatedSessions);
        if (currentSessionId === sid) {
          if (updatedSessions.length > 0) {
            switchSession(updatedSessions[0].id);
            loadSessionMessages(updatedSessions[0].id);
          } else {
            switchSession(null);
            setMessages([]);
          }
        }
      } catch (error) {
        console.error('Failed to delete session:', error);
        setError('删除会话失败');
      }
    },
    [currentSessionId, setSessions, switchSession, setMessages, loadSessionMessages, setError]
  );

  const handleForceSync = useCallback(async () => {
    if (networkMode === 'online') {
      await dataSyncService.syncPendingOperations();
    }
  }, [networkMode]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <OfflineBanner />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          onNewChat={handleNewChat}
          onSwitchSession={handleSwitchSession}
          onDeleteSession={handleDeleteSession}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white/50 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              {networkMode === 'offline' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm">
                  <WifiOff size={14} />
                  <span>离线模式</span>
                </div>
              )}
              {pendingSyncCount > 0 && networkMode === 'online' && (
                <button
                  onClick={handleForceSync}
                  className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100 transition-colors"
                >
                  <span>{pendingSyncCount} 项待同步</span>
                </button>
              )}
            </div>
            <NetworkIndicator />
          </div>

          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <WelcomeScreen onQuestionClick={handleQuestionClick} />
            ) : (
              <div className="max-w-4xl mx-auto px-4 py-6">
                {messages.map((message) => {
                  const isHistorical = !isSessionSwitching && !newMessageIds.has(message.id);
                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isHistorical={isHistorical}
                      onFeedback={(feedback) => handleFeedback(message.id, feedback)}
                      onFavorite={() => handleFavorite(message.id, message.isFavorite)}
                      onRegenerate={() => handleRegenerate(message.id)}
                    />
                  );
                })}
                {isLoading && (
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                      <Sparkles size={20} className="text-white" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <InputArea onSend={handleSendMessage} isLoading={isLoading} />
        </div>

        <RightPanel
          entities={currentEntities}
          keywords={currentKeywords}
          recommendedQuestions={recommendedQuestions}
          onQuestionClick={handleQuestionClick}
          onEntityClick={handleEntityClick}
        />
      </div>
    </div>
  );
}

function WelcomeScreen({ onQuestionClick }) {
  const quickQuestions = [
    { icon: '🎨', question: '武汉木雕有哪些代表性技法？', color: 'from-purple-500 to-pink-500' },
    { icon: '🧵', question: '汉绣的基本针法有哪些？', color: 'from-blue-500 to-cyan-500' },
    { icon: '🏯', question: '黄鹤楼的历史传说有哪些？', color: 'from-amber-500 to-orange-500' },
    { icon: '📜', question: '楚文化的核心特征是什么？', color: 'from-green-500 to-emerald-500' },
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.1, 0.3, 0.1],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
            className="absolute w-2 h-2 bg-blue-400 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center max-w-3xl relative z-10"
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
          className="relative mb-8 inline-block"
        >
          <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-2xl">
            <MessageSquare size={48} className="text-white" />
          </div>
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 opacity-30 blur-xl"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent mb-4"
        >
          智能问答助手
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-xl text-gray-600 mb-12"
        >
          探索非遗文化的数字世界，获取专业的知识解答
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {quickQuestions.map((item, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.5 + index * 0.1, type: 'spring', stiffness: 300 }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onQuestionClick(item.question)}
              className="group relative p-5 bg-white rounded-2xl border border-gray-200 hover:border-transparent text-left overflow-hidden shadow-lg hover:shadow-2xl transition-all"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
              />
              <div className="relative flex items-start gap-4">
                <div
                  className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg`}
                >
                  <span className="text-2xl">{item.icon}</span>
                </div>
                <div className="flex-1 pt-2">
                  <p className="text-base font-medium text-gray-900 group-hover:text-gray-800 transition-colors">
                    {item.question}
                  </p>
                </div>
              </div>
              <motion.div
                initial={{ scaleX: 0 }}
                whileHover={{ scaleX: 1 }}
                transition={{ duration: 0.3 }}
                className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${item.color} origin-left`}
              />
            </motion.button>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex items-center justify-center gap-2 text-sm text-gray-500"
        >
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <Sparkles size={16} className="text-amber-500" />
          </motion.div>
          <span>输入问题开始对话，或点击上方快捷问题快速开始</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
