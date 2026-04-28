/**
 * 虚拟滚动消息列表组件
 * 使用 @tanstack/react-virtual 实现高性能消息渲染
 * 支持大量消息的高效加载和显示
 */

import { useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Message } from '../../types/chat';
import UnifiedMessageBubble from '../chat/UnifiedMessageBubble';

interface VirtualMessageListProps {
  messages: Message[];
  isThinking?: boolean;
  streamingContent?: string;
  newMessageIds: Set<string>;
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
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onScroll?: (scrollTop: number) => void;
}

export function VirtualMessageList({
  messages,
  isThinking = false,
  streamingContent,
  newMessageIds,
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
  messagesEndRef,
  onScroll,
}: VirtualMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const estimateSize = useCallback(() => 120, []);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize,
    overscan: 5,
    paddingStart: 16,
    paddingEnd: 16,
  });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleScroll = () => {
      if (onScroll) {
        onScroll(element.scrollTop);
      }

      const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;

      isUserScrollingRef.current = !isAtBottom;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        const isNowAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
        if (isNowAtBottom) {
          isUserScrollingRef.current = false;
        }
      }, 500);
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      element.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [onScroll]);

  // 自动滚动到底部 - 修复：在消息变化或流式内容更新时滚动
  useEffect(() => {
    const shouldScroll = !isUserScrollingRef.current;
    if (shouldScroll) {
      virtualizer.scrollToIndex(messages.length - 1, {
        align: 'end',
        behavior: streamingContent ? 'auto' : 'smooth',
      });
    }
  }, [messages.length, streamingContent, virtualizer]);

  return (
    <div ref={containerRef} className="overflow-auto" style={{ height: '100%' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index];
          if (!message) return null;

          const isLast = virtualRow.index === messages.length - 1;
          // 只有最后一条AI消息且正在思考时才显示思考中指示器
          const showThinkingForThisMessage = isThinking && isLast && message.role === 'assistant';

          return (
            <div
              key={message.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="px-4 py-3">
                <UnifiedMessageBubble
                  message={message}
                  onFeedback={onFeedback}
                  onFavorite={onFavorite}
                  onCopy={onCopy}
                  onRegenerate={onRegenerate}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onSwitchVersion={onSwitchVersion}
                  onEditAndRegenerate={onEditAndRegenerate}
                  onSyncVersionForGroup={onSyncVersionForGroup}
                  onQuote={onQuote}
                  isHistorical={!newMessageIds.has(message.id)}
                  isLast={isLast}
                  isStreaming={message.isStreaming === true}
                  isThinking={showThinkingForThisMessage}
                />
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
