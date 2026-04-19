import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Square, Paperclip, File, X, Image, FileText } from 'lucide-react';

const MAX_CHARS = 4000;
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'document' | 'other';
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
}

export default function UnifiedInputArea({
  onSend,
  isLoading = false,
  isStreaming = false,
  placeholder = '输入您的问题，探索非遗文化...',
  disabled = false,
  onStop,
  autoFocus = false,
}: UnifiedInputAreaProps) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSendingRef = useRef(false); // 🌟 新增：防止双击连发的锁

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const newFiles: UploadedFile[] = [];
      const errors: string[] = [];

      Array.from(files).forEach((file) => {
        if (uploadedFiles.length + newFiles.length >= MAX_FILES) {
          errors.push(`最多只能上传 ${MAX_FILES} 个文件`);
          return;
        }

        if (file.size > MAX_FILE_SIZE) {
          errors.push(`文件 ${file.name} 超过 ${MAX_FILE_SIZE / 1024 / 1024}MB 限制`);
          return;
        }

        const reader = new FileReader();
        const isImage = file.type.startsWith('image/');
        const isText =
          file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md');

        reader.onload = (e) => {
          newFiles.push({
            id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            file,
            preview: isImage || isText ? (e.target?.result as string) : undefined,
            type: isImage ? 'image' : isText ? 'document' : 'other',
          });

          if (newFiles.length === Array.from(files).filter((f) => f.size <= MAX_FILE_SIZE).length) {
            setUploadedFiles((prev) => [...prev, ...newFiles]);
          }
        };

        if (isImage || isText) {
          reader.readAsDataURL(file);
        } else {
          newFiles.push({
            id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            file,
            type: 'other',
          });
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
    if ((!finalContent && uploadedFiles.length === 0) || disabled || isLoading || isSendingRef.current) return;
    
    isSendingRef.current = true;
    const result = onSend(finalContent, { files: uploadedFiles.length > 0 ? uploadedFiles : undefined });
    
    if (result instanceof Promise) {
      result.finally(() => { isSendingRef.current = false; });
    } else {
      setTimeout(() => { isSendingRef.current = false; }, 100);
    }
    
    setInputValue('');
    setCharCount(0);
    setUploadedFiles([]);
  }, [inputValue, uploadedFiles, disabled, isLoading, charCount, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 🌟 拦截中文输入法回车误触
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const charCountColor = useMemo(() => {
    if (charCount > MAX_CHARS * 0.9) return 'var(--color-error)';
    if (charCount > MAX_CHARS * 0.7) return 'var(--color-warning)';
    return 'var(--color-text-muted)';
  }, [charCount]);

  return (
    <motion.div
      className="relative w-full max-w-4xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        ref={inputRef}
        className="relative rounded-2xl overflow-hidden"
        initial={{
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        }}
        animate={{
          boxShadow:
            isFocused || isDragOver
              ? '0 8px 32px rgba(59, 130, 246, 0.2), 0 0 0 2px var(--color-primary)'
              : '0 2px 8px rgba(0, 0, 0, 0.05)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <AnimatePresence>
          {isDragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center"
              style={{
                background: 'var(--color-primary-alpha)',
                border: '2px dashed var(--color-primary)',
              }}
            >
              <div className="flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
                <Paperclip size={32} />
                <span className="text-lg font-medium">拖拽文件到此处上传</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className={`relative p-3 transition-all duration-300 ${isFocused ? 'ring-2 ring-blue-500/20' : ''}`}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <AnimatePresence>
            {uploadedFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-2 overflow-hidden"
              >
                <div className="flex flex-wrap gap-2">
                  {uploadedFiles.map((file) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs"
                      style={{
                        background: 'var(--color-background-secondary)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      {file.type === 'image' ? (
                        <Image size={14} style={{ color: 'var(--color-primary)' }} />
                      ) : file.type === 'document' ? (
                        <FileText size={14} style={{ color: 'var(--color-success)' }} />
                      ) : (
                        <File size={14} style={{ color: 'var(--color-text-muted)' }} />
                      )}
                      <span
                        className="max-w-[120px] truncate"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {file.file.name}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                        {(file.file.size / 1024).toFixed(1)}KB
                      </span>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <X size={12} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setCharCount(e.target.value.length);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder}
                disabled={disabled || isLoading}
                rows={1}
                className="w-full px-3 py-2 bg-transparent outline-none resize-none"
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
              {charCount > 0 && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs"
                  style={{ color: charCountColor }}
                >
                  {charCount}/{MAX_CHARS}
                </motion.span>
              )}

              {isStreaming ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onStop}
                  className="p-2 rounded-xl transition-colors"
                  style={{
                    background: 'var(--color-error)',
                    color: 'white',
                  }}
                  title="停止生成"
                >
                  <Square size={18} />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSend}
                  disabled={disabled || isLoading || !inputValue.trim() || charCount > MAX_CHARS}
                  className="p-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background:
                      disabled || isLoading || !inputValue.trim() || charCount > MAX_CHARS
                        ? 'var(--color-background-secondary)'
                        : 'var(--color-primary)',
                    color:
                      disabled || isLoading || !inputValue.trim() || charCount > MAX_CHARS
                        ? 'var(--color-text-muted)'
                        : 'white',
                  }}
                  title="发送"
                >
                  <Send size={18} />
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-center gap-4 mt-3 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <span>Enter 发送</span>
        <span>Shift + Enter 换行</span>
      </motion.div>
    </motion.div>
  );
}
