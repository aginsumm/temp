import { useState, useCallback, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useToast } from '../components/common/Toast';
import { categorizeError } from '../services/errorHandler';
import chatApi from '../api/chat';
import type { Message, Entity, Relation } from '../types/chat';
import type { UploadedFile } from '../components/chat/UnifiedInputArea';

interface UseChatMessageActionsOptions {
  sessionId: string | null;
  quotedMessage: Message | null;
  setQuotedMessage: (message: Message | null) => void;
  onSendMessage?: (content: string, options?: { files?: UploadedFile[] }) => Promise<void>;
}

/**
 * 消息操作自定义 Hook
 * 封装所有消息相关的操作逻辑
 */
export function useChatMessageActions({
  sessionId,
  quotedMessage,
  setQuotedMessage,
  onSendMessage,
}: UseChatMessageActionsOptions) {
  const toast = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    updateMessage,
    deleteMessage,
    addMessageVersion,
    switchMessageVersion,
    editAndRegenerate,
  } = useChatStore();

  // 处理反馈
  const handleFeedback = useCallback(
    async (messageId: string, feedback: 'helpful' | 'unclear') => {
      try {
        await chatApi.submitFeedback(messageId, feedback);
        await updateMessage(messageId, { feedback });
        toast.success('反馈成功', '感谢您的反馈');
      } catch (error) {
        const errorInfo = categorizeError(error);
        toast.error('反馈失败', errorInfo.userMessage);
      }
    },
    [toast, updateMessage]
  );

  // 处理收藏
  const handleFavorite = useCallback(
    async (messageId: string, currentStatus: boolean) => {
      try {
        // 本地先乐观更新，远端失败也不阻塞（仍保留 toast 提示）
        await updateMessage(messageId, { is_favorite: !currentStatus });
        await chatApi.toggleFavorite(messageId);
        toast.success(
          currentStatus ? '已取消收藏' : '已收藏',
          currentStatus ? '消息已取消收藏' : '消息已加入收藏夹'
        );
      } catch (error) {
        const errorInfo = categorizeError(error);
        toast.error('操作失败', errorInfo.userMessage);
      }
    },
    [toast, updateMessage]
  );

  // 处理复制
  const handleCopy = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        toast.success('复制成功', '内容已复制到剪贴板');
      } catch (error) {
        toast.error('复制失败', '请手动复制');
      }
    },
    [toast]
  );

  // 处理重新生成
  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (!sessionId) return;

      try {
        // TODO: 调用后端 API 重新生成
        toast.info('重新生成', '正在重新生成回答...');
      } catch (error) {
        const errorInfo = categorizeError(error);
        toast.error('生成失败', errorInfo.userMessage);
      }
    },
    [sessionId, toast]
  );

  // 处理编辑
  const handleEdit = useCallback(
    async (messageId: string, newContent: string) => {
      if (!newContent.trim()) {
        toast.error('编辑失败', '内容不能为空');
        return;
      }

      try {
        updateMessage(messageId, { content: newContent });
        toast.success('编辑成功', '消息已更新');
      } catch (error) {
        const errorInfo = categorizeError(error);
        toast.error('编辑失败', errorInfo.userMessage);
      }
    },
    [updateMessage, toast]
  );

  // 处理删除
  const handleDelete = useCallback(
    async (messageId: string) => {
      try {
        deleteMessage(messageId);
        toast.success('删除成功', '消息已删除');
      } catch (error) {
        const errorInfo = categorizeError(error);
        toast.error('删除失败', errorInfo.userMessage);
      }
    },
    [deleteMessage, toast]
  );

  // 处理版本切换
  const handleSwitchVersion = useCallback(
    async (messageId: string, versionId: string) => {
      try {
        switchMessageVersion(messageId, versionId);
      } catch (error) {
        const errorInfo = categorizeError(error);
        toast.error('切换失败', errorInfo.userMessage);
      }
    },
    [switchMessageVersion, toast]
  );

  // 处理编辑并重新生成
  const handleEditAndRegenerate = useCallback(
    async (messageId: string, newContent: string) => {
      if (!newContent.trim()) {
        toast.error('编辑失败', '内容不能为空');
        return;
      }

      try {
        editAndRegenerate(messageId, newContent);
        toast.success('已更新并重新生成', '正在生成新的回答...');
      } catch (error) {
        const errorInfo = categorizeError(error);
        toast.error('操作失败', errorInfo.userMessage);
      }
    },
    [editAndRegenerate, toast]
  );

  // 处理引用
  const handleQuote = useCallback(
    (message: Message) => {
      setQuotedMessage(message);
    },
    [setQuotedMessage]
  );

  // 处理停止流式响应
  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    handleFeedback,
    handleFavorite,
    handleCopy,
    handleRegenerate,
    handleEdit,
    handleDelete,
    handleSwitchVersion,
    handleEditAndRegenerate,
    handleQuote,
    handleStopStreaming,
    abortControllerRef,
  };
}
