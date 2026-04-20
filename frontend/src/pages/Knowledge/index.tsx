import { useState, useEffect, lazy, Suspense, useCallback, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, List, Download, Bookmark, FolderOpen, X } from 'lucide-react';
import useKnowledgeGraphStore from '../../stores/knowledgeGraphStore';
import { knowledgeApi, Entity } from '../../api/knowledge';
import { snapshotService } from '../../api/snapshot';
import type { GraphSnapshot } from '../../types/chat';
import { graphSyncService } from '../../services/graphSyncService';
import { GraphSkeleton, ListSkeleton } from '../../components/common/Skeleton';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useToast } from '../../components/common/Toast';

const KnowledgeGraph = lazy(() => import('../../components/knowledge/KnowledgeGraph'));
const ListView = lazy(() => import('../../components/knowledge/ListView'));

export default function KnowledgePage() {
  const { viewMode, setViewMode, setSelectedNode } = useKnowledgeGraphStore();
  const [isPending, startTransitionFn] = useTransition();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
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
  ];

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

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

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
      if (response.snapshots.length === 0) {
        // 使用函数形式，避免依赖 toast 对象
        toast.info('暂无快照', '还没有保存的图谱快照');
      }
    } catch (error) {
      console.error('Failed to load snapshots:', error);
      toast.error('加载失败', '无法加载快照列表');
    } finally {
      setIsLoadingSnapshots(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadSnapshot = useCallback(
    async (snapshot: GraphSnapshot) => {
      try {
        const fullSnapshot = await snapshotService.getSnapshot(snapshot.id);
        if (!fullSnapshot) {
          toast.error('加载失败', '快照数据不存在');
          return;
        }

        // 使用 graphSyncService 更新图谱数据，确保同步到所有模块
        graphSyncService.updateFromKnowledge(
          fullSnapshot.entities,
          fullSnapshot.relations,
          fullSnapshot.keywords
        );

        toast.success('加载成功', `已加载快照 "${fullSnapshot.title || '未命名'}"`);
        setShowSnapshots(false);
      } catch (error) {
        console.error('Failed to load snapshot:', error);
        toast.error('加载失败', '无法加载快照数据');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (showSnapshots) {
      loadSnapshots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSnapshots]);

  // 页面加载时检查 sessionStorage 中是否有待加载的快照
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    try {
      const pendingSnapshotData = sessionStorage.getItem('pendingSnapshot');
      if (pendingSnapshotData) {
        const { snapshot, entities, relations, keywords, filters } =
          JSON.parse(pendingSnapshotData);

        // 延迟发送事件，确保组件已完全加载
        timeoutId = setTimeout(() => {
          if (!isMounted) return;

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

    // 清理函数
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          className="mb-4"
        >
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-3xl font-bold mb-1"
              style={{
                background: 'var(--gradient-primary)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              知识图谱
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              探索知识关联网络
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <div
            className="backdrop-blur-xl rounded-2xl p-2"
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
                    className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all relative overflow-hidden"
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
                    <Icon size={16} />
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
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                  style={{
                    background: 'var(--gradient-primary)',
                    color: 'var(--color-text-inverse)',
                    border: 'none',
                  }}
                >
                  <Bookmark size={14} />
                  <span className="text-sm">快照</span>
                </motion.button>

                <motion.button
                  onClick={() => handleExport('json')}
                  disabled={exporting}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <Download size={14} />
                  <span className="text-sm">{exporting ? '导出中...' : '导出'}</span>
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex-1 min-h-0"
        >
          <div
            className="backdrop-blur-xl rounded-2xl overflow-hidden relative h-full"
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
              </motion.div>
            </AnimatePresence>
          </div>
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
    </div>
  );
}
