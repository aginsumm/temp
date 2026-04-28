import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Tag,
  PanelRightClose,
  PanelRightOpen,
  Search,
  X,
  Network,
  History,
  Bookmark,
  ExternalLink,
} from 'lucide-react';
import { useUIStore, MIN_RIGHT_PANEL_WIDTH, MAX_RIGHT_PANEL_WIDTH } from '../../../stores/uiStore';
import { useResizablePanel } from '../../../hooks/useResizablePanel';
import DynamicGraphPanel from '../DynamicGraphPanel';
import ErrorBoundary from '../../common/ErrorBoundary';
import { snapshotService } from '../../../api/snapshot';
import ConfirmDialog from '../../common/ConfirmDialog';
import { LoadingOverlay } from '../../common/ProgressBar';
import type { Entity, Relation } from '../../../types/graph';
import type { GraphSnapshot } from '../../../types/chat';
import { useNavigate } from 'react-router-dom';
import { graphSyncService } from '../../../services/graphSyncService';

interface Keyword {
  text: string;
  relevance?: number;
  category?: string;
}

interface RightPanelProps {
  keywords?: string[] | Keyword[];
  entities?: Entity[];
  relations?: Relation[];
  sessionId?: string;
  messageId?: string;
  onKeywordClick?: (keyword: string) => void;
  onEntityClick?: (entity: Entity) => void;
  onLoadSnapshot?: (snapshot: GraphSnapshot) => void;
}

type TabType = 'keywords' | 'graph' | 'history';

