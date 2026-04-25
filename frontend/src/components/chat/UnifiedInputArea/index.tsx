import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Square, Paperclip, File, X, Image, FileText, ChevronUp } from 'lucide-react';
import { inputHistoryService, type HistoryItem } from '../../../services/inputHistoryService';

const MAX_CHARS = 4000;
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'document' | 'other';
  uploadProgress?: number; // 上传进度 0-100
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'error';
}

interface UnifiedInputAreaProps {
  onSend: (
    content: string,
    options?: { command?: string; files?: UploadedFile[] }
  ) => void | Promise<void>;
  isLoading?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  disabled?: boolean;
  onStop?: () => void;
  autoFocus?: boolean;
  sessionId?: string;
}

export default function UnifiedInputArea({
  onSend,
  isLoading = false,
  isStreaming = false,
  placeholder = '输入您的问题，探索非遗文化...',
  disabled = false,
  onStop,
  autoFocus = false,
  sessionId,
}: UnifiedInputAreaProps) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // 输入历史功能
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [showHistoryHint, setShowHistoryHint] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSendingRef = useRef(false);
  const sessionIdRef = useRef<string | undefined>(sessionId);

  // 更新 sessionIdRef 并在切换会话时重置历史索引
  useEffect(() => {
    sessionIdRef.current = sessionId;
    // 切换会话时重置历史索引，防止访问错误的历史记录
    setHistoryIndex(-1);
    setShowHistoryHint(false);
  }, [sessionId]);

  // 加载输入历史
  useEffect(() => {
    const loadHistory = () => {
      const items = inputHistoryService.getRecentHistory(50);
      setHistoryItems(items);
    };
    loadHistory();

    const unsubscribe = inputHistoryService.subscribe(loadHistory);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const errors: string[] = [];

      Array.from(files).forEach((file) => {
        if (uploadedFiles.length >= MAX_FILES) {
          errors.push(`最多只能上传 ${MAX_FILES} 个文件`);
          return;
        }

        if (file.size > MAX_FILE_SIZE) {
          errors.push(`文件 ${file.name} 超过 ${MAX_FILE_SIZE / 1024 / 1024}MB 限制`);
          return;
        }

        const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const isImage = file.type.startsWith('image/');
        const isText =
          file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md');

        // 创建初始文件对象（上传中状态）
        const newFile: UploadedFile = {
          id: fileId,
          file,
          type: isImage ? 'image' : isText ? 'document' : 'other',
          uploadProgress: 0,
          uploadStatus: 'uploading',
        };

        setUploadedFiles((prev) => [...prev, newFile]);

        const reader = new FileReader();

        // 监听进度事件
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadedFiles((prev) =>
              prev.map((f) => (f.id === fileId ? { ...f, uploadProgress: progress } : f))
            );
          }
        };

        reader.onload = (e) => {
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? {
                    ...f,
                    preview: isImage || isText ? (e.target?.result as string) : undefined,
                    uploadProgress: 100,
                    uploadStatus: 'completed',
                  }
                : f
            )
          );
        };

        reader.onerror = () => {
          setUploadedFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, uploadStatus: 'error' } : f))
          );
          console.error(`Failed to read file: ${file.name}`);
        };

        if (isImage || isText) {
          reader.readAsDataURL(file);
        } else {
          // 非图片/文本文件直接标记为完成
          setUploadedFiles((prev) =>
            prev.map((f) =>
              f.id === fileId ? { ...f, uploadProgress: 100, uploadStatus: 'completed' } : f
            )
          );
        }
      });

      if (errors.length > 0) {
        console.warn('File upload errors:', errors);
      }
    },
    [uploadedFiles.length]
  );

  const handleRemoveFile = useCallback((fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files);
      }
    },
    [handleFileSelect]
  );

  const handleSend = useCallback(() => {
    const finalContent = inputValue.trim();
    if (
      (!finalContent && uploadedFiles.length === 0) ||
      disabled ||
      isLoading ||
      isSendingRef.current
    )
      return;

    isSendingRef.current = true;

    // 保存到输入历史
    inputHistoryService.addInput(finalContent, sessionIdRef.current);

    const result = onSend(finalContent, {
      files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
    });

    if (result instanceof Promise) {
      result.finally(() => {
        isSendingRef.current = false;
      });
    } else {
      setTimeout(() => {
        isSendingRef.current = false;
      }, 100);
    }

    setInputValue('');
    setCharCount(0);
    setUploadedFiles([]);
    setHistoryIndex(-1); // 重置历史索引
  }, [inputValue, uploadedFiles, disabled, isLoading, onSend]);

  // 处理键盘导航（输入历史）- 简化的导航逻辑
  const handleNavigateHistory = useCallback(
    (direction: 'up' | 'down') => {
      if (historyItems.length === 0) return;

      setHistoryIndex((prevIndex) => {
        let newIndex = prevIndex;

        if (direction === 'up') {
          // 向上导航：显示更早的历史记录
          newIndex = prevIndex < historyItems.length - 1 ? prevIndex + 1 : prevIndex;
        } else {
          // 向下导航：显示更新的历史记录
          if (prevIndex > 0) {
            newIndex = prevIndex - 1;
          } else if (prevIndex === 0) {
            // 回到当前输入（清空）
            setInputValue('');
            setShowHistoryHint(false);
            return -1;
          }
        }

        if (newIndex >= 0 && newIndex < historyItems.length) {
          const item = historyItems[newIndex];
          setInputValue(item.text);
          setShowHistoryHint(true);
          // 延长提示显示时间
          setTimeout(() => setShowHistoryHint(false), 3000);
        }

        return newIndex;
      });
    },
    [historyItems]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 🌟 拦截中文输入法回车误触
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }

    // 输入历史导航 - 简化的触发条件
    if (e.key === 'ArrowUp' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
      // 当输入框为空或光标在开头时，向上导航历史
      if (!inputValue.trim() || (textareaRef.current && textareaRef.current.selectionStart === 0)) {
        e.preventDefault();
        handleNavigateHistory('up');
      }
    }

    if (e.key === 'ArrowDown' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
      // 当正在浏览历史时，向下导航
      if (historyIndex >= 0) {
        e.preventDefault();
        handleNavigateHistory('down');
      }
    }

    // ESC 清除历史导航
    if (e.key === 'Escape') {
      setHistoryIndex(-1);
      setInputValue('');
      textareaRef.current?.blur();
    }
  };

  const charCountColor = useMemo(() => {
    if (charCount > MAX_CHARS * 0.9) return 'var(--color-error)';
    if (charCount > MAX_CHARS * 0.7) return 'var(--color-warning)';
    return 'var(--color-text-muted)';
  }, [charCount]);

  return (
    <div className="relative w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div
        ref={inputRef}
        className="relative rounded-2xl overflow-hidden transition-shadow duration-300"
        style={{
          boxShadow:
            isFocused || isDragOver
              ? '0 8px 32px rgba(59, 130, 246, 0.2), 0 0 0 2px var(--color-primary)'
              : '0 2px 8px rgba(0, 0, 0, 0.05)',
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center animate-in fade-in duration-200"
            style={{
              background: 'var(--color-primary-alpha)',
              border: '2px dashed var(--color-primary)',
            }}
          >
            <div className="flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
              <Paperclip size={32} />
              <span className="text-lg font-medium">拖拽文件到此处上传</span>
            </div>
          </div>
        )}

        <div
          className={`relative p-3 transition-all duration-300 ${isFocused ? 'ring-2 ring-blue-500/20' : ''}`}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          {uploadedFiles.length > 0 && (
            <div className="mb-2 overflow-hidden transition-all duration-300">
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex flex-col gap-1 px-2 py-1.5 rounded-lg text-xs min-w-[140px] transition-all duration-200"
                    style={{
                      background: 'var(--color-background-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      {file.type === 'image' ? (
                        <Image size={14} style={{ color: 'var(--color-primary)' }} />
                      ) : file.type === 'document' ? (
                        <FileText size={14} style={{ color: 'var(--color-success)' }} />
                      ) : (
                        <File size={14} style={{ color: 'var(--color-text-muted)' }} />
                      )}
                      <span
                        className="max-w-[100px] truncate"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {file.file.name}
                      </span>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 transition-colors ml-auto"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    {/* 上传进度条 */}
                    {file.uploadStatus === 'uploading' && (
                      <div className="w-full">
                        <div
                          className="h-1 rounded-full overflow-hidden"
                          style={{ background: 'var(--color-border)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              background: 'var(--color-primary)',
                              width: `${file.uploadProgress || 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                          {file.uploadProgress || 0}%
                        </span>
                      </div>
                    )}
                    {/* 错误状态 */}
                    {file.uploadStatus === 'error' && (
                      <span className="text-[10px] text-red-500">上传失败</span>
                    )}
                    {/* 完成状态显示文件大小 */}
                    {file.uploadStatus === 'completed' && (
                      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                        {(file.file.size / 1024).toFixed(1)}KB
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              {showHistoryHint && historyIndex >= 0 && (
                <div className="absolute -top-8 left-0 flex items-center gap-2 px-2 py-1 rounded bg-blue-500 text-white text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <ChevronUp size={12} />
                  <span>
                    历史记录 {historyIndex + 1}/{historyItems.length}
                  </span>
                  <ChevronUp size={12} />
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setCharCount(e.target.value.length);
                  // 用户手动编辑时清除历史导航
                  if (historyIndex !== -1) {
                    setHistoryIndex(-1);
                  }
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder}
                disabled={disabled || isLoading || isStreaming}
                rows={1}
                className="w-full px-3 py-2 bg-transparent outline-none resize-none disabled:opacity-50"
                style={{
                  color: 'var(--color-text-primary)',
                  minHeight: '44px',
                  maxHeight: '200px',
                }}
              />

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,text/*,.pdf,.doc,.docx"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* 文件上传按钮 */}
              {!isLoading && !isStreaming && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || uploadedFiles.length >= MAX_FILES}
                  className="p-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    background: 'var(--color-background-secondary)',
                    color: 'var(--color-text-muted)',
                  }}
                  title="上传文件"
                >
                  <Paperclip size={18} />
                </button>
              )}

              {charCount > 0 && (
                <span
                  className="text-xs animate-in fade-in duration-200"
                  style={{ color: charCountColor }}
                >
                  {charCount}/{MAX_CHARS}
                </span>
              )}

              {isLoading || isStreaming ? (
                <button
                  onClick={onStop}
                  className="p-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ background: 'var(--color-error)', color: 'white' }}
                  title="停止生成"
                >
                  <Square size={18} fill="white" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={disabled || !inputValue.trim() || charCount > MAX_CHARS}
                  className="p-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    background:
                      disabled || !inputValue.trim() || charCount > MAX_CHARS
                        ? 'var(--color-background-secondary)'
                        : 'var(--color-primary)',
                    color:
                      disabled || !inputValue.trim() || charCount > MAX_CHARS
                        ? 'var(--color-text-muted)'
                        : 'white',
                  }}
                  title="发送"
                >
                  <Send size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-center gap-4 mt-3 text-xs animate-in fade-in duration-500 delay-300"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <span>Enter 发送</span>
        <span>Shift + Enter 换行</span>
        <span>↑↓ 浏览历史</span>
        <span>ESC 清除</span>
      </div>
    </div>
  );
}
