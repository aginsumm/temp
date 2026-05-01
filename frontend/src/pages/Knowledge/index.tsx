import { useState, useEffect, lazy, Suspense, useCallback, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, List, Download, Bookmark, FolderOpen, X, SlidersHorizontal } from 'lucide-react';
import useKnowledgeGraphStore from '../../stores/knowledgeGraphStore';
import { knowledgeApi, Entity } from '../../api/knowledge';
import { useGraphStore, waitUntilGraphStoreRehydrated } from '../../stores/graphStore';
import { snapshotService } from '../../api/snapshot';
import type { GraphSnapshot } from '../../types/chat';
import { graphSyncService } from '../../services/graphSyncService';
import { GraphSkeleton, ListSkeleton } from '../../components/common/Skeleton';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useToast } from '../../components/common/Toast';

const KnowledgeGraph = lazy(() => import('../../components/knowledge/KnowledgeGraph'));
const ListView = lazy(() => import('../../components/knowledge/ListView'));
// 注意：移除了 SearchPanel 的引入，因为我们用不到上方搜索了
const FilterPanel = lazy(() => import('../../components/knowledge/FilterPanel'));

export default function KnowledgePage() {
  const { viewMode, setViewMode, setSelectedNode, toggleFilterPanel, filterPanelCollapsed } =
    useKnowledgeGraphStore();
  const [isPending, startTransitionFn] = useTransition();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [snapshots, setSnapshots] = useState<GraphSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const graphStoreEntities = useGraphStore((state) => state.entities);
  const graphStoreRelations = useGraphStore((state) => state.relations);
  const toast = useToast();

  const entities: Entity[] = graphStoreEntities.map((e) => ({
    ...(e as unknown as Entity),
    importance: (e as unknown as Entity).importance ?? (e.relevance ?? 0.5),
    created_at: (e as unknown as Entity).created_at || new Date().toISOString(),
    updated_at: (e as unknown as Entity).updated_at || new Date().toISOString(),
  }));

  const handleFilterChange = useCallback((filters: Record<string, unknown>) => {
    console.log('Filter changed:', filters);
  }, []);

  const viewButtons = [
    {
      mode: 'graph' as const,
      icon: Network,
      label: '图谱视图',
    },
    { mode: 'list' as const, icon: List, label: '列表视图' },
  ];

  const loadEntities = useCallback(async () => {
    await waitUntilGraphStoreRehydrated();
    const ents = useGraphStore.getState().entities;
    if (ents.length > 0) {
      return;
    }
    try {
      setLoading(true);
      const response = await knowledgeApi.search({});
      const mappedEntities = response.results.map((e) => ({
        ...(e as unknown as Entity),
        relevance: e.relevance ?? e.importance ?? 0.5,
      }));
      graphSyncService.updateFromKnowledge(mappedEntities, [], []);
    } catch (error) {
      console.error('加载实体数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntities();
  }, [graphStoreEntities.length, loadEntities]);

  const handleEntityClick = (entityId: string) => {
    setSelectedNode(entityId);
  };

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

  const loadSnapshots = useCallback(async () => {
    setIsLoadingSnapshots(true);
    try {
      const response = await snapshotService.listSnapshots(undefined, 1, 50);
      setSnapshots(response.snapshots);
    } catch (error) {
      console.error('Failed to load snapshots:', error);
    } finally {
      setIsLoadingSnapshots(false);
    }
  }, []);

  const handleLoadSnapshot = useCallback(
    async (snapshot: GraphSnapshot) => {
      try {
        const fullSnapshot = await snapshotService.getSnapshot(snapshot.id);
        if (!fullSnapshot) {
          return;
        }

        graphSyncService.updateFromSnapshot(
          fullSnapshot.entities,
          fullSnapshot.relations,
          fullSnapshot.keywords,
          fullSnapshot.session_id,
          fullSnapshot.message_id
        );

        setShowSnapshots(false);
        toast.success('导入成功', '图谱已更新');
      } catch (error) {
        console.error('Failed to load snapshot:', error);
        toast.error('导入失败');
      }
    },
    [toast]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await waitUntilGraphStoreRehydrated();
      if (cancelled) return;
      const { entities: ents, relations: rels } = useGraphStore.getState();
      if (ents.length > 0 && rels.length === 0) {
        knowledgeApi
          .getGraphData()
          .then((data) => {
            if (cancelled) return;
            const relationData = (data.edges || []).map((edge, index) => ({
              id: `knowledge_edge_${index}`,
              source: String(edge.source),
              target: String(edge.target),
              type: (edge.relationType || 'related_to') as 'related_to',
              confidence: Number(edge.value ?? edge.weight ?? 0.5),
            }));
            graphSyncService.updateFromKnowledge(ents, relationData, []);
          })
          .catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graphStoreEntities.length, graphStoreRelations.length]);

  useEffect(() => {
    if (showSnapshots) {
      loadSnapshots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSnapshots]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    try {
      const pendingSnapshotData = sessionStorage.getItem('pendingSnapshot');
      if (pendingSnapshotData) {
        const { snapshot, entities, relations, keywords, filters } =
          JSON.parse(pendingSnapshotData);

        timeoutId = setTimeout(() => {
          if (!isMounted) return;

          const event = new CustomEvent('loadSnapshot', {
            detail: {
              snapshot,
              entities,
              relations,
              keywords,
              filters,
            },
          });
          window.dispatchEvent(event);

          sessionStorage.removeItem('pendingSnapshot');
        }, 300);
      }
    } catch (error) {
      console.error('Failed to restore snapshot from sessionStorage:', error);
      sessionStorage.removeItem('pendingSnapshot');
    }

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <div
      data-testid="knowledge-page-root"
      className="h-[calc(100vh-4rem)] w-full relative overflow-hidden flex"
      style={{ background: 'var(--gradient-background)' }}
    >
      {/* 背景动画 (移到底层) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
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

      {/* 1. 左侧：侧边栏筛选面板 */}
      <aside
        className={`relative z-20 border-r transition-all duration-300 ease-in-out flex flex-col shadow-xl
          ${filterPanelCollapsed ? 'w-0 overflow-hidden opacity-0' : 'w-80 opacity-100'}
        `}
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {/* 顶部标题栏 */}
        <div
          className="p-4 border-b flex-shrink-0 flex items-center justify-between"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            数据筛选
          </h2>
        </div>
        {/* 筛选器滚动区 */}
        <div className="flex-1 overflow-y-auto p-4">
          <Suspense fallback={<ListSkeleton />}>
            <FilterPanel onFilterChange={handleFilterChange} />
          </Suspense>
        </div>
      </aside>

      {/* 2. 右侧：主体内容区 */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 h-full">
        {/* 悬浮在内容区左上角的工具栏 */}
        <div className="absolute top-4 left-6 z-20 flex items-center gap-3">
          {/* 收起/展开侧边栏按钮 */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleFilterPanel}
            className="p-2.5 rounded-xl shadow-lg backdrop-blur-md border transition-all"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
            }}
            title={filterPanelCollapsed ? '展开筛选' : '收起筛选'}
          >
            <SlidersHorizontal size={18} />
          </motion.button>

          {/* 视图切换按钮 */}
          <div
            className="flex backdrop-blur-md rounded-xl p-1 shadow-lg border"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            {viewButtons.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => startTransitionFn(() => setViewMode(mode))}
                className="p-2.5 rounded-lg transition-colors flex items-center gap-2"
                style={{
                  background: viewMode === mode ? 'var(--gradient-primary)' : 'transparent',
                  color:
                    viewMode === mode ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                }}
                title={label}
              >
                <Icon size={16} />
                {viewMode === mode && <span className="text-sm font-medium px-1">{label}</span>}
              </button>
            ))}
          </div>

          {/* 右侧工具组（快照/导出） */}
          <div className="flex gap-2">
            <motion.button
              onClick={() => setShowSnapshots(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all shadow-lg"
              style={{
                background: 'var(--gradient-primary)',
                color: 'var(--color-text-inverse)',
                border: 'none',
              }}
            >
              <Bookmark size={16} />
              <span className="text-sm font-medium">快照库</span>
            </motion.button>

            <motion.button
              onClick={() => handleExport('json')}
              disabled={exporting}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all shadow-lg disabled:opacity-50 border"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                borderColor: 'var(--color-border)',
              }}
            >
              <Download size={16} />
              <span className="text-sm font-medium">{exporting ? '处理中...' : '导出'}</span>
            </motion.button>
          </div>
        </div>

        {/* 动态视图渲染区域 */}
        <div className="flex-1 w-full h-full relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.3 }}
              className={`absolute inset-0 flex flex-col ${isPending ? 'opacity-50' : ''}`}
            >
              {viewMode === 'graph' ? (
                <ErrorBoundary>
                  <Suspense fallback={<GraphSkeleton />}>
                    <KnowledgeGraph />
                  </Suspense>
                </ErrorBoundary>
              ) : (
                <ErrorBoundary>
                  <Suspense fallback={<ListSkeleton />}>
                    {/* 给 ListView 一个好看的内边距，因为它现在占满整个右侧了 */}
                    <div className="flex-1 w-full h-full p-8 mt-16 overflow-hidden">
                      <ListView
                        entities={entities}
                        onEntityClick={handleEntityClick}
                        loading={loading}
                      />
                    </div>
                  </Suspense>
                </ErrorBoundary>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* 快照弹窗保持不变 */}
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
    </div>
  );
}
