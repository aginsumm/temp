import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
// Framer Motion 已移除，使用 CSS 动画替代
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
  Volume2,
  Pause,
  Play,
  X,
  Quote,
} from 'lucide-react';
import { useThemeStore } from '../../../stores/themeStore';
import { useToast } from '../../common/Toast';
import { speechSynthesisService } from '../../../services/speechSynthesisService';
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
  onQuote?: (message: Message) => void;
  isHistorical?: boolean;
  isLast?: boolean;
  isStreaming?: boolean;
  isThinking?: boolean;
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
  onQuote,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isHistorical = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isLast = false,
  isStreaming: isStreamingProp = false,
  isThinking = false,
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // 当消息内容变化时重置编辑内容
  useEffect(() => {
    setEditContent(message.content);
  }, [message.content, message.id]);
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

  // 简化的可见性控制 - 立即显示，不使用 IntersectionObserver 避免闪烁
  useEffect(() => {
    setIsVisible(true);
  }, []);

  // 操作按钮显示逻辑
  useEffect(() => {
    // 流式响应时不显示操作按钮
    if (isCurrentlyStreaming) {
      setShowActions(false);
      return;
    }

    // 非流式状态下，用户消息始终显示操作按钮
    // AI消息在流式完成后显示操作按钮
    setShowActions(true);
  }, [isUser, isCurrentlyStreaming]);

  // 清理语音合成
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        speechSynthesisService.stop();
      }
    };
  }, [isSpeaking]);

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

  const handleSpeak = () => {
    if (!message.content || message.content.trim().length === 0) return;

    if (isSpeaking) {
      if (isPaused) {
        speechSynthesisService.resume();
        setIsPaused(false);
      } else {
        speechSynthesisService.pause();
        setIsPaused(true);
      }
    } else {
      const success = speechSynthesisService.speak(message.content);
      if (success) {
        setIsSpeaking(true);
        setIsPaused(false);
      } else {
        toast.error('朗读失败', '浏览器不支持语音合成');
      }
    }
  };

  // 监听语音合成事件 - 只在当前消息正在朗读时更新状态
  useEffect(() => {
    const handleStart = () => {
      // 只有当当前消息正在朗读时才更新状态
      if (speechSynthesisService.getState() === 'speaking') {
        setIsSpeaking(true);
        setIsPaused(false);
      }
    };
    const handleEnd = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    const handleError = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    speechSynthesisService.on('start', handleStart);
    speechSynthesisService.on('end', handleEnd);
    speechSynthesisService.on('error', handleError);

    return () => {
      speechSynthesisService.off('start', handleStart);
      speechSynthesisService.off('end', handleEnd);
      speechSynthesisService.off('error', handleError);
    };
  }, []);

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
    <div
      ref={bubbleRef}
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''} mb-3 transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-transform duration-200 hover:scale-105`}
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
      </div>

      <div className={`flex-1 ${isUser ? 'flex flex-col items-end' : ''}`}>
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : ''}`}>
          <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
            {isUser ? '我' : 'AI 助手'}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {formatTime(message.created_at)}
          </span>
          {isCurrentlyStreaming && (
            <span
              className="text-xs px-2 py-0.5 rounded-full animate-pulse"
              style={{
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
              }}
            >
              接收中
            </span>
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
          {/* 思考中指示器 - 显示在AI消息内容上方 */}
          {isThinking && !isUser && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--color-background-secondary)' }}>
              <div className="flex gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: 'var(--color-primary)', animationDelay: '0ms' }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: 'var(--color-primary)', animationDelay: '150ms' }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: 'var(--color-primary)', animationDelay: '300ms' }}
                />
              </div>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                思考中...
              </span>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-3">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--color-primary-alpha)',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-primary)',
                }}
              >
                <Edit3 size={14} />
                <span className="font-medium">正在编辑消息</span>
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full p-3 rounded-lg resize-none"
                style={{
                  background: 'var(--color-background-secondary)',
                  color: 'var(--color-text-primary)',
                  minHeight: '100px',
                  border: '2px solid var(--color-primary)',
                }}
                autoFocus
              />
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Ctrl/Cmd + Enter 保存并重新生成 · Esc 取消
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(message.content);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors"
                    style={{
                      background: 'var(--color-background-secondary)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <X size={14} />
                    <span>取消</span>
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
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
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
            <span
              className="inline-block w-0.5 h-4 ml-0.5 rounded-sm align-middle animate-pulse"
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

            {showSources && (
              <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                {message.sources.map((source, index) => (
                  <div
                    key={source.id}
                    className="p-4 rounded-xl border transition-all hover:shadow-lg animate-in fade-in slide-in-from-left-2 duration-200"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      animationDelay: `${index * 50}ms`,
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
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showActions && !isEditing && (
          <div
            className={`flex items-center gap-0.5 mt-2 animate-in fade-in slide-in-from-top-2 duration-200 ${isUser ? 'justify-end' : ''}`}
          >
            {!isUser && (
              <>
                <button
                  disabled={isCurrentlyStreaming}
                  onClick={() => onFeedback?.(message.id, 'helpful')}
                  className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-90 disabled:hover:scale-100"
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
                </button>

                <button
                  disabled={isCurrentlyStreaming}
                  onClick={() => onFeedback?.(message.id, 'unclear')}
                  className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-90 disabled:hover:scale-100"
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
                </button>

                <button
                  disabled={isCurrentlyStreaming}
                  onClick={() => onFavorite?.(message.id, message.is_favorite || false)}
                  className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-90 disabled:hover:scale-100"
                  style={{
                    color: message.is_favorite ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    background: message.is_favorite ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                  }}
                  title={message.is_favorite ? '取消收藏' : '收藏'}
                >
                  <Star size={14} fill={message.is_favorite ? 'currentColor' : 'none'} />
                </button>

                <button
                  disabled={isCurrentlyStreaming}
                  onClick={() => onRegenerate?.(message.id)}
                  className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-90 disabled:hover:scale-100"
                  style={{ color: 'var(--color-text-muted)' }}
                  title="重新生成"
                >
                  <RefreshCw size={14} />
                </button>
              </>
            )}

            <button
              disabled={isCurrentlyStreaming}
              onClick={handleCopy}
              className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-90 disabled:hover:scale-100"
              style={{
                color: copied ? 'var(--color-success)' : 'var(--color-text-muted)',
                background: copied ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
              }}
              title="复制"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>

            <button
              disabled={isCurrentlyStreaming}
              onClick={() => onQuote?.(message)}
              className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-90 disabled:hover:scale-100"
              style={{ color: 'var(--color-text-muted)' }}
              title="引用回复"
            >
              <Quote size={14} />
            </button>

            {!isUser && (
              <button
                disabled={isCurrentlyStreaming}
                onClick={handleSpeak}
                className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-90 disabled:hover:scale-100"
                style={{
                  color: isSpeaking ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  background: isSpeaking ? 'var(--color-primary-alpha)' : 'transparent',
                }}
                title={isSpeaking ? (isPaused ? '继续朗读' : '暂停朗读') : '朗读'}
              >
                {isSpeaking ? (
                  isPaused ? (
                    <Play size={14} />
                  ) : (
                    <Pause size={14} />
                  )
                ) : (
                  <Volume2 size={14} />
                )}
              </button>
            )}

            {isUser && (
              <button
                disabled={isCurrentlyStreaming}
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-90 disabled:hover:scale-100"
                style={{ color: 'var(--color-text-muted)' }}
                title="编辑"
              >
                <Edit3 size={14} />
              </button>
            )}

            <button
              disabled={isCurrentlyStreaming}
              onClick={() => onDelete?.(message.id)}
              className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-90 disabled:hover:scale-100"
              style={{ color: 'var(--color-error)' }}
              title="删除"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
