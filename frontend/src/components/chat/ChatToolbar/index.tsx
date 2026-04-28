import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Download, Share2, Pin, FileText } from 'lucide-react';

interface ChatToolbarProps {
  sessionId: string | null;
  sessionTitle?: string;
  messageCount?: number;
  isPinned?: boolean;
  onPin?: () => void;
  onExport?: (format: 'json' | 'txt' | 'md') => void;
  onShare?: () => void;
  onDelete?: () => void;
  onSettings?: () => void;
}

export default function ChatToolbar({
  sessionTitle,
  messageCount = 0,
  isPinned = false,
  onPin,
  onExport,
  onShare,
  onSettings,
}: ChatToolbarProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const exportFormats = [
    { id: 'json', label: 'JSON 格式', icon: FileText, description: '结构化数据，便于导入' },
    { id: 'txt', label: '纯文本', icon: FileText, description: '简单文本格式' },
    { id: 'md', label: 'Markdown', icon: FileText, description: '保留格式的文档' },
  ];

  return (
    <div
      className="flex items-center justify-between px-3 py-2 border-b"
      style={{ borderColor: 'var(--color-border-light)' }}
    >
      <div className="flex items-center gap-2">
        <h2
          className="text-sm font-semibold truncate max-w-[200px]"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {sessionTitle || '新对话'}
        </h2>
        {messageCount > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-muted)',
            }}
          >
            {messageCount} 条消息
          </span>
        )}
        {isPinned && <Pin size={14} style={{ color: 'var(--color-accent)' }} />}
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onClick={onPin}
          className={`p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 ${isPinned ? 'text-amber-500' : 'text-gray-400 hover:text-gray-600'}`}
          title={isPinned ? '取消置顶' : '置顶对话'}
        >
          <Pin size={16} className={isPinned ? 'fill-current' : ''} />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"
            title="导出对话"
          >
            <Download size={16} />
          </button>

          <AnimatePresence>
            {showExportMenu && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setShowExportMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-48 py-1 rounded-xl shadow-lg z-50"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div
                    className="px-3 py-2 text-xs font-medium"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    导出格式
                  </div>
                  {exportFormats.map((format) => (
                    <button
                      key={format.id}
                      onClick={() => {
                        onExport?.(format.id as 'json' | 'txt' | 'md');
                        setShowExportMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      <format.icon size={14} style={{ color: 'var(--color-text-muted)' }} />
                      <div className="text-left">
                        <div>{format.label}</div>
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {format.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={onShare}
          className="p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"
          title="分享对话"
        >
          <Share2 size={16} />
        </button>

        <button
          onClick={onSettings}
          className="p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"
          title="对话设置"
        >
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
}
