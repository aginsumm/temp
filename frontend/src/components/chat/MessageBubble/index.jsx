import { useState } from 'react';
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
} from 'lucide-react';

export default function MessageBubble({
  message,
  onFeedback,
  onFavorite,
  onCopy,
  onRegenerate,
  onShowSources,
}) {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === 'user';

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-6`}
    >
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md ${
          isUser
            ? 'bg-gradient-to-br from-amber-700 to-amber-600'
            : 'bg-gradient-to-br from-blue-500 to-blue-700'
        }`}
      >
        {isUser ? (
          <User size={20} className="text-white" />
        ) : (
          <Bot size={20} className="text-white" />
        )}
      </div>

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-600">{isUser ? '您' : '非遗助手'}</span>
          <span className="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
        </div>

        <motion.div
          className={`relative ${
            isUser
              ? 'bg-gradient-to-br from-amber-700 to-amber-600 text-white rounded-2xl rounded-bl-sm px-5 py-4 max-w-[70%] ml-auto shadow-md'
              : 'bg-gradient-to-br from-white to-gray-50 text-gray-900 rounded-2xl rounded-tl-sm px-5 py-4 max-w-[80%] border border-gray-200 shadow-sm'
          }`}
          whileHover={{ scale: 1.01 }}
        >
          {isUser ? (
            <p className="text-white whitespace-pre-wrap">{message.content}</p>
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
                    <p className="text-gray-900 leading-relaxed mb-2 last:mb-0">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside text-gray-900 space-y-1 my-2">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside text-gray-900 space-y-1 my-2">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="text-gray-900">{children}</li>,
                  strong: ({ children }) => (
                    <strong className="font-semibold text-amber-700">{children}</strong>
                  ),
                  code: ({ className, children }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="px-1.5 py-0.5 bg-gray-100 text-amber-700 rounded text-sm font-mono">
                          {children}
                        </code>
                      );
                    }
                    return (
                      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto my-3">
                        <code className="text-sm font-mono">{children}</code>
                      </pre>
                    );
                  },
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-amber-300 pl-4 italic text-gray-600 my-2">
                      {children}
                    </blockquote>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700 underline"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </motion.div>

        {!isUser && (
          <div className="flex items-center gap-1 mt-2">
            <ActionButton
              icon={message.feedback === 'helpful' ? ThumbsUp : ThumbsUp}
              label="有帮助"
              active={message.feedback === 'helpful'}
              onClick={() => onFeedback?.('helpful')}
            />
            <ActionButton
              icon={message.feedback === 'unclear' ? ThumbsDown : ThumbsDown}
              label="不清楚"
              active={message.feedback === 'unclear'}
              onClick={() => onFeedback?.('unclear')}
            />
            <ActionButton
              icon={message.isFavorite ? Star : Star}
              label="收藏"
              active={message.isFavorite}
              onClick={onFavorite}
              filled={message.isFavorite}
            />
            <ActionButton
              icon={copied ? Check : Copy}
              label={copied ? '已复制' : '复制'}
              onClick={handleCopy}
            />
            <ActionButton icon={RefreshCw} label="重新生成" onClick={onRegenerate} />

            {message.sources && message.sources.length > 0 && (
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
              >
                <BookOpen size={14} />
                <span>{message.sources.length}个来源</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform ${showSources ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>
        )}

        <AnimatePresence>
          {showSources && message.sources && message.sources.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 w-full max-w-md"
            >
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                {message.sources.map((source, index) => (
                  <div
                    key={source.id || index}
                    className="p-2 bg-white rounded border border-gray-200 hover:border-amber-300 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {source.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {source.content}
                        </p>
                      </div>
                      {source.page && (
                        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                          第{source.page}页
                        </span>
                      )}
                    </div>
                    {source.relevance && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${source.relevance * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">
                          {Math.round(source.relevance * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ActionButton({ icon: Icon, label, active, onClick, filled }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
        active
          ? 'text-amber-700 bg-amber-50'
          : 'text-gray-500 hover:text-amber-700 hover:bg-amber-50'
      }`}
      title={label}
    >
      <Icon size={14} className={filled ? 'fill-current' : ''} />
    </button>
  );
}
