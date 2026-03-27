import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { knowledgeApi } from '../../../api/knowledge';
import useKnowledgeGraphStore from '../../../stores/knowledgeGraphStore';

export default function SearchPanel() {
  const [keyword, setKeyword] = useState('');
  const [categories, setCategories] = useState([]);
  const [isFocused, setIsFocused] = useState(false);

  const { category, setCategory, setKeyword: setStoreKeyword } = useKnowledgeGraphStore();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await knowledgeApi.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };

  const handleSearch = () => {
    setStoreKeyword(keyword);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleCategoryClick = (catValue) => {
    setCategory(catValue);
  };

  return (
    <div className="w-full bg-gradient-to-r from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
      {/* 装饰性背景 */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5 pointer-events-none" />

      <div className="relative z-10">
        <div className="relative">
          <motion.div animate={{ scale: isFocused ? 1.02 : 1 }} className="relative">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="搜索实体、关系、知识..."
              className="w-full h-14 px-6 pr-14 rounded-xl bg-slate-700/50 border-2 border-slate-600/50 focus:border-blue-500/50 focus:bg-slate-700/70 focus:outline-none transition-all text-base text-white placeholder-gray-400"
            />
            <motion.button
              onClick={handleSearch}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all"
            >
              <Search size={20} />
            </motion.button>
          </motion.div>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <motion.button
              onClick={() => handleCategoryClick('all')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                category === 'all'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50 hover:text-white'
              }`}
            >
              全部
            </motion.button>
            {categories.map((cat, index) => (
              <motion.button
                key={cat.value}
                onClick={() => handleCategoryClick(cat.value)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  category === cat.value
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50 hover:text-white'
                }`}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.label}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
