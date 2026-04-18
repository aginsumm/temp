import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
  Edit3,
  Trash2,
  Code,
  ExternalLink,
} from 'lucide-react';
import { useThemeStore } from '../../../stores/themeStore';
import { useToast } from '../../common/Toast';
import VersionSwitcher from '../VersionSwitcher';
import type { Message } from '../../../types/chat';

interface UnifiedMessageBubbleProps {
  message: Message;
  onFeedback?: (messageId: string, feedback: 'helpful' | 'unclear') => void;
  onFavorite?: (messageId: string, currentStatus: boolean) => void;
  onCopy?: (content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onSwitchVersion?: (messageId: string, versionId: string) => void;
  onEditAndRegenerate?: (messageId: string, newContent: string) => void;
  onSyncVersionForGroup?: (versionGroupId: string, versionIndex: number) => void;
  isHistorical?: boolean;
  isLast?: boolean;
  isStreaming?: boolean;
}

function CodeBlock({
  language,
  children,
  isDark,
  copiedCode,
  onCopyCode,
}: {
  language?: string;
  children: string;
  isDark: boolean;
  copiedCode: string | null;
  onCopyCode: (code: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lines = children.split('\n');
  const shouldCollapse = lines.length > 10;

  return (
    <div className="relative group rounded-lg overflow-hidden my-3">
      <div
        className="flex items-center justify-between px-4 py-2 text-xs"
        style={{
          background: isDark ? '#1e1e1e' : '#f5f5f5',
          color: isDark ? '#8b949e' : '#6e7781',
        }}
      >
        <div className="flex items-center gap-2">
          <Code size={14} />
          <span>{language || 'code'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCopyCode(children)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700/50 transition-colors"
          >
            {copiedCode === children ? (
              <>
                <Check size={12} />
                <span>已复制</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>复制</span>
              </>
            )}
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={isDark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '0.875rem',
          maxHeight: isExpanded ? 'none' : shouldCollapse ? '250px' : 'none',
          overflow: 'hidden',
        }}
        showLineNumbers
      >
        {children}
      </SyntaxHighlighter>
      {shouldCollapse && !isExpanded && (
        <div
          className="absolute bottom-0 left-0 right-0 h-20 flex items-end justify-center pb-2 cursor-pointer"
          style={{
            background: `linear-gradient(transparent, ${isDark ? '#282c34' : '#fafafa'})`,
          }}
          onClick={() => setIsExpanded(true)}
        >
          <button
            className="flex items-center gap-1 text-xs px-3 py-1 rounded-full"
            style={{
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <ChevronDown size={12} />
            展开全部
          </button>
        </div>
      )}
    </div>
  );
}

export default function UnifiedMessageBubble({
  message,
  onFeedback,
  onFavorite,
  onCopy,
  onRegenerate,
  onEdit,
  onDelete,
  onSwitchVersion,
  onEditAndRegenerate,
  onSyncVersionForGroup,
  isHistorical = false,
  isLast = false,
  isStreaming: isStreamingProp = false,
}: UnifiedMessageBubbleProps) {
  const { resolvedMode } = useThemeStore();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [hasCompletedTyping, setHasCompletedTyping] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const isUser = message.role === 'user';
  const isDark = resolvedMode === 'dark';

  const versions = useMemo(() => message.versions || [], [message.versions]);
  const hasVersions = versions.length > 1;
  const isCurrentlyStreaming = isStreamingProp || message.isStreaming;
  const displayedContent = message.content;

  // 动态计算当前版本索引，确保与 store 状态同步
  const currentVersionIndex = useMemo(() => {
    if (versions.length === 0) return 0;
    const index = versions.findIndex((v) => v.is_current);
    return index !== -1 ? index : 0;
  }, [versions]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (bubbleRef.current) {
      observer.observe(bubbleRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (hasInitialized) return;

    if (isUser || isHistorical) {
      setShowActions(true);
      setHasCompletedTyping(true);
      setHasInitialized(true);
      return;
    }

    if (isCurrentlyStreaming) {
      setShowActions(false);
      setHasInitialized(true);
      return;
    }

    setShowActions(true);
    setHasCompletedTyping(true);
    setHasInitialized(true);
  }, [isUser, isHistorical, isLast, hasInitialized, isCurrentlyStreaming]);

  useEffect(() => {
    if (isCurrentlyStreaming) {
      setHasCompletedTyping(false);
      setShowActions(false);
    } else if (hasInitialized && !hasCompletedTyping) {
      setShowActions(true);
      setHasCompletedTyping(true);
    }
  }, [isCurrentlyStreaming, hasInitialized, hasCompletedTyping]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(message.content);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleEdit = () => {
    if (!editContent.trim()) {
      toast.error('编辑失败', '内容不能为空');
      return;
    }

    if (editContent === message.content) {
      toast.info('未做修改', '内容与原版本相同');
      setIsEditing(false);
      return;
    }

    if (isUser && onEditAndRegenerate) {
      onEditAndRegenerate(message.id, editContent);
    } else {
      onEdit?.(message.id, editContent);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(message.content);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleEdit();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div
      ref={bubbleRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''} mb-3`}
    >
      <motion.div
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm`}
        style={{
          background: isUser
            ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)'
            : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        }}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-white" />
        )}
      </motion.div>

      <div className={`flex-1 ${isUser ? 'flex flex-col items-end' : ''}`}>
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : ''}`}>
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {isUser ? '我' : 'AI 助手'}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {formatTime(message.created_at)}
          </span>
          {isCurrentlyStreaming && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
              }}
            >
              接收中
            </motion.span>
          )}
        </div>

        <div
          ref={bubbleRef}
          className={`relative rounded-xl px-3 py-2.5 ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
          style={{
            background: isUser
              ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)'
              : 'var(--color-surface)',
            border: isUser ? 'none' : '1px solid var(--color-border)',
            color: isUser ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
            boxShadow: isUser
              ? '0 2px 12px -2px var(--color-primary)'
              : '0 1px 4px -1px rgba(0, 0, 0, 0.05)',
            display: 'inline-block',
            maxWidth: isUser ? '80%' : '100%',
            textAlign: 'left',
            wordBreak: 'break-word',
          }}
        >
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-3 rounded-lg resize-none"
                style={{
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text-primary)',
                  minHeight: '100px',
                }}
                autoFocus
              />
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Ctrl/Cmd + Enter 保存并重新生成 · Esc 取消
                </span>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(message.content);
                    }}
                    className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                    style={{
                      background: 'var(--color-background-secondary)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      if (editContent.trim() && editContent !== message.content) {
                        onEdit?.(message.id, editContent);
                      }
                      setIsEditing(false);
                    }}
                    className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                    style={{
                      background: 'var(--color-background-secondary)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    仅保存
                  </button>
                  <button
                    onClick={handleEdit}
                    className="px-3 py-1.5 rounded-lg text-sm text-white transition-colors"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    保存并重新生成
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    if (match) {
                      return (
                        <CodeBlock
                          language={match[1]}
                          isDark={isDark}
                          copiedCode={copiedCode}
                          onCopyCode={handleCopyCode}
                        >
                          {String(children).replace(/\n$/, '')}
                        </CodeBlock>
                      );
                    }
                    return (
                      <code
                        className="px-1.5 py-0.5 rounded text-sm font-mono"
                        style={{ background: 'var(--color-background-secondary)' }}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  a: ({ children, href, ...props }) => {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center gap-1"
                        {...props}
                      >
                        {children}
                        <ExternalLink size={12} />
                      </a>
                    );
                  },
                }}
              >
                {displayedContent}
              </ReactMarkdown>
            </div>
          )}

          {isCurrentlyStreaming && (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="inline-block w-0.5 h-4 ml-0.5 rounded-sm align-middle"
              style={{ background: 'var(--color-primary)' }}
            />
          )}
        </div>

        {(hasVersions || message.is_edited) && (
          <VersionSwitcher
            versions={versions}
            currentIndex={currentVersionIndex}
            isEdited={message.is_edited}
            onSwitch={(versionId, index) => {
              onSwitchVersion?.(message.id, versionId);

              if (message.version_group_id && onSyncVersionForGroup) {
                onSyncVersionForGroup(message.version_group_id, index);
              }
            }}
            isUser={isUser}
          />
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-all hover:shadow-md"
              style={{
                color: 'var(--color-text-secondary)',
                background: showSources
                  ? 'var(--color-primary-alpha)'
                  : 'var(--color-background-secondary)',
                border: `1px solid ${showSources ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
            >
              <BookOpen size={14} />
              <span className="font-medium">查看 {message.sources.length} 个参考来源</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showSources ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 space-y-3"
                >
                  {message.sources.map((source, index) => (
                    <motion.div
                      key={source.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 rounded-xl border transition-all hover:shadow-lg"
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                              background: 'var(--color-primary-alpha)',
                              color: 'var(--color-primary)',
                            }}
                          >
                            {index + 1}
                          </div>
                          <span
                            className="text-sm font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {source.title}
                          </span>
                        </div>
                        {source.relevance && (
                          <div
                            className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{
                              background:
                                source.relevance >= 0.9
                                  ? 'var(--color-success-alpha)'
                                  : source.relevance >= 0.7
                                    ? 'var(--color-warning-alpha)'
                                    : 'var(--color-background-secondary)',
                              color:
                                source.relevance >= 0.9
                                  ? 'var(--color-success)'
                                  : source.relevance >= 0.7
                                    ? 'var(--color-warning)'
                                    : 'var(--color-text-muted)',
                            }}
                          >
                            相关度 {Math.round(source.relevance * 100)}%
                          </div>
                        )}
                      </div>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {source.content}
                      </p>
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium hover:underline"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          <ExternalLink size={12} />
                          查看原文
                        </a>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence>
          {showActions && !isEditing && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center gap-0.5 mt-2 ${isUser ? 'justify-end' : ''}`}
            >
              {!isUser && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onFeedback?.(message.id, 'helpful')}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{
                      color:
                        message.feedback === 'helpful'
                          ? 'var(--color-success)'
                          : 'var(--color-text-muted)',
                      background:
                        message.feedback === 'helpful' ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                    }}
                    title="有帮助"
                  >
                    <ThumbsUp size={14} />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onFeedback?.(message.id, 'unclear')}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{
                      color:
                        message.feedback === 'unclear'
                          ? 'var(--color-error)'
                          : 'var(--color-text-muted)',
                      background:
                        message.feedback === 'unclear' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    }}
                    title="需改进"
                  >
                    <ThumbsDown size={14} />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onFavorite?.(message.id, message.is_favorite || false)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{
                      color: message.is_favorite
                        ? 'var(--color-accent)'
                        : 'var(--color-text-muted)',
                      background: message.is_favorite ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                    }}
                    title={message.is_favorite ? '取消收藏' : '收藏'}
                  >
                    <Star size={14} fill={message.is_favorite ? 'currentColor' : 'none'} />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onRegenerate?.(message.id)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="重新生成"
                  >
                    <RefreshCw size={14} />
                  </motion.button>
                </>
              )}

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleCopy}
                className="p-1.5 rounded-lg transition-colors"
                style={{
                  color: copied ? 'var(--color-success)' : 'var(--color-text-muted)',
                  background: copied ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                }}
                title="复制"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </motion.button>

              {isUser && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                  title="编辑"
                >
                  <Edit3 size={14} />
                </motion.button>
              )}

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onDelete?.(message.id)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--color-error)' }}
                title="删除"
              >
                <Trash2 size={14} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
