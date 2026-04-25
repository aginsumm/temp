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
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../../constants/categories';
import type { Entity, Relation, GraphNode, EntityType } from '../../../types/graph';

const ENTITY_COLORS: Record<EntityType, string> = CATEGORY_COLORS;

const ENTITY_LABELS: Record<EntityType, string> = CATEGORY_LABELS;

/**
 * HTML 转义函数，防止 XSS 攻击
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
}: DynamicGraphPanelProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  const { resolvedMode } = useThemeStore();

  const entities = useMemo(() => propEntities || [], [propEntities]);
  const relations = useMemo(() => propRelations || [], [propRelations]);
  const keywords = useMemo(() => propKeywords || [], [propKeywords]);

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
        formatter: (params: unknown) => {
          const param = params as Record<string, unknown>;
          if (param.dataType === 'node' && param.data) {
            const data = param.data as Record<string, unknown>;
            const category = data.category as EntityType;
            const color = ENTITY_COLORS[category] || '#666666';
            const value = (data.value as number) ?? 0.5;
            const name = escapeHtml(String(data.name || ''));
            const description = data.description as string | undefined;
            const safeDescription = description ? escapeHtml(description.slice(0, 80)) : '';
            return `
              <div style="padding: 12px; min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color}; box-shadow: 0 0 10px ${color}"></div>
                  <strong style="color: var(--color-primary); font-size: 16px;">${name}</strong>
                </div>
                <div style="color: var(--color-text-muted); font-size: 13px; margin-bottom: 4px;">
                  <span style="color: var(--color-text-secondary);">类型:</span> ${ENTITY_LABELS[category] || category}
                </div>
                <div style="color: var(--color-text-muted); font-size: 13px;">
                  <span style="color: var(--color-text-secondary);">重要性:</span>
                  <span style="color: var(--color-warning); font-weight: bold;">${(value * 100).toFixed(0)}%</span>
                </div>
                ${safeDescription ? `<div style="color: var(--color-text-secondary); font-size: 13px; margin-top: 4px;">${safeDescription}...</div>` : ''}
              </div>
            `;
          }
          const data = param.data as Record<string, unknown> | undefined;
          const source = escapeHtml(String(data?.source || ''));
          const target = escapeHtml(String(data?.target || ''));
          const relationType = escapeHtml(String(data?.relationType || '关联'));
          return `
            <div style="padding: 12px; min-width: 200px;">
              <div style="color: var(--color-primary); font-size: 14px; margin-bottom: 8px;">
                ${source} → ${target}
              </div>
              <div style="color: var(--color-text-muted); font-size: 13px;">
                <span style="color: var(--color-text-secondary);">关系:</span>
                <span style="color: var(--color-success); font-weight: bold;">${relationType}</span>
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
    chartInstance.current.on('click', (params: Record<string, unknown>) => {
      if (params.dataType === 'node') {
        const data = params.data as Record<string, unknown>;
        const entity = entities.find((e) => e.id === data.id);
        if (entity && onNodeClick) {
          onNodeClick(entity);
        }
        setSelectedNode({
          id: String(data.id || ''),
          name: String(data.name || ''),
          category: (data.category as EntityType) || 'entity',
          value: Number(data.value || 0.5),
          description: data.description as string | undefined,
        });
      }
    });

    chartInstance.current.off('mouseover');
    chartInstance.current.on('mouseover', (params: Record<string, unknown>) => {
      if (params.dataType === 'node') {
        const data = params.data as Record<string, unknown> | undefined;
        if (data) {
          setHoveredNode({
            id: String(data.id || ''),
            name: String(data.name || ''),
            category: (data.category as EntityType) || 'entity',
            value: Number(data.value || 0.5),
            description: data.description as string | undefined,
          });
        } else {
          setHoveredNode(null);
        }
      }
    });

    chartInstance.current.off('mouseout');
    chartInstance.current.on('mouseout', () => {
      setHoveredNode(null);
    });
  }, [graphData, selectedNode, resolvedMode, entities, onNodeClick]);

  const renderGraphRef = useRef(renderGraph);
  renderGraphRef.current = renderGraph;

  useEffect(() => {
    if (chartRef.current && graphData.nodes.length > 0) {
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current);
      }
      renderGraphRef.current();
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [graphData]);

  useEffect(() => {
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [renderGraph]);

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
      onSaveSnapshot?.();
    } catch (error) {
      console.error('Failed to save snapshot:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!sessionId || !messageId) {
      return;
    }

    try {
      let snapshotId = messageId;
      let snapshot = await snapshotService.getSnapshot(snapshotId);
      if (!snapshot) {
        snapshot = await snapshotService.createSnapshot({
          session_id: sessionId,
          message_id: messageId,
          graph_data: graphData,
          keywords: keywords.length > 0 ? keywords : [],
          entities,
          relations: relations || [],
        });
        snapshotId = snapshot.id;
      }

      const result = await snapshotService.shareSnapshot(snapshotId, 7);

      if (result && result.share_url) {
        await navigator.clipboard.writeText(result.share_url);
      }
    } catch (error) {
      console.error('Failed to share snapshot:', error);
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
