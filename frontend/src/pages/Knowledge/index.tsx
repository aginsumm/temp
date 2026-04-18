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
  Bookmark,
  FolderOpen,
  X,
} from 'lucide-react';
import useKnowledgeGraphStore from '../../stores/knowledgeGraphStore';
import { knowledgeApi, Entity } from '../../api/knowledge';
import { snapshotService } from '../../api/snapshot';
import type { GraphSnapshot } from '../../types/chat';
import { graphSyncService } from '../../services/graphSyncService';
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
import { useToast } from '../../components/common/Toast';
import { loadSnapshot as loadSnapshotUtil } from '../../utils/snapshotHandler';

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
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshots, setSnapshots] = useState<GraphSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const toast = useToast();

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
          alert(`导入失败：${result.errors.join(', ')}`);
        }
      } catch (error) {
        console.error('导入失败:', error);
      }
    },
    [loadEntities, loadStats]
  );

  const loadSnapshots = useCallback(async () => {
    setIsLoadingSnapshots(true);
    try {
      const response = await snapshotService.listSnapshots(undefined, 1, 50);
      setSnapshots(response.snapshots);
      if (response.snapshots.length === 0) {
        toast.info('暂无快照', '还没有保存的图谱快照');
      }
    } catch (error) {
      console.error('Failed to load snapshots:', error);
      toast.error('加载失败', '无法加载快照列表');
    } finally {
      setIsLoadingSnapshots(false);
    }
  }, [toast]);

  const handleLoadSnapshot = useCallback(
    async (snapshot: GraphSnapshot) => {
      try {
        const fullSnapshot = await snapshotService.getSnapshot(snapshot.id);
        if (!fullSnapshot) {
          toast.error('加载失败', '快照数据不存在');
          return;
        }

        // 使用统一的快照加载函数
        const result = await loadSnapshotUtil(fullSnapshot, {
          updateFilters: true,
          dispatchEvent: true,
          saveToSession: false,
        });

        if (result.success) {
          // 使用 graphSyncService 更新图谱数据，确保同步到所有模块
          graphSyncService.updateFromKnowledge(
            fullSnapshot.entities,
            fullSnapshot.relations,
            fullSnapshot.keywords
          );

          toast.success('加载成功', `已加载快照 "${fullSnapshot.title || '未命名'}"`);
          setShowSnapshots(false);
        } else {
          toast.error('加载失败', result.error || '无法加载快照数据');
        }
      } catch (error) {
        console.error('Failed to load snapshot:', error);
        toast.error('加载失败', '无法加载快照数据');
      }
    },
    [toast]
  );

  useEffect(() => {
    if (showSnapshots) {
      loadSnapshots();
    }
  }, [showSnapshots, loadSnapshots]);

  // 页面加载时检查 sessionStorage 中是否有待加载的快照
  useEffect(() => {
    try {
      const pendingSnapshotData = sessionStorage.getItem('pendingSnapshot');
      if (pendingSnapshotData) {
        const { snapshot, entities, relations, keywords, filters } =
          JSON.parse(pendingSnapshotData);

        // 延迟发送事件，确保组件已完全加载
        setTimeout(() => {
          // 使用统一的快照加载函数
          const event = new CustomEvent('loadSnapshot', {
            detail: {
              snapshot,
              entities,
              relations,
              keywords,
              filters, // 包含筛选条件
            },
          });
          window.dispatchEvent(event);

          toast.success('快照已加载', `已恢复快照 "${snapshot.title || '未命名'}"`);

          // 清除 sessionStorage 中的数据
          sessionStorage.removeItem('pendingSnapshot');
        }, 300);
      }
    } catch (error) {
      console.error('Failed to restore snapshot from sessionStorage:', error);
      sessionStorage.removeItem('pendingSnapshot');
    }
  }, [toast]);

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
                  onClick={() => setShowSnapshots(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
                  style={{
                    background: 'var(--gradient-primary)',
                    color: 'var(--color-text-inverse)',
                    border: 'none',
                  }}
                >
                  <Bookmark size={16} />
                  <span className="text-sm">我的快照</span>
                </motion.button>

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

      {/* 快照面板 */}
      <AnimatePresence>
        {showSnapshots && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSnapshots(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-4xl max-h-[80vh] mx-4 rounded-2xl overflow-hidden"
              style={{
                background: 'var(--color-background)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--color-shadow)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-var(--color-border)">
                <div className="flex items-center gap-3">
                  <Bookmark size={24} style={{ color: 'var(--color-primary)' }} />
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    我的图谱快照
                  </h2>
                </div>
                <button
                  onClick={() => setShowSnapshots(false)}
                  className="p-2 rounded-lg transition-colors hover:bg-var(--color-surface)"
                >
                  <X size={20} style={{ color: 'var(--color-text-secondary)' }} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
                {isLoadingSnapshots ? (
                  <div className="flex items-center justify-center py-12">
                    <div
                      className="w-8 h-8 border-4 border-var(--color-primary) border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                    />
                  </div>
                ) : snapshots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FolderOpen size={48} style={{ color: 'var(--color-text-muted)' }} />
                    <p className="mt-4 text-lg" style={{ color: 'var(--color-text-secondary)' }}>
                      暂无快照
                    </p>
                    <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      在聊天页面保存图谱后可在此查看
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {snapshots.map((snapshot) => (
                      <motion.button
                        key={snapshot.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleLoadSnapshot(snapshot)}
                        className="p-4 rounded-xl text-left transition-all"
                        style={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <Bookmark size={18} style={{ color: 'var(--color-primary)' }} />
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {new Date(snapshot.created_at).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                        <h3
                          className="font-semibold mb-1 truncate"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {snapshot.title || '未命名快照'}
                        </h3>
                        <p
                          className="text-xs mb-3 line-clamp-2"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {snapshot.description ||
                            `${snapshot.entities?.length || 0} 个实体 · ${snapshot.relations?.length || 0} 条关系`}
                        </p>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              background: 'var(--color-primary)',
                              color: 'var(--color-text-inverse)',
                            }}
                          >
                            {snapshot.entities?.length || 0} 实体
                          </span>
                          <span
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              background: 'var(--color-secondary)',
                              color: 'var(--color-text-inverse)',
                            }}
                          >
                            {snapshot.relations?.length || 0} 关系
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchHistory
        visible={showSearchHistory}
        onClose={() => setShowSearchHistory(false)}
        onSelectHistory={handleSelectHistory}
      />
    </div>
  );
}
