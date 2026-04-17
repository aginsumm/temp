import { useState, useEffect, lazy, Suspense, useCallback, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network,
  List,
  Map,
  Clock,
  TrendingUp,
  BookOpen,
  History,
  Download,
  Upload,
} from 'lucide-react';
import useKnowledgeGraphStore from '../../stores/knowledgeGraphStore';
import { knowledgeApi, Entity } from '../../api/knowledge';
import {
  GraphSkeleton,
  ListSkeleton,
  MapSkeleton,
  TimelineSkeleton,
  SearchPanelSkeleton,
  FilterPanelSkeleton,
  DetailPanelSkeleton,
} from '../../components/common/Skeleton';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import SearchHistory from '../../components/knowledge/SearchHistory';

const KnowledgeGraph = lazy(() => import('../../components/knowledge/KnowledgeGraph'));
const ListView = lazy(() => import('../../components/knowledge/ListView'));
const MapView = lazy(() => import('../../components/knowledge/MapView'));
const TimelineView = lazy(() => import('../../components/knowledge/TimelineView'));
const SearchPanel = lazy(() => import('../../components/knowledge/SearchPanel'));
const FilterPanel = lazy(() => import('../../components/knowledge/FilterPanel'));
const DetailPanel = lazy(() => import('../../components/knowledge/DetailPanel'));

