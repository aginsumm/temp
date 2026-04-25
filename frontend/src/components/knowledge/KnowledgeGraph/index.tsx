import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as echarts from 'echarts';
import { knowledgeApi, GraphData as KnowledgeGraphData, GraphNode } from '../../../api/knowledge';
import useKnowledgeGraphStore from '../../../stores/knowledgeGraphStore';
import { useGraphStore } from '../../../stores/graphStore';
import { useThemeStore } from '../../../stores/themeStore';
import { ZoomIn, ZoomOut, RotateCcw, Activity, Minimize2, Smartphone } from 'lucide-react';
import { graphOptimizer } from '../../../utils/graphOptimizer';
import { GraphSkeleton } from '../../common/Skeleton';
import { useToast } from '../../common/Toast';
import { graphService } from '../../../api/graph';
import { graphSyncService } from '../../../services/graphSyncService';
import { getCategoryColor, getCategoryLabel } from '../../../constants/categories';
import type { Entity, EntityType, RelationType } from '../../../types/graph';

export default function KnowledgeGraph() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const [rawGraphData, setRawGraphData] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);

  const { selectedNode, highlightedNodes, layoutType, setSelectedNode, setHighlightedNodes } =
    useKnowledgeGraphStore();

  // 订阅统一的 graphStore
  const graphStoreEntities = useGraphStore((state) => state.entities);
  const graphStoreRelations = useGraphStore((state) => state.relations);
  const graphStoreSource = useGraphStore((state) => state.source);

  const { resolvedMode } = useThemeStore();
  const toast = useToast();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_zoomLevel] = useState(1);
  const [performanceStats, setPerformanceStats] = useState<{
    fps: number;
    nodeCount: number;
    lodLevel: number;
  } | null>(null);

  // 监听 graphStore 变化，自动更新图谱
  // 只处理来自 chat 或 snapshot 的更新，避免与 loadGraphData 的本地加载冲突
  useEffect(() => {
    // 忽略来自 knowledge 源的更新（已经通过 loadGraphData 直接加载）
    if (graphStoreSource === 'knowledge') {
      return;
    }

    console.log('🔵 KnowledgeGraph 监听到 graphStore 变化:', {
      source: graphStoreSource,
      entities: graphStoreEntities.length,
      relations: graphStoreRelations.length,
    });

    if (graphStoreEntities.length > 0) {
      const chatGraphData = graphService.entitiesToGraphData(
        graphStoreEntities,
        graphStoreRelations
      );
      console.log('✅ graphService.entitiesToGraphData 转换完成:', {
        nodes: chatGraphData.nodes.length,
        edges: chatGraphData.edges.length,
      });

      const knowledgeGraphData: KnowledgeGraphData = {
        nodes: chatGraphData.nodes.map(
          (node: {
            id: string;
            name: string;
            category: string;
            itemStyle?: { color?: string };
          }) => ({
            ...node,
            itemStyle: {
              color: node.itemStyle?.color || 'var(--color-primary)',
            },
          })
        ),
        edges: chatGraphData.edges.map(
          (edge: {
            source: string;
            target: string;
            relationType?: string;
            value?: number;
            lineStyle?: unknown;
          }) => ({
            source: edge.source,
            target: edge.target,
            relationType: edge.relationType,
            value: edge.value,
            lineStyle: edge.lineStyle as
              | { width?: number; curveness?: number; opacity?: number }
              | undefined,
          })
        ),
        categories: chatGraphData.categories?.map((cat: { name: string }) => ({
          name: cat.name,
          itemStyle: {
            color: (cat as unknown as { baseColor?: string }).baseColor || 'var(--color-primary)',
          },
        })),
      };

      setRawGraphData(knowledgeGraphData);
      console.log('✅ setRawGraphData 已调用，图谱数据已更新');
    }
  }, [graphStoreEntities, graphStoreRelations, graphStoreSource]);

  // 初始化性能优化器
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    graphOptimizer.updateConfig({
      enableLOD: true,
      enableViewportCulling: true,
      enableProgressiveLoading: true,
      enablePerformanceMonitoring: true,
      autoAdjustLOD: true,
      maxVisibleNodes: window.innerWidth < 768 ? 500 : 1000,
      chunkSize: window.innerWidth < 768 ? 50 : 100,
      cullingMargin: window.innerWidth < 768 ? 100 : 200,
    });

    graphOptimizer.startMonitoring(
      () => rawGraphData?.nodes.length || 0,
      () => rawGraphData?.edges.length || 0
    );

    return () => {
      graphOptimizer.stopMonitoring();
      graphOptimizer.dispose();
      window.removeEventListener('resize', checkMobile);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const graphData = useMemo(() => {
    if (!rawGraphData) return null;

    // 使用新的性能优化器
    const result = graphOptimizer.optimize(rawGraphData);

    // 更新性能统计
    const metrics = graphOptimizer.getPerformanceMetrics();
    if (metrics) {
      setPerformanceStats({
        fps: metrics.fps,
        nodeCount: result.optimizedNodeCount,
        lodLevel: metrics.lodLevel,
      });
    }

    return result.optimizedData;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawGraphData]);

  const renderGraph = useCallback(() => {
    if (!chartInstance.current || !graphData) return;

    const isDark = resolvedMode === 'dark';
    const textColor = 'var(--color-text-primary)';
    const bgColor = 'transparent';
    const borderColor = 'var(--color-border)';
    const tooltipBg = isDark ? 'var(--color-surface)' : 'var(--color-surface)';
    const legendColor = 'var(--color-text-secondary)';

    const nodeCount = graphData.nodes.length;

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
      animation: nodeCount < 200,
      animationDuration: nodeCount < 200 ? 1500 : 0,
      animationEasingUpdate: 'quinticInOut' as const,
      series: [
        {
          type: 'graph',
          layout: layoutType,
          progressive: 400,
          progressiveThreshold: 1000,
          data: graphData.nodes.map((node) => {
            const isSelected = selectedNode === node.id;
            const isHighlighted = highlightedNodes.includes(node.id);
            const color = getCategoryColor(node.category);
            const normalizedValue = Math.max(0, Math.min(1, node.value || 0.5));

            return {
              ...node,
              symbolSize: 15 + normalizedValue * 30,
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
                show: nodeCount < 150,
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
          draggable: nodeCount < 300,
          focusNodeAdjacency: true,
          force: {
            repulsion: 1200,
            edgeLength: [80, 150],
            gravity: 0.08,
            friction: 0.6,
            layoutAnimation: nodeCount < 200,
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

    chartInstance.current.setOption(option, { notMerge: true, lazyUpdate: nodeCount > 100 });

    // 安全地移除和添加事件监听器，避免内存泄漏
    if (chartInstance.current) {
      chartInstance.current.off('click');
      chartInstance.current.on('click', (params: unknown) => {
        const event = params as {
          dataType?: string;
          data?: { id?: string; name?: string; category?: string } | null;
        };
        if (event.dataType === 'node' && event.data && 'id' in event.data) {
          const nodeId = (event.data as { id: string }).id;
          const nodeName = (event.data as { name?: string }).name || '';
          const nodeCategory = (event.data as { category?: string }).category || '';

          const relatedNodeIds = graphData.edges
            .filter((edge) => edge.source === nodeId || edge.target === nodeId)
            .map((edge) => (edge.source === nodeId ? edge.target : edge.source));

          setHighlightedNodes([nodeId, ...relatedNodeIds]);
          setSelectedNode(nodeId);

          // 同步到 Chat 模块
          const entity: Entity = {
            id: nodeId,
            name: nodeName,
            type: nodeCategory as EntityType,
            relevance: 1,
          };
          graphSyncService.updateFromKnowledge([entity], [], []);
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
    }
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
  retryCountRef.current = retryCount;

  useEffect(() => {
    loadGraphData();
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
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

  useEffect(() => {
    if (!chartRef.current) return;

    const observer = new ResizeObserver(() => {
      if (!chartRef.current) return;
      const { clientWidth, clientHeight } = chartRef.current;
      if (clientWidth <= 0 || clientHeight <= 0) return;

      if (!chartInstance.current && graphData) {
        chartInstance.current = echarts.init(chartRef.current);
        renderGraphRef.current();
        return;
      }

      if (chartInstance.current) {
        chartInstance.current.resize();
        // 更新视口信息
        graphOptimizer.updateViewport(clientWidth, clientHeight);
      }
    });

    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, [graphData]);

  // 监听 ECharts 缩放事件，更新 LOD
  useEffect(() => {
    if (!chartInstance.current) return;

    const zoomHandler = (_params: { zoom?: number }) => {
      const zoom = _params.zoom || 1;
      // setZoomLevel(zoom); // zoomLevel 未使用，注释掉
      // 更新优化器的视口缩放级别
      graphOptimizer.updateViewport(
        chartRef.current?.clientWidth || 800,
        chartRef.current?.clientHeight || 600,
        zoom
      );
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chartInstance.current.on('globalout', zoomHandler as any);

    return () => {
      chartInstance.current?.off('globalout', zoomHandler);
    };
  }, []);

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

      const relations = (data.edges || []).map((edge, index) => ({
        id: `knowledge_edge_${index}`,
        source: edge.source,
        target: edge.target,
        type: (edge.relationType || 'related_to') as RelationType,
        confidence: Number(edge.value ?? edge.weight ?? 0.5),
      }));

      // 同步到 graphStore，但标记来源为 knowledge
      // 由于 useEffect 中忽略了 knowledge 源，不会导致循环更新
      graphSyncService.updateFromKnowledge(entities, relations, []);

      toast.success('知识图谱加载成功', `共 ${data.nodes.length} 个节点`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('加载图谱数据失败:', error);
      setError(errorMessage);

      if (retryCountRef.current < 3) {
        const nextRetry = retryCountRef.current + 1;
        toast.warning('加载失败', `正在重试 (${nextRetry}/3)`);
        setRetryCount((prev) => prev + 1);
        retryTimeoutRef.current = setTimeout(() => loadGraphData(), 1000 * nextRetry);
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
            style={{ background: 'var(--gradient-primary)', opacity: 0.2 }}
          >
            <span className="text-4xl">🔍</span>
          </div>
          <p className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            图谱数据为空
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            暂无可显示的图谱节点
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={chartRef} className="w-full h-full" />

      {isMobile && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowMobileControls(!showMobileControls)}
          className="absolute bottom-4 right-4 z-20 w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
          style={{ background: 'var(--gradient-primary)' }}
        >
          {showMobileControls ? (
            <Minimize2 size={20} color="#fff" />
          ) : (
            <Smartphone size={20} color="#fff" />
          )}
        </motion.button>
      )}

      <AnimatePresence>
        {showMobileControls && isMobile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-20 right-4 z-20 flex flex-col gap-2"
          >
            <motion.button
              onClick={handleZoomIn}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 rounded-full shadow-lg flex items-center justify-center"
              style={{ background: 'var(--color-surface)' }}
            >
              <ZoomIn size={18} style={{ color: 'var(--color-text-secondary)' }} />
            </motion.button>

            <motion.button
              onClick={handleZoomOut}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 rounded-full shadow-lg flex items-center justify-center"
              style={{ background: 'var(--color-surface)' }}
            >
              <ZoomOut size={18} style={{ color: 'var(--color-text-secondary)' }} />
            </motion.button>

            <motion.button
              onClick={handleReset}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 rounded-full shadow-lg flex items-center justify-center"
              style={{ background: 'var(--color-surface)' }}
            >
              <RotateCcw size={18} style={{ color: 'var(--color-text-secondary)' }} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {!isMobile && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <motion.button
            onClick={handleZoomIn}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-lg shadow-lg flex items-center justify-center transition-colors"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
            }}
            title="放大"
          >
            <ZoomIn size={18} />
          </motion.button>

          <motion.button
            onClick={handleZoomOut}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-lg shadow-lg flex items-center justify-center transition-colors"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
            }}
            title="缩小"
          >
            <ZoomOut size={18} />
          </motion.button>

          <motion.button
            onClick={handleReset}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-lg shadow-lg flex items-center justify-center transition-colors"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
            }}
            title="重置"
          >
            <RotateCcw size={18} />
          </motion.button>

          {performanceStats && (
            <div
              className="px-3 py-2 rounded-lg shadow-lg text-xs"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <div className="flex items-center gap-1">
                <Activity size={12} />
                <span>{performanceStats.fps} FPS</span>
              </div>
              <div className="mt-1">{performanceStats.nodeCount} 节点</div>
            </div>
          )}
        </div>
      )}

      {hoveredNode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 left-4 z-10 max-w-xs backdrop-blur-xl rounded-xl p-4 shadow-lg"
          style={{
            background: 'var(--gradient-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: getCategoryColor(hoveredNode.category) }}
            />
            <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {hoveredNode.name}
            </h3>
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {getCategoryLabel(hoveredNode.category)}
          </p>
        </motion.div>
      )}
    </div>
  );
}
