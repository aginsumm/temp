import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Sparkles } from 'lucide-react';
import Sidebar from '../../components/chat/Sidebar';
import MessageBubble from '../../components/chat/MessageBubble';
import InputArea from '../../components/chat/InputArea';
import RightPanel from '../../components/chat/RightPanel';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import chatApi from '../../api/chat';

export default function ChatPage() {
  const { sessionId } = useParams();
  const messagesEndRef = useRef(null);
  const [currentEntities, setCurrentEntities] = useState([]);
  const [currentKeywords, setCurrentKeywords] = useState([]);
  const [recommendedQuestions, setRecommendedQuestions] = useState([]);

  const {
    sessions,
    currentSessionId,
    messages,
    isLoading,
    createSession,
    switchSession,
    addMessage,
    updateMessage,
    setLoading,
    setError,
    setSessions,
    setMessages,
  } = useChatStore();
  const { sidebarCollapsed, rightPanelCollapsed } = useUIStore();

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const response = await chatApi.getSessions();
        setSessions(response.sessions);
      } catch (error) {
        console.error('Failed to load sessions:', error);
      }
    };
    loadSessions();
  }, [setSessions]);

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        const response = await chatApi.getRecommendedQuestions(currentSessionId || undefined);
        setRecommendedQuestions(response.questions || []);
      } catch (error) {
        console.error('Failed to load recommendations:', error);
      }
    };
    loadRecommendations();
  }, [currentSessionId]);

  useEffect(() => {
    if (sessionId && sessionId !== currentSessionId) {
      switchSession(sessionId);
      loadSessionMessages(sessionId);
    } else if (!currentSessionId && sessions.length === 0) {
      handleCreateSession();
    }
  }, [sessionId, currentSessionId, sessions.length]);

  const loadSessionMessages = async (sid) => {
    try {
      const response = await chatApi.getMessages(sid);
      setMessages(response.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateSession = useCallback(async () => {
    try {
      const session = await chatApi.createSession('新对话');
      setSessions([session, ...sessions]);
      switchSession(session.id);
      setMessages([]);
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      setError('创建会话失败');
      return null;
    }
  }, [sessions, setSessions, switchSession, setMessages, setError]);

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
      setLoading(true);

      try {
        const response = await chatApi.sendMessage({
          sessionId: activeSessionId,
          content,
        });

        const aiMessage = {
          id: response.messageId,
          sessionId: activeSessionId,
          role: 'assistant',
          content: response.content,
          createdAt: new Date(response.createdAt),
          sources: response.sources || [],
          entities: response.entities || [],
          keywords: response.keywords || [],
        };

        addMessage(aiMessage);

        if (response.entities) {
          setCurrentEntities(response.entities);
        }
        if (response.keywords) {
          setCurrentKeywords(response.keywords);
        }

        const sessionsRes = await chatApi.getSessions();
        setSessions(sessionsRes.sessions);
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
        await chatApi.submitFeedback(messageId, feedback);
        updateMessage(messageId, { feedback });
      } catch (error) {
        console.error('Failed to submit feedback:', error);
      }
    },
    [updateMessage]
  );

  const handleFavorite = useCallback(
    async (messageId) => {
      try {
        const response = await chatApi.toggleFavorite(messageId);
        updateMessage(messageId, { isFavorite: response.isFavorite });
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
    [switchSession]
  );

  const handleDeleteSession = useCallback(
    async (sid) => {
      try {
        await chatApi.deleteSession(sid);
        const response = await chatApi.getSessions();
        setSessions(response.sessions);
        if (currentSessionId === sid) {
          if (response.sessions.length > 0) {
            switchSession(response.sessions[0].id);
            loadSessionMessages(response.sessions[0].id);
          } else {
            switchSession(null);
            setMessages([]);
          }
        }
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    },
    [currentSessionId, setSessions, switchSession, setMessages]
  );

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <Sidebar
        onNewChat={handleNewChat}
        onSwitchSession={handleSwitchSession}
        onDeleteSession={handleDeleteSession}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <WelcomeScreen onQuestionClick={handleQuestionClick} />
          ) : (
            <div className="max-w-4xl mx-auto px-4 py-6">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onFeedback={(feedback) => handleFeedback(message.id, feedback)}
                  onFavorite={() => handleFavorite(message.id)}
                  onRegenerate={() => handleRegenerate(message.id)}
                />
              ))}
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
  );
}

function WelcomeScreen({ onQuestionClick }) {
  const quickQuestions = [
    { icon: '🎨', question: '武汉木雕有哪些代表性技法？' },
    { icon: '🧵', question: '汉绣的基本针法有哪些？' },
    { icon: '🏯', question: '黄鹤楼的历史传说有哪些？' },
    { icon: '📜', question: '楚文化的核心特征是什么？' },
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-2xl"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-700 to-amber-600 flex items-center justify-center shadow-lg"
        >
          <MessageSquare size={40} className="text-white" />
        </motion.div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">欢迎使用智能问答</h1>
        <p className="text-gray-600 mb-8">探索非遗文化的数字世界，获取专业的知识解答</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickQuestions.map((item, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              onClick={() => onQuestionClick(item.question)}
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-amber-300 hover:shadow-md transition-all text-left group"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-sm text-gray-900 group-hover:text-amber-700 transition-colors">
                {item.question}
              </span>
            </motion.button>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-xs text-gray-500"
        >
          输入问题开始对话，或点击上方快捷问题快速开始
        </motion.p>
      </motion.div>
    </div>
  );
}
