/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Trash2, X, Search, TrendingUp } from 'lucide-react';
import { knowledgeApi } from '../../../api/knowledge';
import { knowledgeOfflineStorage } from '../../../services/knowledgeOfflineStorage';
import { networkStatusService } from '../../../services/networkStatus';

export interface SearchHistoryItem {
  id: string;
  keyword: string;
  filters: {
    category?: string;
    region?: string[];
    period?: string[];
  };
  resultCount: number;
  timestamp: number;
  created_at?: string;
}

interface ServerHistoryItem {
  id: string;
  keyword: string;
  filters?: {
    category?: string;
    region?: string[];
    period?: string[];
  };
  result_count?: number;
  created_at: string;
}

interface SearchHistoryProps {
  visible: boolean;
  onClose: () => void;
  onSelectHistory: (keyword: string, filters: SearchHistoryItem['filters']) => void;
  userId?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  inheritor: '传承人',
  technique: '技艺',
  work: '作品',
  pattern: '纹样',
  region: '地域',
  period: '时期',
  material: '材料',
};

export default function SearchHistory({
  visible,
  onClose,
  onSelectHistory,
  userId,
}: SearchHistoryProps) {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<'recent' | 'frequent'>('recent');

  useEffect(() => {
    const unsubscribe = networkStatusService.subscribe((status) => {
      setIsOnline(status.mode === 'online');
    });
    return () => unsubscribe();
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const localData = await knowledgeOfflineStorage.getSearchHistory(50);

      if (isOnline) {
        try {
          const serverData = await knowledgeApi.getSearchHistory(userId);
          const mergedHistory = mergeHistory(localData, serverData);
          setHistory(mergedHistory);
        } catch (error) {
          console.warn('Failed to load server history, using local:', error);
          setHistory(localData);
        }
      } else {
        setHistory(localData);
      }
    } catch (error) {
      console.error('加载搜索历史失败:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [userId, isOnline]);

  useEffect(() => {
    if (visible) {
      loadHistory();
    }
  }, [visible, loadHistory]);

  const mergeHistory = (
    local: SearchHistoryItem[],
    server: ServerHistoryItem[]
  ): SearchHistoryItem[] => {
    const merged = new Map<string, SearchHistoryItem>();

    local.forEach((item) => {
      merged.set(item.id, item);
    });

    server.forEach((item) => {
      const existing = merged.get(item.id);
      if (!existing || existing.timestamp < new Date(item.created_at).getTime()) {
        merged.set(item.id, {
          id: item.id,
          keyword: item.keyword,
          filters: item.filters || {},
          timestamp: new Date(item.created_at).getTime(),
          resultCount: item.result_count || 0,
        });
      }
    });

    return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
  };

  const handleRemoveItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setHistory((prev) => prev.filter((item) => item.id !== id));

      if (isOnline) {
        try {
          await knowledgeApi.deleteSearchHistory(id);
        } catch (error) {
          console.warn('Failed to delete from server:', error);
        }
      }
    } catch (error) {
      console.error('删除搜索历史失败:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      setHistory([]);
      await knowledgeOfflineStorage.clearSearchHistory();

      if (isOnline) {
        try {
          await knowledgeApi.clearSearchHistory(userId);
        } catch (error) {
          console.warn('Failed to clear server history:', error);
        }
      }
    } catch (error) {
      console.error('清空搜索历史失败:', error);
    }
  };

  const handleSelectItem = async (item: SearchHistoryItem) => {
    onSelectHistory(item.keyword, item.filters);
    onClose();
  };

  const formatTime = (timestamp: number | string) => {
    const date = new Date(typeof timestamp === 'string' ? timestamp : timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  const getFilterBadges = (filters: SearchHistoryItem['filters']) => {
    const badges: { label: string; colorKey: string }[] = [];

    if (filters.category && filters.category !== 'all') {
      badges.push({
        label: CATEGORY_LABELS[filters.category] || filters.category,
        colorKey: 'primary',
      });
    }

    if (filters.region && filters.region.length > 0) {
      badges.push({
        label: filters.region.length === 1 ? filters.region[0] : `${filters.region.length}地域`,
        colorKey: 'secondary',
      });
    }

    if (filters.period && filters.period.length > 0) {
      badges.push({
        label: filters.period.length === 1 ? filters.period[0] : `${filters.period.length}时期`,
        colorKey: 'accent',
      });
    }

    return badges;
  };

  const getFrequentSearches = (): SearchHistoryItem[] => {
    const keywordCount = new Map<string, { item: SearchHistoryItem; count: number }>();

    history.forEach((item) => {
      const key = `${item.keyword}:${JSON.stringify(item.filters)}`;
      const existing = keywordCount.get(key);
      if (existing) {
        existing.count++;
      } else {
        keywordCount.set(key, { item, count: 1 });
      }
    });

    return Array.from(keywordCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((entry) => entry.item);
  };

  const displayHistory = activeTab === 'recent' ? history : getFrequentSearches();

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 backdrop-blur-sm z-50 flex items-start justify-center pt-20"
        style={{ background: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-2xl backdrop-blur-xl border rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: 'var(--gradient-card)',
            borderColor: 'var(--color-border)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  <Clock size={20} style={{ color: 'var(--color-text-inverse)' }} />
                </div>
                <div>
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    搜索历史
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {history.length > 0 ? `共 ${history.length} 条记录` : '暂无搜索记录'}
                    {!isOnline && (
                      <span style={{ color: 'var(--color-warning)', marginLeft: '8px' }}>
                        (离线模式)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <motion.button
                    onClick={handleClearAll}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 text-sm rounded-lg transition-all"
                    style={{
                      color: 'var(--color-error)',
                      background: 'var(--color-surface)',
                    }}
                  >
                    清空全部
                  </motion.button>
                )}
                <motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-lg transition-all"
                  style={{ background: 'var(--color-surface)' }}
                >
                  <X size={20} style={{ color: 'var(--color-text-muted)' }} />
                </motion.button>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setActiveTab('recent')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background:
                    activeTab === 'recent' ? 'var(--color-primary)' : 'var(--color-surface)',
                  color:
                    activeTab === 'recent'
                      ? 'var(--color-text-inverse)'
                      : 'var(--color-text-secondary)',
                  opacity: activeTab === 'recent' ? 1 : 0.8,
                }}
              >
                <Clock size={16} />
                最近搜索
              </button>
              <button
                onClick={() => setActiveTab('frequent')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background:
                    activeTab === 'frequent' ? 'var(--color-accent)' : 'var(--color-surface)',
                  color:
                    activeTab === 'frequent'
                      ? 'var(--color-text-inverse)'
                      : 'var(--color-text-secondary)',
                  opacity: activeTab === 'frequent' ? 1 : 0.8,
                }}
              >
                <TrendingUp size={16} />
                常用搜索
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-8 h-8 border-3 rounded-full"
                  style={{
                    borderColor: 'var(--color-primary)',
                    borderTopColor: 'transparent',
                  }}
                />
              </div>
            ) : displayHistory.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <Search size={48} className="mb-4" style={{ opacity: 0.5 }} />
                <p>暂无搜索历史</p>
                <p className="text-sm mt-2">搜索内容将自动保存在这里</p>
              </div>
            ) : (
              <div>
                {displayHistory.map((item, index) => {
                  const badges = getFilterBadges(item.filters);
                  return (
                    <motion.div
                      key={item.id}
                      data-testid={`search-history-item-${item.id}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleSelectItem(item)}
                      className="p-4 cursor-pointer group transition-all"
                      style={{
                        background: 'transparent',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Search
                              size={14}
                              style={{ color: 'var(--color-text-muted)' }}
                              className="flex-shrink-0"
                            />
                            <span
                              className="font-medium truncate"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              {item.keyword || '全部内容'}
                            </span>
                          </div>

                          {badges.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {badges.map((badge, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-full text-xs"
                                  style={{
                                    background: `var(--color-${badge.colorKey})`,
                                    color: 'var(--color-text-inverse)',
                                    opacity: 0.8,
                                  }}
                                >
                                  {badge.label}
                                </span>
                              ))}
                            </div>
                          )}

                          <div
                            className="flex items-center gap-4 text-xs"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {formatTime(item.timestamp || item.created_at || Date.now())}
                            </span>
                            {item.resultCount !== undefined && (
                              <span>{item.resultCount} 条结果</span>
                            )}
                          </div>
                        </div>

                        <motion.button
                          onClick={(e) => handleRemoveItem(item.id, e)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          style={{
                            color: 'var(--color-error)',
                            background: 'var(--color-surface)',
                          }}
                        >
                          <Trash2 size={16} />
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div
              className="p-4"
              style={{
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
              }}
            >
              <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                点击历史记录可快速重新搜索 · {isOnline ? '已同步' : '本地存储'}
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export { useSearchHistory } from './useSearchHistory';
