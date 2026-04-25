import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Search, Trash2, ExternalLink, Calendar, ChevronDown } from 'lucide-react';
import { useToast } from '../../components/common/Toast';
import { chatDataService } from '../../services/chatDataService';
import { EmptyState } from '../../components/common/Skeleton';

interface FavoriteItem {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  session_id: string;
  is_selected?: boolean;
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'user' | 'assistant'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFavorites() {
    try {
      setLoading(true);
      const messages = await chatDataService.getFavoriteMessages(1, 100);
      setFavorites(
        messages.map((m) => ({
          id: m.id,
          content: m.content,
          role: m.role,
          created_at: m.created_at,
          session_id: m.session_id,
        }))
      );
    } catch (error) {
      console.error('Failed to load favorites:', error);
      toast.error('加载收藏夹失败');
    } finally {
      setLoading(false);
    }
  }

  const filteredFavorites = useMemo(() => {
    return favorites.filter((fav) => {
      const matchesSearch = fav.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = filterRole === 'all' || fav.role === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [favorites, searchQuery, filterRole]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const deleteSelected = async () => {
    try {
      for (const id of selectedIds) {
        await chatDataService.toggleFavorite(id, false);
      }
      setFavorites((prev) => prev.filter((f) => !selectedIds.has(f.id)));
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      toast.success(`已删除 ${selectedIds.size} 个收藏`);
    } catch (error) {
      console.error('Failed to delete favorites:', error);
      toast.error('删除失败');
    }
  };

  const deleteSingle = async (id: string) => {
    try {
      await chatDataService.toggleFavorite(id, false);
      setFavorites((prev) => prev.filter((f) => f.id !== id));
      toast.success('已删除收藏');
    } catch (error) {
      console.error('Failed to delete favorite:', error);
      toast.error('删除失败');
    }
  };

  const viewInContext = async (sessionId: string) => {
    window.location.href = `/chat/${sessionId}`;
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">收藏夹</h1>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {favorites.length} 个收藏
            </span>
          </div>

          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2"
            >
              <span className="text-sm text-gray-600 dark:text-gray-400">
                已选择 {selectedIds.size} 项
              </span>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors"
              >
                删除选中
              </button>
            </motion.div>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索收藏内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="relative">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as 'all' | 'user' | 'assistant')}
              className="appearance-none px-4 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部</option>
              <option value="user">我的提问</option>
              <option value="assistant">AI 回答</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : filteredFavorites.length === 0 ? (
          <EmptyState
            icon={<Star className="w-8 h-8" />}
            title="收藏夹为空"
            description="收藏有价值的问答内容，方便日后查阅"
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredFavorites.map((fav, index) => (
                <motion.div
                  key={fav.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-white dark:bg-gray-800 rounded-lg p-4 border-2 transition-all cursor-pointer ${
                    selectedIds.has(fav.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  onClick={() => toggleSelection(fav.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            fav.role === 'user'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                              : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          }`}
                        >
                          {fav.role === 'user' ? '提问' : '回答'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(fav.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>

                      <p className="text-gray-900 dark:text-white line-clamp-3">{fav.content}</p>

                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            viewInContext(fav.session_id);
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          查看上下文
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(fav.id)}
                        onChange={() => toggleSelection(fav.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSingle(fav.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-auto"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">确认删除</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                确定要删除选中的 {selectedIds.size} 个收藏吗？此操作不可恢复。
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={deleteSelected}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
