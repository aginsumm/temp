import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Command, MessageSquare, Clock, X, ArrowRight } from 'lucide-react';

interface MessageSearchResult {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  session_id: string;
  session_title: string;
  highlights: string[];
}

interface EnhancedMessageSearchProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Array<{
    id: string;
    content: string;
    role: 'user' | 'assistant';
    created_at: string;
    session_id: string;
    session_title?: string;
  }>;
  onSelectMessage: (messageId: string, sessionId: string) => void;
}

export function EnhancedMessageSearch({
  isOpen,
  onClose,
  messages,
  onSelectMessage,
}: EnhancedMessageSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('message_recent_searches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    }
  }, [isOpen]);

  const searchResults = useMemo<MessageSearchResult[]>(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase().trim();
    const results: MessageSearchResult[] = [];

    messages.forEach((msg) => {
      const contentLower = msg.content.toLowerCase();
      const matchIndex = contentLower.indexOf(lowerQuery);

      if (matchIndex !== -1) {
        // 提取高亮片段
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(msg.content.length, matchIndex + lowerQuery.length + 50);
        const snippet = msg.content.substring(start, end);

        results.push({
          id: msg.id,
          content: snippet,
          role: msg.role,
          created_at: msg.created_at,
          session_id: msg.session_id,
          session_title: msg.session_title || '未命名对话',
          highlights: [query],
        });
      }
    });

    return results.slice(0, 50); // 限制结果数量
  }, [messages, query]);

  const saveRecentSearch = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setRecentSearches((prev) => {
      const updated = [searchTerm, ...prev.filter((s) => s !== searchTerm)].slice(0, 5);
      localStorage.setItem('message_recent_searches', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem('message_recent_searches');
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (searchResults[selectedIndex]) {
            const result = searchResults[selectedIndex];
            onSelectMessage(result.id, result.session_id);
            saveRecentSearch(query);
            onClose();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    },
    [isOpen, searchResults, selectedIndex, onSelectMessage, onClose, query, saveRecentSearch]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const highlightText = (text: string, highlights: string[]) => {
    if (!highlights.length) return text;

    const parts = text.split(new RegExp(`(${highlights.join('|')})`, 'gi'));
    return parts.map((part, i) =>
      highlights.some((h) => part.toLowerCase() === h.toLowerCase()) ? (
        <mark
          key={i}
          className="bg-yellow-200 dark:bg-yellow-800 text-gray-900 dark:text-white px-0.5 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[70vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索消息内容..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              autoFocus
              className="flex-1 bg-transparent text-lg text-gray-900 dark:text-white focus:outline-none"
            />
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Tips */}
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>↑↓ 导航</span>
            <span>·</span>
            <span>Enter 查看</span>
            <span>·</span>
            <span>Esc 关闭</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {query.trim() === '' && recentSearches.length > 0 && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  最近搜索
                </h3>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  清空
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => setQuery(search)}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {query.trim() && searchResults.length === 0 && (
            <div className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">没有找到匹配的消息</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">尝试其他关键词</p>
            </div>
          )}

          {query.trim() && searchResults.length > 0 && (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {searchResults.map((result, index) => (
                <motion.div
                  key={result.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className={`p-4 cursor-pointer transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => {
                    onSelectMessage(result.id, result.session_id);
                    saveRecentSearch(query);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          result.role === 'user'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        }`}
                      >
                        {result.role === 'user' ? '提问' : '回答'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(result.created_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {result.session_title}
                    </span>
                  </div>

                  <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                    {highlightText(result.content, result.highlights)}
                  </p>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">点击查看详情</span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {searchResults.length > 0 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 text-center">
            共 {searchResults.length} 条结果
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

interface CommandPaletteItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  category: 'navigation' | 'action' | 'settings' | 'message';
  action: () => void;
  score?: number;
}

interface EnhancedCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands?: CommandPaletteItem[];
}

export function EnhancedCommandPalette({
  isOpen,
  onClose,
  commands = [],
}: EnhancedCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }

    const lowerQuery = query.toLowerCase();
    return commands
      .filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(lowerQuery) ||
          cmd.category.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => {
        const aIndex = a.label.toLowerCase().indexOf(lowerQuery);
        const bIndex = b.label.toLowerCase().indexOf(lowerQuery);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
  }, [commands, query]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    },
    [isOpen, filteredCommands, selectedIndex, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl"
      >
        {/* Input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <Command className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="输入命令或搜索..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            autoFocus
            className="flex-1 bg-transparent text-lg text-gray-900 dark:text-white focus:outline-none"
          />
        </div>

        {/* Commands */}
        <div className="max-h-96 overflow-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-12 text-center">
              <Command className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">没有找到匹配的命令</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCommands.map((cmd, index) => (
                <motion.button
                  key={cmd.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className={`w-full p-4 flex items-center justify-between transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-center gap-3">
                    {cmd.icon || <Command className="w-5 h-5 text-gray-400" />}
                    <div className="text-left">
                      <p className="text-gray-900 dark:text-white font-medium">{cmd.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {cmd.category}
                      </p>
                    </div>
                  </div>
                  {cmd.shortcut && (
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono text-gray-700 dark:text-gray-300">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
          <span>↑↓ 导航</span>
          <span>Enter 执行</span>
          <span>Esc 关闭</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
