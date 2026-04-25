import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { knowledgeApi } from '../../../api/knowledge';
import useKnowledgeGraphStore from '../../../stores/knowledgeGraphStore';

interface Category {
  value: string;
  label: string;
  color: string;
  count?: number;
}

const DEBOUNCE_DELAY = 300;

export default function SearchPanel() {
  const [keyword, setKeyword] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { category, setCategory, setKeyword: setStoreKeyword } = useKnowledgeGraphStore();

  useEffect(() => {
    loadCategories();
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  const loadCategories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await knowledgeApi.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('加载分类失败:', err);
      setError('加载分类失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSearch = useCallback((value: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setStoreKeyword(value);
    }, DEBOUNCE_DELAY);
  }, [setStoreKeyword]);

  const handleSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setStoreKeyword(keyword);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeyword(value);
    debouncedSearch(value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleCategoryClick = (catValue: string) => {
    setCategory(catValue);
  };

  const handleRetry = () => {
    loadCategories();
  };

  return (
    <div
      className="w-full backdrop-blur-xl rounded-2xl p-6 relative overflow-hidden"
      style={{
        background: 'var(--gradient-card)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--color-shadow)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary), var(--color-accent))',
          opacity: 0.03,
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Sparkles size={20} style={{ color: 'var(--color-text-inverse)' }} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              智能搜索
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              搜索实体、关系、知识...
            </p>
          </div>
        </div>

        <div className="relative">
          <motion.div animate={{ scale: isFocused ? 1.01 : 1 }} className="relative">
            <input
              type="text"
              value={keyword}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="输入关键词搜索..."
              className="w-full h-14 px-6 pr-14 rounded-xl focus:outline-none transition-all text-base"
              style={{
                background: 'var(--color-surface)',
                border: `2px solid ${isFocused ? 'var(--color-primary)' : 'var(--color-border)'}`,
                color: 'var(--color-text-primary)',
              }}
            />
            <motion.button
              onClick={handleSearch}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg flex items-center justify-center transition-all"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Search size={20} style={{ color: 'var(--color-text-inverse)' }} />
            </motion.button>
          </motion.div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-3 rounded-lg flex items-center gap-2"
            style={{
              background: 'var(--color-error-bg, rgba(239, 68, 68, 0.1))',
              border: '1px solid var(--color-error, #ef4444)',
            }}
          >
            <AlertCircle size={16} style={{ color: 'var(--color-error, #ef4444)' }} />
            <span className="text-sm" style={{ color: 'var(--color-error, #ef4444)' }}>
              {error}
            </span>
            <button
              onClick={handleRetry}
              className="ml-auto text-sm underline hover:opacity-80"
              style={{ color: 'var(--color-error, #ef4444)' }}
            >
              重试
            </button>
          </motion.div>
        )}

        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              <span className="ml-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                加载中...
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <motion.button
                onClick={() => handleCategoryClick('all')}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: category === 'all' ? 'var(--gradient-primary)' : 'var(--color-surface)',
                  color: category === 'all' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                  border: category === 'all' ? 'none' : '1px solid var(--color-border)',
                }}
              >
                全部
              </motion.button>
              {categories &&
                categories.length > 0 &&
                categories.map((cat, index) => (
                  <motion.button
                    key={cat.value}
                    onClick={() => handleCategoryClick(cat.value)}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                    style={{
                      background: category === cat.value ? 'var(--gradient-primary)' : 'var(--color-surface)',
                      color: category === cat.value ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                      border: category === cat.value ? 'none' : '1px solid var(--color-border)',
                    }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shadow-sm"
                      style={{
                        backgroundColor: cat.color,
                        boxShadow: `0 0 8px ${cat.color}50`,
                      }}
                    />
                    {cat.label}
                    {cat.count && (
                      <span className="text-xs opacity-70">({cat.count})</span>
                    )}
                  </motion.button>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
