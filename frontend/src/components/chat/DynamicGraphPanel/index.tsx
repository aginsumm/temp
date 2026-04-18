import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as echarts from 'echarts';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Download,
  Save,
  Share2,
  Info,
  X,
} from 'lucide-react';
import { graphService } from '../../../api/graph';
import { snapshotService } from '../../../api/snapshot';
import { useToast } from '../../common/Toast';
import { useThemeStore } from '../../../stores/themeStore';
import { useChatStore } from '../../../stores/chatStore';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../../constants/categories';
import type { Entity, Relation, GraphNode, EntityType } from '../../../types/chat';

const ENTITY_COLORS: Record<EntityType, string> = CATEGORY_COLORS;

const ENTITY_LABELS: Record<EntityType, string> = CATEGORY_LABELS;

interface DynamicGraphPanelProps {
  entities?: Entity[];
  relations?: Relation[];
  keywords?: string[];
  sessionId?: string;
  messageId?: string;
  onSaveSnapshot?: () => void;
  onNodeClick?: (entity: Entity) => void;
  height?: number | string;
  showControls?: boolean;
  showSaveButton?: boolean;
  useStoreData?: boolean; // 是否直接使用 chatStore 的数据
}

export default function DynamicGraphPanel({
  entities: propEntities,
  relations: propRelations,
  keywords: propKeywords,
  sessionId,
  messageId,
  onSaveSnapshot,
  onNodeClick,
  height = 280,
  showControls = true,
  showSaveButton = true,
  useStoreData = false,
}: DynamicGraphPanelProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  const { resolvedMode } = useThemeStore();

  // 根据 useStoreData 决定使用 props 还是 store 的数据
  const storeEntities = useChatStore((state) => state.currentEntities);
  const storeRelations = useChatStore((state) => state.currentRelations);
  const storeKeywords = useChatStore((state) => state.currentKeywords);

  const entities = useMemo(() => {
    return useStoreData ? storeEntities : propEntities || [];
  }, [useStoreData, storeEntities, propEntities]);

  const relations = useMemo(() => {
    return useStoreData ? storeRelations : propRelations || [];
  }, [useStoreData, storeRelations, propRelations]);

  const keywords = useMemo(() => {
    return useStoreData ? storeKeywords : propKeywords || [];
  }, [useStoreData, storeKeywords, propKeywords]);

  const toast = useToast();

  const graphData = useMemo(() => {
    if (entities.length === 0) {
      return { nodes: [], edges: [] };
    }
    return graphService.entitiesToGraphData(entities, relations, {
      maxNodes: 50,
      minRelevance: 0.3,
    });
  }, [entities, relations]);

  const stats = useMemo(() => {
    return graphService.calculateGraphStats(graphData);
  }, [graphData]);

  const renderGraph = useCallback(() => {
    if (!chartInstance.current || graphData.nodes.length === 0) return;

    const isDark = resolvedMode === 'dark';
    const textColor = isDark ? '#e2e8f0' : '#1e293b';
    const bgColor = 'transparent';
    const borderColor = isDark ? '#334155' : '#e2e8f0';

    const option: echarts.EChartsOption = {
      backgroundColor: bgColor,
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: borderColor,
        borderWidth: 2,
        textStyle: {
          color: textColor,
          fontSize: 14,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          if (params.dataType === 'node' && params.data) {
            const category = params.data.category as EntityType;
            const color = ENTITY_COLORS[category] || '#666666';
            const value = params.data.value ?? 0.5;
            return `
              <div style="padding: 12px; min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color}; box-shadow: 0 0 10px ${color}"></div>
                  <strong style="color: var(--color-primary); font-size: 16px;">${params.data.name}</strong>
                </div>
                <div style="color: var(--color-text-muted); font-size: 13px; margin-bottom: 4px;">
                  <span style="color: var(--color-text-secondary);">类型:</span> ${ENTITY_LABELS[category] || params.data.category}
                </div>
                <div style="color: var(--color-text-muted); font-size: 13px;">
                  <span style="color: var(--color-text-secondary);">重要性:</span> 
                  <span style="color: var(--color-warning); font-weight: bold;">${(value * 100).toFixed(0)}%</span>
                </div>
                ${params.data.description ? `<div style="color: var(--color-text-secondary); font-size: 13px; margin-top: 4px;">${params.data.description.slice(0, 80)}...</div>` : ''}
              </div>
            `;
          }
          return `
            <div style="padding: 12px; min-width: 200px;">
              <div style="color: var(--color-primary); font-size: 14px; margin-bottom: 8px;">
                ${params.data?.source} → ${params.data?.target}
              </div>
              <div style="color: var(--color-text-muted); font-size: 13px;">
                <span style="color: var(--color-text-secondary);">关系:</span> 
                <span style="color: var(--color-success); font-weight: bold;">${params.data?.relationType || '关联'}</span>
              </div>
            </div>
          `;
        },
      },
      animationDuration: 1500,
      animationEasingUpdate: 'quinticInOut',
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: graphData.nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const color = ENTITY_COLORS[node.category] || '#666666';

            return {
              ...node,
              symbolSize: node.symbolSize || 30,
              itemStyle: {
                ...node.itemStyle,
                color: color,
                borderColor: isSelected ? 'var(--color-warning)' : 'var(--color-border)',
                borderWidth: isSelected ? 4 : 2,
                shadowBlur: 15,
                shadowColor: color,
                shadowOffsetX: 0,
                shadowOffsetY: 0,
              },
              label: {
                show: true,
                position: 'bottom',
                distance: 8,
                formatter: '{b}',
                fontSize: 13,
                color: textColor,
                fontWeight: 500 as const,
                textShadowColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                textShadowBlur: 6,
              },
            };
          }),
          links: graphData.edges.map((edge) => ({
            source: edge.source,
            target: edge.target,
            lineStyle: {
              color: edge.lineStyle?.color || 'var(--color-border)',
              width: edge.lineStyle?.width || 2,
              curveness: 0.3,
              opacity: 0.5,
            },
          })),
          roam: true,
          draggable: true,
          focusNodeAdjacency: true,
          force: {
            repulsion: 1500,
            edgeLength: [100, 200],
            gravity: 0.1,
            friction: 0.6,
            layoutAnimation: true,
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              width: 5,
              color: 'var(--color-primary)',
            },
            itemStyle: {
              shadowBlur: 40,
              shadowColor: 'var(--color-shadow-glow)',
            },
            label: {
              fontSize: 16,
              fontWeight: 'bold',
            },
          },
          blur: {
            itemStyle: {
              opacity: 0.3,
            },
            lineStyle: {
              opacity: 0.1,
            },
          },
          lineStyle: {
            color: 'var(--color-border)',
            curveness: 0.3,
            opacity: 0.5,
          },
        },
      ],
    };

    chartInstance.current.setOption(option, true);

    chartInstance.current.off('click');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chartInstance.current.on('click', (params: any) => {
      if (params.dataType === 'node') {
        const entity = entities.find((e) => e.id === params.data.id);
        if (entity && onNodeClick) {
          onNodeClick(entity);
        }
        setSelectedNode(params.data);
      }
    });

    chartInstance.current.off('mouseover');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chartInstance.current.on('mouseover', (params: any) => {
      if (params.dataType === 'node') {
        setHoveredNode(params.data);
      }
    });

    chartInstance.current.off('mouseout');
    chartInstance.current.on('mouseout', () => {
      setHoveredNode(null);
    });
  }, [graphData, selectedNode, resolvedMode, entities, onNodeClick]);

  useEffect(() => {
    if (chartRef.current && graphData.nodes.length > 0) {
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current);
      }
      renderGraph();
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [graphData, renderGraph]);

  useEffect(() => {
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    // 监听快照加载事件
    const handleSnapshotLoaded = () => {
      // 快照数据会通过 props 自动更新，这里只需要重新渲染
      setTimeout(() => {
        renderGraph();
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.addEventListener('loadSnapshot' as any, handleSnapshotLoaded as any);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.removeEventListener('loadSnapshot' as any, handleSnapshotLoaded as any);
    };
  }, [renderGraph]);

  // 当图谱数据变化时，自动保存到 sessionStorage
  useEffect(() => {
    if (graphData.nodes.length > 0 && sessionId) {
      try {
        const graphState = {
          entities,
          relations,
          keywords,
          sessionId,
          timestamp: Date.now(),
        };
        sessionStorage.setItem(`graphState_${sessionId}`, JSON.stringify(graphState));
      } catch (error) {
        console.warn('Failed to save graph state to sessionStorage:', error);
      }
    }
  }, [entities, relations, keywords, sessionId, graphData.nodes.length]);

  // 页面加载时恢复图谱状态
  useEffect(() => {
    if (sessionId && !entities.length) {
      try {
        const savedState = sessionStorage.getItem(`graphState_${sessionId}`);
        if (savedState) {
          const {
            entities: savedEntities,
            relations: savedRelations,
            keywords: savedKeywords,
          } = JSON.parse(savedState);

          // 检查是否是同一个会话的图谱状态
          const event = new CustomEvent('restoreGraphState', {
            detail: {
              entities: savedEntities,
              relations: savedRelations,
              keywords: savedKeywords,
            },
          });
          window.dispatchEvent(event);
        }
      } catch (error) {
        console.warn('Failed to restore graph state from sessionStorage:', error);
      }
    }
  }, [sessionId, entities.length]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      renderGraph();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [renderGraph]);

  const handleZoomIn = () => {
    if (chartInstance.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const option = chartInstance.current.getOption() as any;
      const zoom = (option.series[0].zoom || 1) * 1.2;
      chartInstance.current.setOption({
        series: [{ zoom }],
      });
    }
  };

  const handleZoomOut = () => {
    if (chartInstance.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const option = chartInstance.current.getOption() as any;
      const zoom = (option.series[0].zoom || 1) / 1.2;
      chartInstance.current.setOption({
        series: [{ zoom: Math.max(zoom, 0.3) }],
      });
    }
  };

  const handleReset = () => {
    if (chartInstance.current) {
      chartInstance.current.setOption({
        series: [{ zoom: 1, center: undefined }],
      });
      setSelectedNode(null);
    }
  };

  const handleFullscreen = () => {
    if (chartRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        chartRef.current.requestFullscreen();
      }
    }
  };

  const handleExport = () => {
    if (chartInstance.current) {
      const isDark = resolvedMode === 'dark';
      const bgColor = isDark ? '#0f172a' : '#ffffff';
      const url = chartInstance.current.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: bgColor,
      });
      const link = document.createElement('a');
      link.download = `knowledge-graph-${Date.now()}.png`;
      link.href = url;
      link.click();
      toast.success('导出成功', '图谱已保存为图片');
    }
  };

  const handleSaveSnapshot = async () => {
    if (!sessionId || !messageId) {
      toast.warning('无法保存', '缺少会话或消息信息');
      return;
    }

    setIsSaving(true);
    try {
      await snapshotService.createSnapshot({
        session_id: sessionId,
        message_id: messageId,
        graph_data: graphData,
        keywords: keywords.length > 0 ? keywords : [],
        entities,
        relations: relations || [],
      });
      toast.success('保存成功', '图谱快照已保存');
      onSaveSnapshot?.();
    } catch (error) {
      console.error('Failed to save snapshot:', error);
      toast.error('保存失败', '无法保存图谱快照');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!sessionId || !messageId) {
      toast.warning('无法分享', '缺少会话或消息信息');
      return;
    }

    try {
      const snapshotId = messageId;

      const result = await snapshotService.shareSnapshot(snapshotId, 7);

      if (result && result.share_url) {
        // 直接使用后端返回的完整 URL
        await navigator.clipboard.writeText(result.share_url);
        toast.success('分享成功', '链接已复制到剪贴板，7 天内有效');
      } else {
        toast.success('分享成功', '快照已设置为共享状态');
      }
    } catch (error) {
      console.error('Failed to share snapshot:', error);
      toast.error('分享失败', '无法分享图谱快照');
    }
  };

  if (graphData.nodes.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ height, background: 'var(--color-background-secondary)' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
          style={{ background: 'var(--color-background-tertiary)' }}
        >
          <Info size={24} style={{ color: 'var(--color-text-muted)' }} />
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          暂无知识图谱数据
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>
          发送消息后将自动生成
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={chartRef} className="w-full h-full" />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-2 left-2 px-2 py-1 rounded-lg text-xs"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <span className="font-medium">{stats.nodeCount}</span> 节点 ·{' '}
        <span className="font-medium">{stats.edgeCount}</span> 关系
      </motion.div>

      {showControls && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-2 right-2 flex flex-col gap-1"
        >
          {[
            { icon: ZoomIn, label: '放大', onClick: handleZoomIn },
            { icon: ZoomOut, label: '缩小', onClick: handleZoomOut },
            { icon: RotateCcw, label: '重置', onClick: handleReset },
            {
              icon: Maximize2,
              label: isFullscreen ? '退出全屏' : '全屏',
              onClick: handleFullscreen,
            },
            { icon: Download, label: '导出', onClick: handleExport },
          ].map((item) => (
            <motion.button
              key={item.label}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={item.onClick}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-light)',
                color: 'var(--color-text-secondary)',
              }}
              title={item.label}
            >
              <item.icon size={14} />
            </motion.button>
          ))}
        </motion.div>
      )}

      {showSaveButton && sessionId && messageId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-2 right-2 flex gap-1"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleShare}
            className="px-2 py-1 rounded-lg text-xs flex items-center gap-1"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-light)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <Share2 size={12} />
            分享
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSaveSnapshot}
            disabled={isSaving}
            className="px-2 py-1 rounded-lg text-xs flex items-center gap-1"
            style={{
              background: 'var(--gradient-primary)',
              color: 'var(--color-text-inverse)',
            }}
          >
            <Save size={12} />
            {isSaving ? '保存中...' : '保存快照'}
          </motion.button>
        </motion.div>
      )}

      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-12 left-2 right-2 p-3 rounded-lg"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-light)',
              boxShadow: 'var(--color-shadow)',
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: ENTITY_COLORS[selectedNode.category] }}
                  />
                  <span
                    className="font-medium text-sm"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {selectedNode.name}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {ENTITY_LABELS[selectedNode.category]}
                </p>
                {selectedNode.description && (
                  <p
                    className="text-xs mt-1 line-clamp-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {selectedNode.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hoveredNode && !selectedNode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-2 left-2 px-2 py-1 rounded text-xs"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-light)',
              color: 'var(--color-text-primary)',
            }}
          >
            {hoveredNode.name}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
