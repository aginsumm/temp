import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Trash2, X, ArrowUpRight } from 'lucide-react';
import { inputHistoryService, type HistoryItem } from '../../../services/inputHistoryService';

interface InputHistoryDropdownProps {
  query: string;
  onSelect: (text: string) => void;
  onAddToHistory?: (text: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function InputHistoryDropdown({
  query,
  onSelect,
  isOpen,
  onClose,
}: InputHistoryDropdownProps) {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const loadHistory = useCallback(() => {
    const items =
      query.trim().length > 0
        ? inputHistoryService.searchHistory(query, 8)
        : inputHistoryService.getRecentHistory(8);
    setHistoryItems(items);
    setSelectedIndex(-1);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, loadHistory]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleSelect = useCallback(
    (item: HistoryItem) => {
      onSelect(item.text);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || historyItems.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < historyItems.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : historyItems.length - 1));
          break;
        case 'Enter':
          if (selectedIndex >= 0 && selectedIndex < historyItems.length) {
            e.preventDefault();
            handleSelect(historyItems[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, historyItems, selectedIndex, onClose, handleSelect]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current.has(selectedIndex)) {
      itemRefs.current.get(selectedIndex)?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    inputHistoryService.deleteItem(id);
    loadHistory();
  };

  const handleClearAll = () => {
    inputHistoryService.clearHistory();
    setHistoryItems([]);
    setShowConfirmClear(false);
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return new Date(timestamp).toLocaleDateString('zh-CN');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-0 right-0 mb-2 z-50"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            maxHeight: '320px',
            overflow: 'hidden',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2 border-b"
            style={{ borderColor: 'var(--color-border-light)' }}
          >
            <div className="flex items-center gap-2">
              <Clock size={14} style={{ color: 'var(--color-text-muted)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                输入历史
              </span>
              {historyItems.length > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: 'var(--color-primary-alpha)',
                    color: 'var(--color-primary)',
                  }}
                >
                  {historyItems.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {historyItems.length > 0 && (
                <>
                  {showConfirmClear ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleClearAll}
                        className="text-[10px] px-2 py-1 rounded transition-colors"
                        style={{
                          background: 'var(--color-error-alpha)',
                          color: 'var(--color-error)',
                        }}
                      >
                        确认清除
                      </button>
                      <button
                        onClick={() => setShowConfirmClear(false)}
                        className="text-[10px] px-2 py-1 rounded transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowConfirmClear(true)}
                      className="p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                      style={{ color: 'var(--color-text-muted)' }}
                      title="清除全部历史"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </>
              )}
              <button
                onClick={onClose}
                className="p-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={12} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: '260px' }}>
            {historyItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <Clock size={24} style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
                <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
                  暂无输入历史
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
                >
                  您的输入记录将显示在这里
                </p>
              </div>
            ) : (
              <div className="py-1">
                {historyItems.map((item, index) => (
                  <motion.button
                    key={item.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(index, el);
                    }}
                    onClick={() => handleSelect(item)}
                    whileHover={{ scale: 1.01 }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left ${
                      index === selectedIndex ? 'bg-primary-alpha' : ''
                    }`}
                    style={{
                      background:
                        index === selectedIndex ? 'var(--color-primary-alpha)' : 'transparent',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm truncate"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {item.text}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                          {formatTimeAgo(item.timestamp)}
                        </span>
                        {item.usageCount > 1 && (
                          <span
                            className="text-[10px] flex items-center gap-0.5"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            <ArrowUpRight size={10} />
                            {item.usageCount}次
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--color-text-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                    >
                      <X size={12} />
                    </button>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
