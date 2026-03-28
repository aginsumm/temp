import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, List, Map, Clock, TrendingUp, BookOpen } from 'lucide-react';
import KnowledgeGraph from '../../components/knowledge/KnowledgeGraph';
import ListView from '../../components/knowledge/ListView';
import MapView from '../../components/knowledge/MapView';
import TimelineView from '../../components/knowledge/TimelineView';
import SearchPanel from '../../components/knowledge/SearchPanel';
import FilterPanel from '../../components/knowledge/FilterPanel';
import DetailPanel from '../../components/knowledge/DetailPanel';
import useKnowledgeGraphStore from '../../stores/knowledgeGraphStore';
import { knowledgeApi, Entity } from '../../api/knowledge';

export default function KnowledgePage() {
  const { viewMode, setViewMode, setSelectedNode } = useKnowledgeGraphStore();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalEntities: 0,
    totalRelationships: 0,
    topCategories: [] as { name: string; count: number; color: string }[],
  });

  const viewButtons = [
    {
      mode: 'graph' as const,
      icon: Network,
      label: '图谱视图',
      color: 'from-blue-500 to-cyan-500',
    },
    { mode: 'list' as const, icon: List, label: '列表视图', color: 'from-purple-500 to-pink-500' },
    { mode: 'map' as const, icon: Map, label: '地图视图', color: 'from-green-500 to-emerald-500' },
    {
      mode: 'timeline' as const,
      icon: Clock,
      label: '时间轴视图',
      color: 'from-orange-500 to-red-500',
    },
  ];

  useEffect(() => {
    loadEntities();
    loadStats();
  }, []);

  const loadEntities = async () => {
    try {
      setLoading(true);
      const response = await knowledgeApi.search({});
      setEntities(response.results);
    } catch (error) {
      console.error('加载实体数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await knowledgeApi.getStats();
      const categories = Object.entries(statsData.entities_by_type)
        .map(([type, count]) => ({
          name: type,
          count,
          color: getCategoryColor(type),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setStats({
        totalEntities: statsData.total_entities,
        totalRelationships: statsData.total_relationships,
        topCategories: categories,
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  };

  const getCategoryColor = (type: string) => {
    const colors: Record<string, string> = {
      inheritor: '#8B5CF6',
      technique: '#10B981',
      work: '#F59E0B',
      pattern: '#EF4444',
      region: '#06B6D4',
      period: '#6366F1',
      material: '#84CC16',
    };
    return colors[type] || '#3B82F6';
  };

  const handleEntityClick = (entityId: string) => {
    setSelectedNode(entityId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* 动态背景效果 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '2s' }}
        />

        {/* 网格背景 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.1)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6">
        {/* 页面标题区域 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2"
              >
                非遗知识图谱
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-gray-400 text-sm"
              >
                探索千年文化传承的知识网络
              </motion.p>
            </div>

            {/* 统计卡片 */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-4"
            >
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-4 min-w-[140px]">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen size={16} className="text-blue-400" />
                  <span className="text-xs text-gray-400">实体总数</span>
                </div>
                <div className="text-2xl font-bold text-white">{stats.totalEntities}</div>
              </div>

              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-4 min-w-[140px]">
                <div className="flex items-center gap-2 mb-1">
                  <Network size={16} className="text-purple-400" />
                  <span className="text-xs text-gray-400">关系总数</span>
                </div>
                <div className="text-2xl font-bold text-white">{stats.totalRelationships}</div>
              </div>

              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-xl border border-green-500/30 rounded-2xl p-4 min-w-[140px]">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={16} className="text-green-400" />
                  <span className="text-xs text-gray-400">活跃度</span>
                </div>
                <div className="text-2xl font-bold text-white">98%</div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* 搜索面板 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <SearchPanel />
        </motion.div>

        {/* 视图切换按钮 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-4 mb-4"
        >
          <div className="flex-1 bg-gradient-to-r from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-4">
            <div className="flex gap-2">
              {viewButtons.map(({ mode, icon: Icon, label, color }) => (
                <motion.button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all relative overflow-hidden ${
                    viewMode === mode
                      ? `bg-gradient-to-r ${color} text-white shadow-lg`
                      : 'bg-slate-700/50 text-gray-300 hover:bg-slate-600/50 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium">{label}</span>
                  {viewMode === mode && (
                    <motion.div
                      layoutId="activeView"
                      className="absolute inset-0 bg-white/10 rounded-xl"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* 主内容区域 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex gap-4"
          style={{ height: 'calc(100vh - 380px)' }}
        >
          <FilterPanel />

          <div className="flex-1 bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden relative">
            {/* 装饰性边框 */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 pointer-events-none" />

            <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="relative z-10 h-full"
              >
                {viewMode === 'graph' && <KnowledgeGraph />}
                {viewMode === 'list' && (
                  <ListView
                    entities={entities}
                    onEntityClick={handleEntityClick}
                    loading={loading}
                  />
                )}
                {viewMode === 'map' && (
                  <MapView
                    entities={entities}
                    onEntityClick={handleEntityClick}
                    loading={loading}
                  />
                )}
                {viewMode === 'timeline' && (
                  <TimelineView
                    entities={entities}
                    onEntityClick={handleEntityClick}
                    loading={loading}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <DetailPanel />
        </motion.div>

        {/* 底部热门分类 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 flex gap-3 justify-center"
        >
          {stats.topCategories.map((category, index) => (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-xl px-4 py-2 flex items-center gap-2"
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="text-sm text-gray-300">{category.name}</span>
              <span className="text-xs text-gray-500">({category.count})</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
