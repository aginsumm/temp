/**
 * 虚拟滚动消息列表组件
 * 使用 @tanstack/react-virtual 实现高性能消息渲染
 * 支持大量消息的高效加载和显示
 */

import { useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Message } from '../../types/chat';
import UnifiedMessageBubble from '../chat/UnifiedMessageBubble';
import { TypingIndicator } from '../chat/TypingIndicator';

interface VirtualMessageListProps {
  messages: Message[];
  isLoading: boolean;
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
  isLoading,
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

  // 判断是否显示正在输入指示器：
  // 1. 当正在加载且最后一条消息是用户消息时（AI还未开始回复）
  // 2. 或者最后一条消息正在流式传输中且有内容时（AI正在回复且内容已开始显示）
  // 注意：思考中指示器现在显示在AI消息气泡内部，不在底部显示
  // 当消息内容为空时（思考阶段），不显示底部指示器，避免与消息内部的思考中指示器重复
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const shouldShowTypingIndicator =
    (isLoading && lastMessage?.role === 'user') ||
    (lastMessage?.role === 'assistant' && lastMessage?.isStreaming && lastMessage?.content);

  const virtualizer = useVirtualizer({
    count: messages.length + (shouldShowTypingIndicator ? 1 : 0),
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
      const targetIndex = shouldShowTypingIndicator
        ? messages.length // 如果有 typing indicator，滚动到它
        : messages.length - 1;

      virtualizer.scrollToIndex(targetIndex, {
        align: 'end',
        behavior: streamingContent ? 'auto' : 'smooth',
      });
    }
  }, [messages.length, streamingContent, virtualizer, shouldShowTypingIndicator]);

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
          const isTypingIndicatorItem =
            shouldShowTypingIndicator && virtualRow.index === messages.length;

          if (isTypingIndicatorItem) {
            return (
              <div
                key={`typing-indicator-${virtualRow.index}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <TypingIndicator message="正在思考..." />
              </div>
            );
          }

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
              <div className="px-3 py-2">
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
