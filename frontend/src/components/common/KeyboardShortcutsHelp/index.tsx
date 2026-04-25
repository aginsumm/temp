import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X, Command, Search, ZoomIn, RotateCcw, Plus, Minus, HelpCircle } from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  description: string;
  category: string;
  icon?: React.ReactNode;
}

const SHORTCUTS: ShortcutItem[] = [
  {
    keys: ['Ctrl', 'K'],
    description: '全局搜索',
    category: '通用',
    icon: <Search size={16} />,
  },
  {
    keys: ['Ctrl', '/'],
    description: '打开快捷键帮助',
    category: '通用',
    icon: <Keyboard size={16} />,
  },
  {
    keys: ['Esc'],
    description: '关闭弹窗/取消操作',
    category: '通用',
    icon: <X size={16} />,
  },
  {
    keys: ['Ctrl', 'Enter'],
    description: '发送消息',
    category: '智能问答',
    icon: <Command size={16} />,
  },
  {
    keys: ['Ctrl', 'M'],
    description: '切换语音输入',
    category: '智能问答',
    icon: <HelpCircle size={16} />,
  },
  {
    keys: ['Ctrl', 'H'],
    description: '查看对话历史',
    category: '智能问答',
    icon: <HelpCircle size={16} />,
  },
  {
    keys: ['Ctrl', 'G'],
    description: '聚焦图谱',
    category: '知识图谱',
    icon: <ZoomIn size={16} />,
  },
  {
    keys: ['Ctrl', '+'],
    description: '放大图谱',
    category: '知识图谱',
    icon: <Plus size={16} />,
  },
  {
    keys: ['Ctrl', '-'],
    description: '缩小图谱',
    category: '知识图谱',
    icon: <Minus size={16} />,
  },
  {
    keys: ['Ctrl', '0'],
    description: '重置图谱视图',
    category: '知识图谱',
    icon: <RotateCcw size={16} />,
  },
  {
    keys: ['Ctrl', 'E'],
    description: '编辑选中实体',
    category: '知识图谱',
    icon: <HelpCircle size={16} />,
  },
  {
    keys: ['Ctrl', 'R'],
    description: '添加关系',
    category: '知识图谱',
    icon: <HelpCircle size={16} />,
  },
  {
    keys: ['Ctrl', 'F'],
    description: '搜索实体',
    category: '知识图谱',
    icon: <Search size={16} />,
  },
  {
    keys: ['Space'],
    description: '暂停/恢复动画',
    category: '知识图谱',
    icon: <HelpCircle size={16} />,
  },
  {
    keys: ['?'],
    description: '显示帮助',
    category: '通用',
    icon: <HelpCircle size={16} />,
  },
];

interface KeyboardShortcutsHelpProps {
  visible: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsHelp({ visible, onClose }: KeyboardShortcutsHelpProps) {
  const [activeCategory, setActiveCategory] = useState<string>('全部');

  const categories = ['全部', ...new Set(SHORTCUTS.map((s) => s.category))];

  const filteredShortcuts =
    activeCategory === '全部'
      ? SHORTCUTS
      : SHORTCUTS.filter((s) => s.category === activeCategory);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, handleKeyDown]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-2xl bg-gradient-to-b from-slate-800/95 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                  <Keyboard size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">键盘快捷键</h2>
                  <p className="text-sm text-gray-400">使用快捷键提升操作效率</p>
                </div>
              </div>
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-all"
              >
                <X size={20} className="text-gray-400 hover:text-white transition-colors" />
              </motion.button>
            </div>

            <div className="flex gap-2 mt-4">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeCategory === category
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-4">
            <div className="grid gap-2">
              {filteredShortcuts.map((shortcut, index) => (
                <motion.div
                  key={`${shortcut.keys.join('-')}-${shortcut.description}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-700/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    {shortcut.icon && (
                      <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-gray-400 group-hover:text-white transition-colors">
                        {shortcut.icon}
                      </div>
                    )}
                    <span className="text-gray-300 group-hover:text-white transition-colors">
                      {shortcut.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        <kbd className="px-2 py-1 bg-slate-700/80 border border-slate-600/50 rounded-lg text-sm font-mono text-gray-300 shadow-sm">
                          {key}
                        </kbd>
                        {idx < shortcut.keys.length - 1 && (
                          <span className="text-gray-500 text-sm">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-slate-700/50 bg-slate-800/50">
            <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-slate-700/50 rounded text-xs">Esc</kbd>
              关闭此窗口
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useKeyboardShortcuts(
  handlers: Record<string, () => void>,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = [];
      if (e.ctrlKey || e.metaKey) key.push('Ctrl');
      if (e.shiftKey) key.push('Shift');
      if (e.altKey) key.push('Alt');
      key.push(e.key);

      const shortcut = key.join('+');

      if (handlers[shortcut]) {
        e.preventDefault();
        handlers[shortcut]();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlers, enabled]);
}

export function KeyboardShortcutButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
      title="键盘快捷键 (Ctrl+/)"
    >
      <Keyboard size={18} />
      <span className="text-sm">快捷键</span>
    </motion.button>
  );
}

export { SHORTCUTS };
