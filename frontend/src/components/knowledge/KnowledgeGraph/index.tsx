import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as echarts from 'echarts';
import { knowledgeApi, GraphData as KnowledgeGraphData, GraphNode } from '../../../api/knowledge';
import useKnowledgeGraphStore from '../../../stores/knowledgeGraphStore';
import { useGraphStore } from '../../../stores/graphStore';
import { useThemeStore } from '../../../stores/themeStore';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { optimizeGraphData } from '../../../utils/graphOptimizer';
import { GraphSkeleton } from '../../common/Skeleton';
import { useToast } from '../../common/Toast';
import { graphService } from '../../../api/graph';
import { graphSyncService } from '../../../services/graphSyncService';
import { getCategoryColor, getCategoryLabel } from '../../../constants/categories';
import type { Entity } from '../../../types/chat';

export default function KnowledgeGraph() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [rawGraphData, setRawGraphData] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const { selectedNode, highlightedNodes, layoutType, setSelectedNode, setHighlightedNodes } =
    useKnowledgeGraphStore();

  // 订阅统一的 graphStore
  const graphStoreEntities = useGraphStore((state) => state.entities);
  const graphStoreRelations = useGraphStore((state) => state.relations);
  const graphStoreSource = useGraphStore((state) => state.source);

  const { resolvedMode } = useThemeStore();
  const toast = useToast();

  const graphData = useMemo(() => {
    if (!rawGraphData) return null;

    return optimizeGraphData(rawGraphData);
  }, [rawGraphData]);

  const renderGraph = useCallback(() => {
    if (!chartInstance.current || !graphData) return;

    const isDark = resolvedMode === 'dark';
    const textColor = 'var(--color-text-primary)';
    const bgColor = 'transparent';
    const borderColor = 'var(--color-border)';
    const tooltipBg = isDark ? 'var(--color-surface)' : 'var(--color-surface)';
    const legendColor = 'var(--color-text-secondary)';

    const option = {
      backgroundColor: bgColor,
      tooltip: {
        trigger: 'item',
        backgroundColor: tooltipBg,
        borderColor: borderColor,
        borderWidth: 2,
        textStyle: {
          color: textColor,
          fontSize: 14,
        },
        formatter: (params: {
          dataType?: string;
          data?: {
            category?: string;
            value?: number;
            name?: string;
            source?: string;
            target?: string;
            relationType?: string;
          };
        }) => {
          if (params.dataType === 'node' && params.data) {
            const color = getCategoryColor(params.data.category ?? '');
            const value = params.data.value ?? 0.5;
            return `
              <div style="padding: 12px; min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color}; box-shadow: 0 0 10px ${color}"></div>
                  <strong style="color: var(--color-primary); font-size: 16px;">${params.data.name ?? ''}</strong>
                </div>
                <div style="color: var(--color-text-muted); font-size: 13px; margin-bottom: 4px;">
                  <span style="color: var(--color-text-secondary);">类型:</span> ${getCategoryLabel(params.data.category ?? '')}
                </div>
                <div style="color: var(--color-text-muted); font-size: 13px;">
                  <span style="color: var(--color-text-secondary);">重要性:</span> 
                  <span style="color: var(--color-warning); font-weight: bold;">${(value * 100).toFixed(0)}%</span>
                </div>
              </div>
            `;
          }
          return `
            <div style="padding: 12px; min-width: 200px;">
              <div style="color: var(--color-primary); font-size: 14px; margin-bottom: 8px;">
                ${params.data?.source ?? ''} → ${params.data?.target ?? ''}
              </div>
              <div style="color: var(--color-text-muted); font-size: 13px;">
                <span style="color: var(--color-text-secondary);">关系:</span> 
                <span style="color: var(--color-success); font-weight: bold;">${params.data?.relationType || '关联'}</span>
              </div>
            </div>
          `;
        },
      },
      legend: {
        data: (graphData.categories || []).map((c) => getCategoryLabel(c.name)),
        orient: 'vertical',
        right: 30,
        top: 30,
        textStyle: {
          fontSize: 14,
          color: legendColor,
          fontWeight: '500',
        },
        pageTextStyle: {
          color: legendColor,
        },
        pageIconColor: 'var(--color-primary)',
        pageIconInactiveColor: 'var(--color-text-muted)',
        itemWidth: 20,
        itemHeight: 14,
        itemGap: 12,
      },
      animationDuration: 1500,
      animationEasingUpdate: 'quinticInOut' as const,
      series: [
        {
          type: 'graph',
          layout: layoutType,
          data: graphData.nodes.map((node) => {
            const isSelected = selectedNode === node.id;
            const isHighlighted = highlightedNodes.includes(node.id);
            const color = getCategoryColor(node.category);

            return {
              ...node,
              symbolSize: (value: number) => {
                // 根据节点值动态调整大小，范围 15-45（更紧凑适宜）
                const normalizedValue = Math.max(0, Math.min(1, value || 0.5));
                return 15 + normalizedValue * 30;
              },
              itemStyle: {
                ...node.itemStyle,
                color: color,
                borderColor: isSelected ? 'var(--color-warning)' : 'var(--color-border)',
                borderWidth: isSelected ? 3 : 1.5,
                shadowBlur: isHighlighted ? 25 : 10,
                shadowColor: color,
                shadowOffsetX: 0,
                shadowOffsetY: 0,
              },
              label: {
                show: true,
                position: 'bottom',
                distance: 6,
                formatter: '{b}',
                fontSize: 12,
                color: textColor,
                fontWeight: 500 as const,
                textShadowColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                textShadowBlur: 4,
              },
            };
          }),
          links: graphData.edges.map((edge) => {
            const isHighlighted =
              highlightedNodes.length > 0 &&
              highlightedNodes.includes(edge.source) &&
              highlightedNodes.includes(edge.target);

            return {
              source: edge.source,
              target: edge.target,
              lineStyle: {
                ...edge.lineStyle,
                color: isHighlighted ? 'var(--color-primary)' : 'var(--color-border)',
                opacity: isHighlighted ? 0.9 : highlightedNodes.length > 0 ? 0.2 : 0.5,
                width: isHighlighted ? 4 : highlightedNodes.length > 0 ? 1 : 2,
                curveness: 0.3,
              },
            };
          }),
          categories: (graphData.categories || []).map((c) => ({
            ...c,
            name: getCategoryLabel(c.name),
          })),
          roam: true,
          draggable: true,
          focusNodeAdjacency: true,
          force: {
            repulsion: 1200,
            edgeLength: [80, 150],
            gravity: 0.08,
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
              fontWeight: 'bold' as const,
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
    chartInstance.current.on('click', (params: unknown) => {
      const event = params as {
        dataType?: string;
        data?: { id?: string } | null;
      };
      if (event.dataType === 'node' && event.data && 'id' in event.data) {
        const nodeId = (event.data as { id: string }).id;

        const relatedNodeIds = graphData.edges
          .filter((edge) => edge.source === nodeId || edge.target === nodeId)
          .map((edge) => (edge.source === nodeId ? edge.target : edge.source));

        setHighlightedNodes([nodeId, ...relatedNodeIds]);
        setSelectedNode(nodeId);
      }
    });

    chartInstance.current.off('mouseover');
    chartInstance.current.on('mouseover', (params: unknown) => {
      const event = params as { dataType?: string; data?: unknown };
      if (event.dataType === 'node' && event.data) {
        setHoveredNode(event.data as GraphNode);
      }
    });

    chartInstance.current.off('mouseout');
    chartInstance.current.on('mouseout', () => {
      setHoveredNode(null);
    });
  }, [
    graphData,
    layoutType,
    selectedNode,
    highlightedNodes,
    resolvedMode,
    setHighlightedNodes,
    setSelectedNode,
  ]);

  const renderGraphRef = useRef(renderGraph);
  renderGraphRef.current = renderGraph;

  useEffect(() => {
    loadGraphData();
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (graphData && chartRef.current) {
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current);
      }
      renderGraph();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, layoutType, selectedNode, highlightedNodes]);

  // 监听 graphStore 变化，自动更新图谱
  useEffect(() => {
    if (graphStoreEntities.length > 0) {
      const chatGraphData = graphService.entitiesToGraphData(
        graphStoreEntities,
        graphStoreRelations
      );
      // 转换为 KnowledgeGraph 使用的 GraphData 格式
      const knowledgeGraphData: KnowledgeGraphData = {
        nodes: chatGraphData.nodes.map((node) => ({
          ...node,
          itemStyle: {
            color: node.itemStyle?.color || 'var(--color-primary)',
          },
        })),
        edges: chatGraphData.edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          relationType: edge.relationType,
          value: edge.value,
          lineStyle: edge.lineStyle,
        })),
        categories: chatGraphData.categories?.map((cat) => ({
          name: cat.name,
          itemStyle: {
            color: (cat as unknown as { baseColor?: string }).baseColor || 'var(--color-primary)',
          },
        })),
      };
      setRawGraphData(knowledgeGraphData);
      // 只在来源变化时显示提示，避免重复显示
      if (graphStoreSource === 'chat' || graphStoreSource === 'snapshot') {
        // 使用函数形式，避免依赖 toast 对象
        toast.info(
          '图谱已更新',
          `来自${graphStoreSource === 'chat' ? '智能问答' : '快照'}的 ${chatGraphData.nodes.length} 个节点`
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphStoreEntities, graphStoreRelations, graphStoreSource]);

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
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      renderGraphRef.current();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const loadGraphData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await knowledgeApi.getGraphData();

      if (!data || !data.nodes) {
        throw new Error('无效的图谱数据');
      }

      if (data.nodes.length === 0) {
        toast.info('数据为空', '图谱中没有找到任何节点');
      }

      setRawGraphData(data);
      setRetryCount(0);

      // 转换为 Entity 格式并使用 graphSyncService 同步到所有模块
      const entities = data.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        type: node.category as Entity['type'],
        relevance: node.value || 0.5,
        description: node.description as string | undefined,
        metadata: node.metadata as Entity['metadata'],
      }));

      graphSyncService.updateFromKnowledge(entities, [], []);

      toast.success('知识图谱加载成功', `共 ${data.nodes.length} 个节点`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('加载图谱数据失败:', error);
      setError(errorMessage);

      if (retryCount < 3) {
        toast.warning('加载失败', `正在重试 (${retryCount + 1}/3)`);
        setRetryCount((prev) => prev + 1);
        setTimeout(() => loadGraphData(), 1000 * (retryCount + 1));
      } else {
        toast.error('加载失败', '无法加载知识图谱数据');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleZoomIn = () => {
    if (chartInstance.current) {
      const option = chartInstance.current.getOption();
      const series = option.series as Array<{ zoom?: number }> | undefined;
      const zoom = (series?.[0]?.zoom || 1) * 1.2;
      chartInstance.current.setOption({
        series: [{ zoom }],
      });
    }
  };

  const handleZoomOut = () => {
    if (chartInstance.current) {
      const option = chartInstance.current.getOption();
      const series = option.series as Array<{ zoom?: number }> | undefined;
      const zoom = (series?.[0]?.zoom || 1) / 1.2;
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
      setHighlightedNodes([]);
    }
  };

  if (loading) {
    return <GraphSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div
            className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: 'var(--gradient-error)' }}
          >
            <span className="text-4xl">⚠️</span>
          </div>
          <p className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            加载图谱失败
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            {error}
          </p>
          <motion.button
            onClick={loadGraphData}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="mt-4 px-6 py-2 rounded-xl"
            style={{
              background: 'var(--gradient-primary)',
              color: 'var(--color-text-inverse)',
            }}
          >
            重试
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div
            className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: 'var(--gradient-info)' }}
          >
            <span className="text-4xl">📊</span>
          </div>
          <p className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            暂无图谱数据
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            请先搜索或添加实体数据
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div ref={chartRef} className="w-full h-full" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-6 left-6 backdrop-blur-xl rounded-2xl px-5 py-4"
        style={{
          background: 'var(--gradient-card)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--color-shadow)',
        }}
      >
        <div className="flex items-center gap-6 text-sm">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2"
          >
            <div
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ background: 'var(--color-primary)' }}
            />
            <span style={{ color: 'var(--color-text-secondary)' }}>
              节点:{' '}
              <span className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
                {graphData?.nodes.length}
              </span>
            </span>
          </motion.div>
          <div className="w-px h-5" style={{ background: 'var(--color-border)' }} />
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2"
          >
            <div
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ background: 'var(--color-secondary)' }}
            />
            <span style={{ color: 'var(--color-text-secondary)' }}>
              关系:{' '}
              <span className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>
                {graphData?.edges.length}
              </span>
            </span>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-4 right-4 flex gap-2"
      >
        {[
          { icon: ZoomIn, label: '放大', onClick: handleZoomIn },
          { icon: ZoomOut, label: '缩小', onClick: handleZoomOut },
          { icon: RotateCcw, label: '重置', onClick: handleReset },
        ].map((item) => (
          <motion.button
            key={item.label}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={item.onClick}
            className="w-9 h-9 backdrop-blur-xl rounded-lg flex items-center justify-center transition-all"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
            title={item.label}
          >
            <item.icon size={16} />
          </motion.button>
        ))}
      </motion.div>

      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-6 right-6 backdrop-blur-xl rounded-2xl px-5 py-4 shadow-2xl"
            style={{
              background: 'var(--gradient-card)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  backgroundColor: getCategoryColor(hoveredNode.category),
                  boxShadow: `0 0 15px ${getCategoryColor(hoveredNode.category)}`,
                }}
              />
              <div>
                <div style={{ color: 'var(--color-text-primary)' }} className="font-semibold">
                  {hoveredNode.name}
                </div>
                <div style={{ color: 'var(--color-text-muted)' }} className="text-xs">
                  {getCategoryLabel(hoveredNode.category)}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
