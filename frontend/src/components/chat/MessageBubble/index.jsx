import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ThumbsUp,
  ThumbsDown,
  Star,
  Copy,
  RefreshCw,
  ChevronDown,
  BookOpen,
  User,
  Bot,
  Check,
  Sparkles,
} from 'lucide-react';

export default function MessageBubble({
  message,
  onFeedback,
  onFavorite,
  onCopy,
  onRegenerate,
  isHistorical = false,
}) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [displayedContent, setDisplayedContent] = useState('');
  const [showActions, setShowActions] = useState(false);
  const bubbleRef = useRef(null);
  const isUser = message.role === 'user';

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
      }
    );

    if (bubbleRef.current) {
      observer.observe(bubbleRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isUser && isVisible && message.content) {
      if (isHistorical) {
        setDisplayedContent(message.content);
        setShowActions(true);
      } else {
        setIsTyping(true);
        setDisplayedContent('');
        let index = 0;
        const content = message.content;
        const interval = setInterval(() => {
          if (index < content.length) {
            setDisplayedContent(content.slice(0, index + 1));
            index++;
          } else {
            clearInterval(interval);
            setIsTyping(false);
            setTimeout(() => setShowActions(true), 300);
          }
        }, 15);

        return () => clearInterval(interval);
      }
    } else if (isUser) {
      setDisplayedContent(message.content);
      setShowActions(true);
    }
  }, [isVisible, message.content, isUser, isHistorical]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.();
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <motion.div
      ref={bubbleRef}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={isVisible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 30, scale: 0.95 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-8`}
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={isVisible ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -180 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
          isUser
            ? 'bg-gradient-to-br from-amber-600 via-amber-700 to-orange-600'
            : 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600'
        }`}
        style={{
          boxShadow: isUser
            ? '0 8px 24px rgba(217, 119, 6, 0.3)'
            : '0 8px 24px rgba(59, 130, 246, 0.3)',
        }}
      >
        {isUser ? (
          <User size={22} className="text-white" />
        ) : (
          <Bot size={22} className="text-white" />
        )}
      </motion.div>

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
        <motion.div
          initial={{ opacity: 0, x: isUser ? 20 : -20 }}
          animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: isUser ? 20 : -20 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-3 mb-2"
        >
          <span className="text-sm font-semibold text-gray-700">{isUser ? '您' : '非遗助手'}</span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {formatTime(message.createdAt)}
          </span>
          {!isUser && isTyping && (
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center gap-1 text-xs text-blue-500"
            >
              <Sparkles size={12} />
              <span>正在输入</span>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          className={`relative ${
            isUser
              ? 'bg-gradient-to-br from-amber-600 via-amber-700 to-orange-600 text-white rounded-3xl rounded-br-lg px-6 py-4 shadow-xl'
              : 'bg-white text-gray-900 rounded-3xl rounded-bl-lg px-6 py-4 border border-gray-100 shadow-xl'
          }`}
          style={{
            boxShadow: isUser
              ? '0 12px 32px rgba(217, 119, 6, 0.25), 0 4px 12px rgba(217, 119, 6, 0.15)'
              : '0 12px 32px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)',
          }}
          whileHover={{ scale: 1.01, y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          {!isUser && (
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-t-3xl opacity-50" />
          )}
          {isUser && (
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 rounded-t-3xl opacity-50" />
          )}

          {isUser ? (
            <p className="text-white whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-xl font-bold text-gray-900 mb-3 mt-4 first:mt-0">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-lg font-semibold text-gray-900 mb-2 mt-3 first:mt-0">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-medium text-gray-900 mb-2 mt-2">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-gray-800 leading-relaxed mb-2 last:mb-0">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside text-gray-800 space-y-1 my-2">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside text-gray-800 space-y-1 my-2">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="text-gray-800">{children}</li>,
                  strong: ({ children }) => (
                    <strong className="font-semibold text-amber-700">{children}</strong>
                  ),
                  code: ({ className, children }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="px-2 py-1 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 rounded-lg text-sm font-mono border border-amber-100">
                          {children}
                        </code>
                      );
                    }
                    return (
                      <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto my-3 shadow-lg">
                        <code className="text-sm font-mono">{children}</code>
                      </pre>
                    );
                  },
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-amber-400 pl-4 italic text-gray-600 my-3 bg-amber-50 py-2 rounded-r-lg">
                      {children}
                    </blockquote>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {displayedContent}
              </ReactMarkdown>
              {isTyping && (
                <motion.span
                  animate={{ opacity: [0, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                  className="inline-block w-2 h-5 bg-blue-500 ml-1 rounded"
                />
              )}
            </div>
          )}
        </motion.div>

        <AnimatePresence>
          {!isUser && showActions && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 mt-3"
            >
              <ActionButton
                icon={message.feedback === 'helpful' ? ThumbsUp : ThumbsUp}
                label="有帮助"
                active={message.feedback === 'helpful'}
                onClick={() => onFeedback?.('helpful')}
                color="green"
              />
              <ActionButton
                icon={message.feedback === 'unclear' ? ThumbsDown : ThumbsDown}
                label="不清楚"
                active={message.feedback === 'unclear'}
                onClick={() => onFeedback?.('unclear')}
                color="red"
              />
              <ActionButton
                icon={message.isFavorite ? Star : Star}
                label="收藏"
                active={message.isFavorite}
                onClick={onFavorite}
                filled={message.isFavorite}
                color="yellow"
              />
              <ActionButton
                icon={copied ? Check : Copy}
                label={copied ? '已复制' : '复制'}
                onClick={handleCopy}
                color="blue"
              />
              <ActionButton
                icon={RefreshCw}
                label="重新生成"
                onClick={onRegenerate}
                color="purple"
              />

              {message.sources && message.sources.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSources(!showSources)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-full transition-all border border-amber-200"
                >
                  <BookOpen size={14} />
                  <span>{message.sources.length}个来源</span>
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${showSources ? 'rotate-180' : ''}`}
                  />
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSources && message.sources && message.sources.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="mt-3 w-full max-w-lg"
            >
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 space-y-3 border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <BookOpen size={16} className="text-amber-600" />
                  知识来源
                </h4>
                {message.sources.map((source, index) => (
                  <motion.div
                    key={source.id || index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 bg-white rounded-xl border border-gray-200 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-amber-700 transition-colors">
                          {source.title}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{source.content}</p>
                      </div>
                      {source.page && (
                        <span className="text-xs text-amber-600 ml-2 flex-shrink-0 bg-amber-50 px-2 py-1 rounded-full font-medium">
                          第{source.page}页
                        </span>
                      )}
                    </div>
                    {source.relevance && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${source.relevance * 100}%` }}
                            transition={{ delay: 0.5, duration: 0.8 }}
                            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                          />
                        </div>
                        <span className="text-xs text-gray-600 font-medium">
                          {Math.round(source.relevance * 100)}%
                        </span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ActionButton({ icon: Icon, label, active, onClick, filled, color }) {
  const colorMap = {
    green: {
      active: 'text-green-600 bg-green-50 border-green-200',
      hover: 'hover:text-green-600 hover:bg-green-50 hover:border-green-200',
    },
    red: {
      active: 'text-red-600 bg-red-50 border-red-200',
      hover: 'hover:text-red-600 hover:bg-red-50 hover:border-red-200',
    },
    yellow: {
      active: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      hover: 'hover:text-yellow-600 hover:bg-yellow-50 hover:border-yellow-200',
    },
    blue: {
      active: 'text-blue-600 bg-blue-50 border-blue-200',
      hover: 'hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200',
    },
    purple: {
      active: 'text-purple-600 bg-purple-50 border-purple-200',
      hover: 'hover:text-purple-600 hover:bg-purple-50 hover:border-purple-200',
    },
  };

  const colors = colorMap[color] || colorMap.blue;

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
        active ? colors.active : `text-gray-600 bg-white border-gray-200 ${colors.hover}`
      }`}
      title={label}
    >
      <Icon size={14} className={filled ? 'fill-current' : ''} />
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
  );
}