export default function RightPanel({
  keywords: propKeywords,
  entities: propEntities,
  relations: propRelations,
  sessionId,
  messageId,
  onKeywordClick,
  onEntityClick,
  onLoadSnapshot,
}: RightPanelProps) {
  const { rightPanelCollapsed, toggleRightPanel, rightPanelWidth, setRightPanelWidth } =
    useUIStore();
  const [isHovered, setIsHovered] = useState(false);
  const [keywordSearch, setKeywordSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('keywords');
  const [snapshots, setSnapshots] = useState<GraphSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<GraphSnapshot | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<number | undefined>(undefined);

  const entities = useMemo(() => propEntities || [], [propEntities]);
  const relations = useMemo(() => propRelations || [], [propRelations]);
  const keywords = useMemo(() => propKeywords || [], [propKeywords]);

  const navigate = useNavigate();

  // 监听快照加载事件
  useEffect(() => {
    const handleLoadSnapshot = (event: Event) => {
      const customEvent = event as CustomEvent<GraphSnapshot>;
      if (onLoadSnapshot && customEvent.detail) {
        onLoadSnapshot(customEvent.detail);
      }
    };

    window.addEventListener('loadSnapshot', handleLoadSnapshot);
    return () => {
      window.removeEventListener('loadSnapshot', handleLoadSnapshot);
    };
  }, [onLoadSnapshot]);

  const { isResizing, handleMouseDown } = useResizablePanel({
    initialWidth: rightPanelWidth,
    minWidth: MIN_RIGHT_PANEL_WIDTH,
    maxWidth: MAX_RIGHT_PANEL_WIDTH,
    collapsed: rightPanelCollapsed,
    onWidthChange: setRightPanelWidth,
    direction: 'right',
  });

  const processedKeywords = useMemo(() => {
    if (!keywords || keywords.length === 0) return [];
    return keywords.map((k) =>
      typeof k === 'string' ? { text: k, relevance: 1 } : k
    ) as Keyword[];
  }, [keywords]);

  const filteredKeywords = useMemo(() => {
    if (!keywordSearch) return processedKeywords;
    return processedKeywords.filter((k) =>
      k.text.toLowerCase().includes(keywordSearch.toLowerCase())
    );
  }, [processedKeywords, keywordSearch]);

  const hasGraphData = entities.length > 0;

  const loadSnapshots = useCallback(async () => {
    if (!sessionId) return;
    setIsLoadingSnapshots(true);
    setLoadingProgress(0);
    try {
      const progressInterval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev === undefined || prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 100);

      const response = await snapshotService.listSnapshots(sessionId, 1, 10);
      setSnapshots(response.snapshots);
      setLoadingProgress(100);

      clearInterval(progressInterval);
    } catch (error) {
      console.warn('Failed to load snapshots:', error);
      setLoadingProgress(undefined);
    } finally {
      setIsLoadingSnapshots(false);
      setTimeout(() => setLoadingProgress(undefined), 300);
    }
  }, [sessionId]);

  useEffect(() => {
    if (activeTab === 'history' && sessionId) {
      loadSnapshots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, sessionId]);

  const handleSnapshotClick = useCallback(async (snapshot: GraphSnapshot) => {
    setPendingSnapshot(snapshot);
    setShowConfirmDialog(true);
  }, []);

  const confirmLoadSnapshot = useCallback(async () => {
    if (!pendingSnapshot) return;

    setShowConfirmDialog(false);

    try {
      const fullSnapshot = await snapshotService.getSnapshot(pendingSnapshot.id);
      if (!fullSnapshot) {
        return;
      }

      if (onLoadSnapshot) {
        onLoadSnapshot(fullSnapshot);
      }

      graphSyncService.updateFromSnapshot(
        fullSnapshot.entities,
        fullSnapshot.relations,
        fullSnapshot.keywords,
        fullSnapshot.session_id,
        fullSnapshot.message_id
      );
    } catch (error) {
      console.error('Failed to load snapshot:', error);
    } finally {
      setPendingSnapshot(null);
    }
  }, [pendingSnapshot, onLoadSnapshot]);

  const handleViewInKnowledgePage = useCallback(
    async (snapshot: GraphSnapshot) => {
      try {
        const fullSnapshot = await snapshotService.getSnapshot(snapshot.id);
        if (!fullSnapshot) {
          return;
        }

        sessionStorage.setItem(
          'pendingSnapshot',
          JSON.stringify({
            snapshot: fullSnapshot,
            entities: fullSnapshot.entities,
            relations: fullSnapshot.relations,
            keywords: fullSnapshot.keywords,
          })
        );

        navigate('/knowledge');

        setTimeout(() => {
          const event = new CustomEvent('loadSnapshot', {
            detail: {
              snapshot: fullSnapshot,
              entities: fullSnapshot.entities,
              relations: fullSnapshot.relations,
              keywords: fullSnapshot.keywords,
            },
          });
          window.dispatchEvent(event);
        }, 500);
      } catch (error) {
        console.error('Failed to view snapshot in knowledge page:', error);
      }
    },
    [navigate]
  );

  const cancelLoadSnapshot = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingSnapshot(null);
  }, []);

  const tabs: Array<{ id: TabType; label: string; icon: typeof Tag; count?: number }> = useMemo(
    () => [
      {
        id: 'keywords',
        label: '关键词',
        icon: Tag,
        count: processedKeywords.length,
      },
      {
        id: 'graph',
        label: '知识图谱',
        icon: Network,
        count: entities.length,
      },
      {
        id: 'history',
        label: '历史快照',
        icon: History,
        count: snapshots.length,
      },
    ],
    [processedKeywords.length, entities.length, snapshots.length]
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'keywords':
        return (
          <div key="keywords" className="p-3 animate-fade-in">
            {processedKeywords.length > 0 && (
              <div className="mb-3">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{
                    background: 'var(--color-background-secondary)',
                  }}
                >
                  <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
                  <input
                    type="text"
                    value={keywordSearch}
                    onChange={(e) => setKeywordSearch(e.target.value)}
                    placeholder="搜索关键词..."
                    className="flex-1 bg-transparent outline-none text-xs"
                    style={{ color: 'var(--color-text-primary)' }}
                  />
                  {keywordSearch && (
                    <button
                      onClick={() => setKeywordSearch('')}
                      className="p-0.5 rounded hover:bg-gray-200 transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {filteredKeywords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {filteredKeywords.map((keyword, index) => (
                  <button
                    key={`${keyword.text}-${index}`}
                    onClick={() => onKeywordClick?.(keyword.text)}
                    className="px-2.5 py-1 rounded-md text-xs transition-all duration-200 whitespace-nowrap hover:translate-y-[-1px]"
                    style={{
                      background: 'var(--color-background-secondary)',
                      color: 'var(--color-text-secondary)',
                      fontSize: keyword.relevance && keyword.relevance > 0.8 ? '13px' : '12px',
                      fontWeight: keyword.relevance && keyword.relevance > 0.8 ? 500 : 400,
                    }}
                  >
                    {keyword.text}
                  </button>
                ))}
              </div>
            ) : processedKeywords.length > 0 ? (
              <div className="text-center py-6">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  未找到匹配的关键词
                </p>
              </div>
            ) : (
              <div className="text-center py-10">
                <div
                  className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-3"
                  style={{ background: 'var(--color-background-secondary)' }}
                >
                  <Tag size={20} style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  暂无关键词
                </p>
                <p
                  className="text-[11px] mt-1"
                  style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
                >
                  发送消息后将显示关键词
                </p>
              </div>
            )}
          </div>
        );

      case 'graph':
        return (
          <motion.div
            key="graph"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col h-full"
          >
            <div className="flex-1 min-h-0">
              <ErrorBoundary>
                <DynamicGraphPanel
                  entities={entities}
                  relations={relations}
                  keywords={processedKeywords.map((k) => k.text)}
                  sessionId={sessionId}
                  messageId={messageId}
                  onNodeClick={onEntityClick}
                  height="100%"
                  showControls={true}
                  showSaveButton={true}
                />
              </ErrorBoundary>
            </div>
          </motion.div>
        );

      case 'history':
        return (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 relative"
          >
            {isLoadingSnapshots && (
              <LoadingOverlay
                isLoading={isLoadingSnapshots}
                message="加载快照列表中..."
                progress={loadingProgress}
              />
            )}
            {snapshots.length > 0 ? (
              <div className="space-y-2">
                {snapshots.map((snapshot) => (
                  <motion.div
                    key={snapshot.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full"
                  >
                    <div
                      className="w-full p-3 rounded-lg text-left transition-all"
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-xs font-medium truncate"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {snapshot.title || '未命名快照'}
                          </p>
                          <p
                            className="text-[11px] mt-1"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            {snapshot.entities.length} 个实体 · {snapshot.relations.length} 个关系
                          </p>
                          <p
                            className="text-[10px] mt-1"
                            style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
                          >
                            {new Date(snapshot.created_at).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        {snapshot.is_shared && (
                          <Bookmark size={12} style={{ color: 'var(--color-primary)' }} />
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSnapshotClick(snapshot)}
                        className="flex-1 px-3 py-2 rounded-lg text-xs transition-all"
                        style={{
                          background: 'var(--gradient-primary)',
                          color: 'var(--color-text-inverse)',
                        }}
                      >
                        加载到当前页面
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleViewInKnowledgePage(snapshot)}
                        className="flex-1 px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-center gap-1"
                        style={{
                          background: 'var(--color-surface)',
                          color: 'var(--color-text-secondary)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <ExternalLink size={12} />
                        知识图谱查看
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <div
                  className="w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-3"
                  style={{ background: 'var(--color-background-tertiary)' }}
                >
                  <History size={24} style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  暂无历史快照
                </p>
                <p
                  className="text-[11px] mt-1"
                  style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
                >
                  在图谱标签页保存快照
                </p>
              </div>
            )}
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <motion.button
        onClick={toggleRightPanel}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="fixed z-50 flex items-center justify-center transition-all duration-300"
        style={{
          right: rightPanelCollapsed ? 16 : rightPanelWidth + 8,
          top: 'calc(50% + 2rem)',
          transform: 'translateY(-50%)',
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <div
          className="relative w-10 h-20 rounded-l-xl transition-all duration-300"
          style={{
            background: rightPanelCollapsed ? 'var(--gradient-secondary)' : 'var(--color-surface)',
            backdropFilter: rightPanelCollapsed ? 'none' : 'blur(12px)',
            border: rightPanelCollapsed ? 'none' : '1px solid var(--color-border-light)',
            borderRight: 'none',
            boxShadow: rightPanelCollapsed ? 'var(--color-shadow-glow)' : 'var(--color-shadow)',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            {rightPanelCollapsed ? (
              <PanelRightOpen size={20} style={{ color: 'var(--color-text-inverse)' }} />
            ) : (
              <PanelRightClose size={20} style={{ color: 'var(--color-text-muted)' }} />
            )}
          </div>
          {rightPanelCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              className="absolute left-full ml-2 px-3 py-1.5 text-xs rounded-lg whitespace-nowrap"
              style={{
                background: 'var(--color-text-primary)',
                color: 'var(--color-text-inverse)',
              }}
            >
              展开信息面板
            </motion.div>
          )}
        </div>
      </motion.button>

      <motion.aside
        initial={false}
        animate={{
          width: rightPanelCollapsed ? 0 : rightPanelWidth,
          opacity: rightPanelCollapsed ? 0 : 1,
        }}
        transition={isResizing ? { duration: 0 } : { duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="h-full min-h-0 flex flex-col overflow-hidden relative transition-colors duration-300"
        style={{
          background: rightPanelCollapsed
            ? 'transparent'
            : 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background-secondary) 100%)',
          borderLeft: rightPanelCollapsed ? 'none' : '1px solid var(--color-border-light)',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex flex-col h-full">
          <div
            className="px-3 py-2"
            style={{ borderBottom: '1px solid var(--color-border-light)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm"
                  style={{ background: 'var(--gradient-secondary)' }}
                >
                  <Tag size={12} style={{ color: 'var(--color-text-inverse)' }} />
                </div>
                <h2
                  className="text-xs font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  信息面板
                </h2>
              </div>
              <motion.button
                onClick={toggleRightPanel}
                className="w-5 h-5 rounded-md flex items-center justify-center transition-colors"
                style={{ color: 'var(--color-text-muted)', background: 'transparent' }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <ChevronRight size={12} />
              </motion.button>
            </div>

            <div
              className="flex gap-1 mt-2 p-1 rounded-lg"
              style={{ background: 'var(--color-background-secondary)' }}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 px-2 py-1.5 rounded-md text-xs flex items-center justify-center gap-1 transition-all duration-200"
                  style={{
                    background: activeTab === tab.id ? 'var(--color-surface)' : 'transparent',
                    color:
                      activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none',
                    fontWeight: activeTab === tab.id ? 500 : 400,
                  }}
                >
                  <tab.icon size={12} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className="ml-0.5 px-1 rounded text-[10px]"
                      style={{
                        background:
                          activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-border)',
                        color:
                          activeTab === tab.id
                            ? 'var(--color-text-inverse)'
                            : 'var(--color-text-muted)',
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">{renderTabContent()}</AnimatePresence>
          </div>

          {hasGraphData && activeTab === 'graph' && (
            <div
              className="px-3 py-2 text-center text-[10px]"
              style={{
                color: 'var(--color-text-muted)',
                borderTop: '1px solid var(--color-border-light)',
              }}
            >
              点击节点查看详情 · 拖拽移动 · 滚轮缩放
            </div>
          )}
        </div>

        {!rightPanelCollapsed && (
          <div
            onMouseDown={handleMouseDown}
            className={`panel-resize-handle ${isResizing ? 'resizing' : ''}`}
          >
            <div className="panel-resize-indicator" />
          </div>
        )}
      </motion.aside>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="加载快照"
        message={`确定要加载快照 "${pendingSnapshot?.title || '未命名快照'}" 吗？这将替换当前的知识图谱数据。`}
        type="warning"
        confirmText="加载"
        cancelText="取消"
        onConfirm={confirmLoadSnapshot}
        onCancel={cancelLoadSnapshot}
      />
    </>
  );
}
