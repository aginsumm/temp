import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Search,
  Download,
  Share2,
  Grid3X3,
  List,
  X,
  ChevronDown,
} from 'lucide-react';

interface GraphToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  onFullscreen?: () => void;
  onExport?: (format: 'png' | 'svg') => void;
  onShare?: () => void;
  onViewChange?: (view: 'graph' | 'list') => void;
  currentView?: 'graph' | 'list';
  zoomLevel?: number;
}

export function GraphToolbar({
  onZoomIn,
  onZoomOut,
  onReset,
  onFullscreen,
  onExport,
  onShare,
  onViewChange,
  currentView = 'graph',
  zoomLevel = 100,
}: GraphToolbarProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-4 right-4 flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-10"
    >
      {/* View Mode Toggle */}
      <div className="flex items-center border-r border-gray-200 dark:border-gray-700 pr-2 mr-2">
        <button
          onClick={() => onViewChange?.('graph')}
          className={`p-1.5 rounded transition-colors ${
            currentView === 'graph'
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="图谱视图"
        >
          <Grid3X3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewChange?.('list')}
          className={`p-1.5 rounded transition-colors ${
            currentView === 'list'
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="列表视图"
        >
          <List className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onZoomOut}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-600 dark:text-gray-400 w-12 text-center">
          {zoomLevel}%
        </span>
        <button
          onClick={onZoomIn}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="放大"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={onReset}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="重置"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-2 ml-2">
        <button
          onClick={onFullscreen}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="全屏"
        >
          <Maximize className="w-4 h-4" />
        </button>
        
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="导出"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <AnimatePresence>
            {showExportMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20"
              >
                <button
                  onClick={() => {
                    onExport?.('png');
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  导出为 PNG
                </button>
                <button
                  onClick={() => {
                    onExport?.('svg');
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  导出为 SVG
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={onShare}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="分享"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

interface GraphSearchPanelProps {
  entities?: Array<{ id: string; name: string; type: string }>;
  onSelectEntity?: (entityId: string) => void;
  onClose?: () => void;
}

export function GraphSearchPanel({
  entities = [],
  onSelectEntity,
  onClose,
}: GraphSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredEntities = entities.filter((entity) => {
    const matchesSearch = entity.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || entity.type === filterType;
    return matchesSearch && matchesType;
  });

  const entityTypes = Array.from(new Set(entities.map((e) => e.type)));

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute top-4 left-4 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10"
    >
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">搜索实体</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索实体名称..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Type Filter */}
        {entityTypes.length > 0 && (
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="all">全部类型</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}

        {/* Results */}
        <div className="max-h-64 overflow-auto space-y-1">
          {filteredEntities.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              没有找到匹配的实体
            </p>
          ) : (
            filteredEntities.map((entity) => (
              <button
                key={entity.id}
                onClick={() => onSelectEntity?.(entity.id)}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900 dark:text-white">
                    {entity.name}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded">
                    {entity.type}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface GraphKeyboardShortcutsProps {
  shortcuts?: Array<{
    key: string;
    description: string;
    action: () => void;
  }>;
}

export function GraphKeyboardShortcuts({ shortcuts = [] }: GraphKeyboardShortcutsProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K 显示快捷键
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }

      // 执行快捷键动作
      shortcuts.forEach((shortcut) => {
        if (e.key.toLowerCase() === shortcut.key.toLowerCase()) {
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  if (!showShortcuts) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={() => setShowShortcuts(false)}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-auto max-h-[80vh] overflow-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            键盘快捷键
          </h3>
          <button
            onClick={() => setShowShortcuts(false)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
            >
              <span className="text-gray-700 dark:text-gray-300">
                {shortcut.description}
              </span>
              <kbd className="px-2 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-sm font-mono text-gray-700 dark:text-gray-300">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
          按 Ctrl/Cmd + K 切换快捷键面板
        </p>
      </motion.div>
    </motion.div>
  );
}

// 触摸事件处理 Hook
// eslint-disable-next-line react-refresh/only-export-components
export function useTouchEvents(
  containerRef: React.RefObject<HTMLElement>,
  callbacks: {
    onPinchZoom?: (scale: number) => void;
    onPan?: (dx: number, dy: number) => void;
    onDoubleTap?: () => void;
  }
) {
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchPosition = useRef<{ x: number; y: number } | null>(null);
  const lastTapTime = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getTouchDistance = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // 双指触摸 - 准备缩放
        lastTouchDistance.current = getTouchDistance(e);
      } else if (e.touches.length === 1) {
        // 单指触摸 - 准备平移
        lastTouchPosition.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };

        // 检测双击
        const now = Date.now();
        if (now - lastTapTime.current < 300) {
          callbacks.onDoubleTap?.();
        }
        lastTapTime.current = now;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistance.current) {
        // 双指缩放
        const distance = getTouchDistance(e);
        const scale = distance / lastTouchDistance.current;
        callbacks.onPinchZoom?.(scale);
        lastTouchDistance.current = distance;
      } else if (e.touches.length === 1 && lastTouchPosition.current) {
        // 单指平移
        const dx = e.touches[0].clientX - lastTouchPosition.current.x;
        const dy = e.touches[0].clientY - lastTouchPosition.current.y;
        callbacks.onPan?.(dx, dy);
        lastTouchPosition.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    };

    const handleTouchEnd = () => {
      lastTouchDistance.current = null;
      lastTouchPosition.current = null;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, callbacks]);
}
