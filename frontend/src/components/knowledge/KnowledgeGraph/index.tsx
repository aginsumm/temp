import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as echarts from 'echarts';
import { knowledgeApi, GraphData as KnowledgeGraphData } from '../../../api/knowledge';
import useKnowledgeGraphStore from '../../../stores/knowledgeGraphStore';
import { useGraphStore } from '../../../stores/graphStore';
import { useThemeStore } from '../../../stores/themeStore';
import { Activity, Minimize2 } from 'lucide-react';
import { GraphSkeleton } from '../../common/Skeleton';
import { useToast } from '../../common/Toast';
import { graphSyncService } from '../../../services/graphSyncService';
import { getCategoryColor, getCategoryLabel } from '../../../constants/categories';
import type { Entity, Relation, RelationType } from '../../../types/graph';

export default function KnowledgeGraph() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rawGraphData, setRawGraphData] = useState<KnowledgeGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setRetryCount] = useState(0);
  const [isMobile] = useState(false);

  const {
    selectedNode,
    highlightedNodes,
    layoutType,
    setSelectedNode,
    setHighlightedNodes,
    filters,
  } = useKnowledgeGraphStore();

  const graphStoreEntities = useGraphStore((state) => state.entities);
  const graphStoreRelations = useGraphStore((state) => state.relations);

  const { resolvedMode } = useThemeStore();
  const toast = useToast();
  const [performanceStats, setPerformanceStats] = useState<{
    fps: number;
    nodeCount: number;
    lodLevel: number;
  } | null>(null);

  useEffect(() => {
    if (graphStoreEntities.length > 0) {
      const knowledgeGraphData: KnowledgeGraphData = {
        nodes: graphStoreEntities.map((e) => {
          const entity = e as unknown as Entity & Record<string, unknown>;
          const rawValue =
            ((entity.relevance || entity.importance || entity.value) as number) || 0.5;
          const normalizedValue = rawValue > 1 ? Math.min(1, rawValue / 5) : Math.max(0, rawValue);
          return {
            id: String(entity.id || Math.random()),
            name: entity.name || '未知',
            category: (entity.type || entity.category || 'unknown') as string,
            description: ((entity.description || entity.metadata?.description) as string) || '',
            region: ((entity.region || entity.metadata?.region) as string) || '',
            period: ((entity.period || entity.metadata?.period) as string) || '',
            value: normalizedValue,
            itemStyle: {
              color: getCategoryColor((entity.type || entity.category || 'unknown') as string),
            },
          };
        }),
        edges: graphStoreRelations.map((r) => {
          const relation = r as unknown as Relation & Record<string, unknown>;
          return {
            source: String(relation.source),
            target: String(relation.target),
            relationType: (relation.type || relation.relationType || '关联') as string,
            value: ((relation.confidence || relation.weight) as number) || 0.5,
          };
        }),
        categories: Array.from(
          new Set(
            graphStoreEntities.map(
              (e) =>
                (e as unknown as Entity & Record<string, unknown>).type ||
                (e as unknown as Entity & Record<string, unknown>).category ||
                'unknown'
            )
          )
        ).map((c: string) => ({
          name: String(c),
          itemStyle: { color: getCategoryColor(String(c)) },
        })),
      };

      setRawGraphData(knowledgeGraphData);
      setLoading(false);
    }
  }, [graphStoreEntities, graphStoreRelations]);

  const graphData = useMemo(() => {
    if (!rawGraphData) return null;
    return rawGraphData;
  }, [rawGraphData]);

  const selectedNodeData = useMemo(() => {
    if (!selectedNode || !graphData) return null;
    return graphData.nodes.find((n) => String(n.id) === String(selectedNode));
  }, [selectedNode, graphData]);

  useEffect(() => {
    if (graphData) {
      setPerformanceStats({
        fps: 60,
        nodeCount: graphData.nodes.length,
        lodLevel: 1,
      });
    }
  }, [graphData]);

  useEffect(() => {
    if (graphStoreEntities.length === 0) {
      loadGraphData();
    } else {
      setLoading(false);
    }
    return () => {
      const timeout = retryTimeoutRef.current;
      if (timeout) clearTimeout(timeout);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  const loadGraphData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await knowledgeApi.getGraphData();
      if (!data || !data.nodes) throw new Error('无效的图谱数据');

      setRawGraphData(data);
      setRetryCount(0);

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

      graphSyncService.updateFromKnowledge(entities, relations, []);
      toast.success('知识图谱加载成功', `共 ${data.nodes.length} 个节点`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderGraph = useCallback(() => {
    if (!chartInstance.current || !graphData) return;

    const getExactHexColor = (categoryName: string | undefined) => {
      const cat = String(categoryName || 'unknown').toLowerCase();
      if (cat.includes('inheritor') || cat.includes('传承人')) return '#a855f7';
      if (cat.includes('material') || cat.includes('材料')) return '#22c55e';
      if (
        cat.includes('region') ||
        cat.includes('location') ||
        cat.includes('地域') ||
        cat.includes('地点')
      )
        return '#06b6d4';
      if (cat.includes('period') || cat.includes('时期') || cat.includes('年代')) return '#3b82f6';
      if (cat.includes('technique') || cat.includes('skill') || cat.includes('技艺'))
        return '#f59e0b';
      if (cat.includes('work') || cat.includes('作品')) return '#ef4444';
      if (cat.includes('pattern') || cat.includes('图案')) return '#ec4899';
      if (cat.includes('organization') || cat.includes('机构')) return '#6366f1';

      const orig = getCategoryColor(cat);
      return orig && !orig.includes('var') ? orig : '#8b5cf6';
    };

    const hasActiveFilters = () => {
      const filtersAny = filters as Record<string, unknown>;
      return (
        filters.searchQuery !== '' ||
        (filters.categories && filters.categories.length > 0) ||
        ((filtersAny.regions as string[])?.length ?? 0) > 0 ||
        ((filtersAny.periods as string[])?.length ?? 0) > 0 ||
        (filters.minImportance || 0) > 0
      );
    };

    const isNodeMatch = (n: Record<string, unknown>) => {
      const query = filters.searchQuery?.toLowerCase() || '';
      const matchesSearch =
        query === '' ||
        (n.name as string)?.toLowerCase().includes(query) ||
        ((n.description as string) && (n.description as string).toLowerCase().includes(query));

      const matchesCategory =
        !filters.categories ||
        filters.categories.length === 0 ||
        filters.categories.includes(n.category as string);

      const filterRegions = ((filters as Record<string, unknown>).regions as string[]) || [];
      const matchesRegion =
        filterRegions.length === 0 || filterRegions.includes(n.region as string);

      const filterPeriods = ((filters as Record<string, unknown>).periods as string[]) || [];
      const matchesPeriod =
        filterPeriods.length === 0 || filterPeriods.includes(n.period as string);

      const matchesImportance = ((n.value as number) || 0) >= (filters.minImportance || 0);

      return (
        matchesSearch && matchesCategory && matchesRegion && matchesPeriod && matchesImportance
      );
    };

    const isFilterActive = hasActiveFilters();
    // 根据系统暗亮色模式给彩色文字加一点描边，防止看不清
    const textBorderColor = resolvedMode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';

    const validNodes = graphData.nodes.map((n) => {
      const finalColor = getExactHexColor(n.category);
      const match = !isFilterActive || isNodeMatch(n);

      const opacity = isFilterActive ? (match ? 1 : 0.15) : 1;
      const labelOpacity = isFilterActive ? (match ? 1 : 0) : 1;
      const shadowBlur = isFilterActive ? (match ? 15 : 0) : 10;

      return {
        ...n,
        id: String(n.id),
        name: n.name || '未命名',
        symbolSize: 25 + (n.value || 0.5) * 30,
        itemStyle: {
          ...n.itemStyle,
          color: finalColor,
          opacity: opacity,
          borderColor: `rgba(255,255,255,${match ? 0.8 : 0})`,
          borderWidth: 1.5,
          shadowBlur: shadowBlur,
          shadowColor: finalColor,
        },
        label: {
          show: true,
          // 【完美修复】：文字颜色直接等于节点本身的 finalColor，永远不会乱变！
          color: finalColor,
          opacity: labelOpacity,
          position: 'right',
          formatter: '{b}',
          fontSize: 12,
          fontWeight: 'bold', // 彩色文字加粗，增强可读性
          textBorderColor: textBorderColor, // 轻微描边，防止文字融入背景
          textBorderWidth: 1,
        },
      };
    });

    const validEdges = graphData.edges
      .filter(
        (e) =>
          validNodes.some((n) => n.id === String(e.source)) &&
          validNodes.some((n) => n.id === String(e.target))
      )
      .map((e) => {
        const edgeOpacity = isFilterActive ? 0.15 : 0.5;
        return {
          ...e,
          source: String(e.source),
          target: String(e.target),
          lineStyle: {
            color: '#9ca3af',
            width: 1.5,
            curveness: 0.2,
            opacity: edgeOpacity,
          },
        };
      });

    const option = {
      backgroundColor: 'transparent',
      tooltip: { show: true },
      animation: true,
      animationDurationUpdate: 500,
      series: [
        {
          type: 'graph',
          layout: layoutType || 'force',
          progressive: 0,
          coordinateSystem: 'view',
          data: validNodes,
          links: validEdges,
          categories: (graphData.categories || []).map((c) => ({
            name: getCategoryLabel(c.name),
            itemStyle: { color: getExactHexColor(c.name) },
          })),
          roam: true,
          draggable: true,
          force: {
            repulsion: 2500,
            gravity: 0.1,
            edgeLength: [150, 300],
            layoutAnimation: true,
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              color: '#000000',
              width: 4,
              opacity: 1,
            },
          },
          blur: {
            itemStyle: { opacity: 0.15 },
            lineStyle: { opacity: 0.1 },
          },
        },
      ],
    };

    chartInstance.current.setOption(option, false);

    if (chartInstance.current) {
      chartInstance.current.off('click');
      chartInstance.current.on('click', (params: Record<string, unknown>) => {
        if (params.dataType === 'node' && (params.data as Record<string, unknown>)?.id) {
          setSelectedNode(String((params.data as Record<string, unknown>).id));
        } else {
          setSelectedNode(null);
          setHighlightedNodes([]);
        }
      });
    }
  }, [graphData, layoutType, resolvedMode, filters, setSelectedNode, setHighlightedNodes]);

  useEffect(() => {
    if (graphData && chartRef.current) {
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current);
      }
      renderGraph();
    }
  }, [graphData, layoutType, selectedNode, highlightedNodes, filters, renderGraph]);

  useEffect(() => {
    if (!chartRef.current) return;
    const observer = new ResizeObserver(() => {
      if (chartInstance.current) chartInstance.current.resize();
    });
    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, [graphData]);

  if (loading) return <GraphSkeleton />;
  if (error) return <div>加载失败: {error}</div>;

  return (
    <div className="relative w-full h-full">
      <div ref={chartRef} className="w-full h-full" style={{ minHeight: '400px' }} />

      {performanceStats && !isMobile && (
        <div
          className="absolute top-4 right-4 z-10 px-3 py-2 rounded-lg shadow-lg text-xs"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-1">
            <Activity size={12} style={{ color: 'var(--color-primary)' }} />
            <span>{performanceStats.fps} FPS</span>
          </div>
          <div className="mt-1 opacity-70">{performanceStats.nodeCount} 节点</div>
        </div>
      )}

      {/* 底部详情卡片 */}
      <AnimatePresence>
        {selectedNodeData && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-lg overflow-hidden backdrop-blur-xl rounded-2xl shadow-2xl border"
            style={{
              background: 'var(--gradient-card)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: getCategoryColor(selectedNodeData.category),
                      boxShadow: `0 0 10px ${getCategoryColor(selectedNodeData.category)}`,
                    }}
                  />
                  <h3 className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>
                    {selectedNodeData.name}
                  </h3>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full border"
                    style={{
                      color: 'var(--color-text-secondary)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    {getCategoryLabel(selectedNodeData.category)}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <Minimize2 size={18} />
                </button>
              </div>

              <p
                className="text-sm leading-relaxed overflow-y-auto max-h-32 pr-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {(selectedNodeData.description as string) || '暂无详细描述...'}
              </p>
            </div>

            <div
              className="h-1 w-full"
              style={{ background: getCategoryColor(selectedNodeData.category) }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
