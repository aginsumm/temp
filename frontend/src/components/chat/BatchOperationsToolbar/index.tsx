/**
 * 批量操作工具栏组件
 * 用于消息多选后的批量操作（删除、导出、收藏等）
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Download, Star, Copy, X, CheckSquare, Square } from 'lucide-react';
import type { Message } from '../../../types/chat';

interface BatchOperationsToolbarProps {
  selectedMessages: Set<string>;
  messages: Message[];
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  onExportSelected: (format: 'json' | 'txt' | 'md') => void;
  onFavoriteSelected: () => void;
  onCopySelected: () => void;
  onClose: () => void;
}

export function BatchOperationsToolbar({
  selectedMessages,
  messages,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
  onExportSelected,
  onFavoriteSelected,
  onCopySelected,
  onClose,
}: BatchOperationsToolbarProps) {
  const selectedCount = selectedMessages.size;
  const totalCount = messages.length;
  const isAllSelected = selectedCount === totalCount;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  };

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleToggleSelectAll}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: isAllSelected ? 'var(--color-accent)' : 'var(--color-surface)',
                color: isAllSelected ? '#fff' : 'var(--color-text-primary)',
              }}
            >
              {isAllSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              <span className="text-sm font-medium">
                {isAllSelected ? '取消全选' : '全选'}
              </span>
            </motion.button>

            <div className="flex items-center gap-2">
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                已选择 {selectedCount} 条消息
              </span>
              {selectedCount === totalCount && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                >
                  全部
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onCopySelected}
              className="p-2 rounded-lg transition-colors hover:bg-white/50 dark:hover:bg-gray-800/50"
              style={{ color: 'var(--color-text-primary)' }}
              title="复制选中消息"
            >
              <Copy size={18} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onFavoriteSelected}
              className="p-2 rounded-lg transition-colors hover:bg-white/50 dark:hover:bg-gray-800/50"
              style={{ color: 'var(--color-text-primary)' }}
              title="收藏选中消息"
            >
              <Star size={18} />
            </motion.button>

            <div className="relative group">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg transition-colors hover:bg-white/50 dark:hover:bg-gray-800/50"
                style={{ color: 'var(--color-text-primary)' }}
                title="导出选中消息"
              >
                <Download size={18} />
              </motion.button>

              <div className="absolute right-0 top-full mt-1 w-40 py-1 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {[
                  { id: 'json', label: 'JSON' },
                  { id: 'txt', label: 'TXT' },
                  { id: 'md', label: 'Markdown' },
                ].map((format) => (
                  <button
                    key={format.id}
                    onClick={() => onExportSelected(format.id as 'json' | 'txt' | 'md')}
                    className="w-full px-3 py-2 text-sm text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onDeleteSelected}
              className="p-2 rounded-lg transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
              style={{ color: 'var(--color-danger)' }}
              title="删除选中消息"
            >
              <Trash2 size={18} />
            </motion.button>

            <div className="w-px h-6 mx-1" style={{ background: 'var(--color-border)' }} />

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-white/50 dark:hover:bg-gray-800/50"
              style={{ color: 'var(--color-text-muted)' }}
              title="关闭批量操作"
            >
              <X size={18} />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