export default function KnowledgePage() {
  const { viewMode, setViewMode, setSelectedNode, setCategory, setRegion, setPeriod, setKeyword } =
    useKnowledgeGraphStore();
  const [isPending, startTransitionFn] = useTransition();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalEntities: 0,
    totalRelationships: 0,
    topCategories: [] as { name: string; count: number; color: string }[],
  });
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [exporting, setExporting] = useState(false);

  const viewButtons = [
    {
      mode: 'graph' as const,
      icon: Network,
      label: '图谱视图',
    },
    { mode: 'list' as const, icon: List, label: '列表视图' },
    { mode: 'map' as const, icon: Map, label: '地图视图' },
    {
      mode: 'timeline' as const,
      icon: Clock,
      label: '时间轴视图',
    },
  ];

  const getCategoryColor = (type: string) => {
    const colors: Record<string, string> = {
      inheritor: 'var(--color-primary)',
      technique: 'var(--color-secondary)',
      work: 'var(--color-accent)',
      pattern: 'var(--color-error)',
      region: 'var(--color-info)',
      period: 'var(--color-primary)',
      material: 'var(--color-success)',
    };
    return colors[type] || 'var(--color-primary)';
  };

  const loadEntities = useCallback(async () => {
    try {
      setLoading(true);
      const response = await knowledgeApi.search({});
      setEntities(response.results);
    } catch (error) {
      console.error('加载实体数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadEntities();
    loadStats();
  }, [loadEntities, loadStats]);

  const handleEntityClick = (entityId: string) => {
    setSelectedNode(entityId);
  };

  const handleSelectHistory = useCallback(
    (keyword: string, filters: { category?: string; region?: string[]; period?: string[] }) => {
      setKeyword(keyword);
      if (filters.category) setCategory(filters.category);
      if (filters.region) setRegion(filters.region);
      if (filters.period) setPeriod(filters.period);
    },
    [setKeyword, setCategory, setRegion, setPeriod]
  );

  const handleExport = useCallback(async (format: 'json' | 'csv') => {
    try {
      setExporting(true);
      const blob = await knowledgeApi.exportData(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `knowledge_graph_export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
    } finally {
      setExporting(false);
    }
  }, []);

  const handleImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      try {
        const result = await knowledgeApi.importData(formData);
        if (result.success) {
          alert(`成功导入 ${result.imported} 条数据`);
          loadEntities();
          loadStats();
        } else {
          alert(`导入失败: ${result.errors.join(', ')}`);
        }
      } catch (error) {
        console.error('导入失败:', error);
      }
    },
    [loadEntities, loadStats]
  );

  return (
    <div
      className="h-[calc(100vh-4rem)] min-h-0 relative overflow-hidden flex flex-col"
      style={{ background: 'var(--gradient-background)' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse"
          style={{ background: 'var(--color-primary)', opacity: 0.08 }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse"
          style={{ background: 'var(--color-secondary)', opacity: 0.08, animationDelay: '1s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-96 h-96 rounded-full blur-3xl animate-pulse"
          style={{ background: 'var(--color-accent)', opacity: 0.05, animationDelay: '2s' }}
        />

        <div
          className="absolute inset-0 bg-[linear-gradient(var(--color-border-light)_1px,transparent_1px),linear-gradient(90deg,var(--color-border-light)_1px,transparent_1px)] bg-[size:50px_50px]"
          style={{ opacity: 0.3 }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-6 flex flex-col flex-1 min-h-0">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-4xl font-bold mb-2"
                style={{
                  background: 'var(--gradient-primary)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                非遗知识图谱
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                探索千年文化传承的知识网络
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-wrap gap-3"
            >
              <div
                className="backdrop-blur-xl rounded-2xl p-4 min-w-[120px] flex-1 sm:flex-none"
                style={{
                  background: 'var(--gradient-card)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--color-shadow)',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen size={16} style={{ color: 'var(--color-primary)' }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    实体总数
                  </span>
                </div>
                <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {stats.totalEntities}
                </div>
              </div>

              <div
                className="backdrop-blur-xl rounded-2xl p-4 min-w-[120px] flex-1 sm:flex-none"
                style={{
                  background: 'var(--gradient-card)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--color-shadow)',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Network size={16} style={{ color: 'var(--color-secondary)' }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    关系总数
                  </span>
                </div>
                <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {stats.totalRelationships}
                </div>
              </div>

              <div
                className="backdrop-blur-xl rounded-2xl p-4 min-w-[120px] flex-1 sm:flex-none"
                style={{
                  background: 'var(--gradient-card)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--color-shadow)',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={16} style={{ color: 'var(--color-success)' }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    活跃度
                  </span>
                </div>
                <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  98%
                </div>
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
          <Suspense fallback={<SearchPanelSkeleton />}>
            <SearchPanel />
          </Suspense>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col gap-3 mb-4 xl:flex-row"
        >
          <div
            className="flex-1 backdrop-blur-xl rounded-2xl p-4"
            style={{
              background: 'var(--gradient-card)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--color-shadow)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {viewButtons.map(({ mode, icon: Icon, label }) => (
                  <motion.button
                    key={mode}
                    onClick={() => startTransitionFn(() => setViewMode(mode))}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl transition-all relative overflow-hidden"
                    style={{
                      background:
                        viewMode === mode ? 'var(--gradient-primary)' : 'var(--color-surface)',
                      color:
                        viewMode === mode
                          ? 'var(--color-text-inverse)'
                          : 'var(--color-text-secondary)',
                      border: viewMode === mode ? 'none' : '1px solid var(--color-border)',
                    }}
                  >
                    <Icon size={18} />
                    <span className="text-sm font-medium">{label}</span>
                    {viewMode === mode && (
                      <motion.div
                        layoutId="activeView"
                        className="absolute inset-0 rounded-xl"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        style={{ background: 'rgba(255,255,255,0.1)' }}
                      />
                    )}
                  </motion.button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  onClick={() => setShowSearchHistory(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <History size={16} />
                  <span className="text-sm">搜索历史</span>
                </motion.button>

                <motion.button
                  onClick={() => handleExport('json')}
                  disabled={exporting}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <Download size={16} />
                  <span className="text-sm">{exporting ? '导出中...' : '导出'}</span>
                </motion.button>

                <label
                  className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all cursor-pointer"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <Upload size={16} />
                  <span className="text-sm">导入</span>
                  <input
                    type="file"
                    accept=".json,.csv"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex gap-4 flex-1 min-h-0"
        >
          <ErrorBoundary>
            <Suspense fallback={<FilterPanelSkeleton />}>
              <FilterPanel />
            </Suspense>
          </ErrorBoundary>

          <div
            className="flex-1 backdrop-blur-xl rounded-2xl overflow-hidden relative"
            style={{
              background: 'var(--gradient-card)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--color-shadow)',
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(90deg, var(--color-primary), var(--color-secondary), var(--color-accent))',
                opacity: 0.05,
              }}
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`relative z-10 h-full w-full ${isPending ? 'opacity-50' : ''}`}
              >
                {viewMode === 'graph' && (
                  <ErrorBoundary>
                    <Suspense fallback={<GraphSkeleton />}>
                      <KnowledgeGraph />
                    </Suspense>
                  </ErrorBoundary>
                )}
                {viewMode === 'list' && (
                  <ErrorBoundary>
                    <Suspense fallback={<ListSkeleton />}>
                      <ListView
                        entities={entities}
                        onEntityClick={handleEntityClick}
                        loading={loading}
                      />
                    </Suspense>
                  </ErrorBoundary>
                )}
                {viewMode === 'map' && (
                  <ErrorBoundary>
                    <Suspense fallback={<MapSkeleton />}>
                      <MapView
                        entities={entities}
                        onEntityClick={handleEntityClick}
                        loading={loading}
                      />
                    </Suspense>
                  </ErrorBoundary>
                )}
                {viewMode === 'timeline' && (
                  <ErrorBoundary>
                    <Suspense fallback={<TimelineSkeleton />}>
                      <TimelineView
                        entities={entities}
                        onEntityClick={handleEntityClick}
                        loading={loading}
                      />
                    </Suspense>
                  </ErrorBoundary>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <ErrorBoundary>
            <Suspense fallback={<DetailPanelSkeleton />}>
              <DetailPanel />
            </Suspense>
          </ErrorBoundary>
        </motion.div>

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
              className="backdrop-blur-xl rounded-xl px-4 py-2 flex items-center gap-2"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {category.name}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                ({category.count})
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <SearchHistory
        visible={showSearchHistory}
        onClose={() => setShowSearchHistory(false)}
        onSelectHistory={handleSelectHistory}
      />
    </div>
  );
}
