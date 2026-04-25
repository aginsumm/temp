/**
 * 统一 WebGL 知识图谱渲染器
 * 整合三个 WebGL 组件的优势功能：
 * - WebGLKnowledgeGraph: 基础渲染、ECharts 集成
 * - WebGLKnowledgeGraphEnhanced: 3D 效果、增强交互
 * - WebGLKnowledgeGraphOptimized: 性能优化、质量调节
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as echarts from 'echarts';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Sparkles,
  Download,
  RefreshCw,
  X,
  Settings,
} from 'lucide-react';
import { knowledgeApi, GraphData, GraphNode } from '../../../api/knowledge';
import useKnowledgeGraphStore from '../../../stores/knowledgeGraphStore';
import { graphOptimizer } from '../../../utils/graphOptimizer';
import { GraphSkeleton } from '../../common/Skeleton';
import { useToast } from '../../common/Toast';
import { useThemeStore } from '../../../stores/themeStore';

interface TooltipParams {
  dataType?: 'node' | 'edge';
  data: GraphNode & { source?: string; target?: string };
}

interface RenderSettings {
  nodeSize: number;
  edgeWidth: number;
  showLabels: boolean;
  showEdges: boolean;
  ambientLight: number;
  pointLight: number;
  fogDensity: number;
  animationSpeed: number;
  quality: 'low' | 'medium' | 'high';
  enable3D: boolean;
  enableVirtualization: boolean;
  maxVisibleNodes: number;
}

interface PerformanceMetrics {
  fps: number;
  nodeCount: number;
  edgeCount: number;
  renderTime: number;
}

interface WebGLRendererProps {
  data?: GraphData;
  onNodeClick?: (nodeId: string) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  onEdgeClick?: (source: string, target: string) => void;
}

const CATEGORY_COLOR_VARS: Record<string, string> = {
  inheritor: '--color-primary',
  technique: '--color-secondary',
  work: '--color-accent',
  pattern: '--color-error',
  region: '--color-info',
  period: '--color-indigo',
  material: '--color-success',
};

const CATEGORY_LABELS: Record<string, string> = {
  inheritor: '传承人',
  technique: '技艺',
  work: '作品',
  pattern: '纹样',
  region: '地区',
  period: '时期',
  material: '材料',
};

const DEFAULT_SETTINGS: RenderSettings = {
  nodeSize: 15,
  edgeWidth: 1.5,
  showLabels: true,
  showEdges: true,
  ambientLight: 0.6,
  pointLight: 0.8,
  fogDensity: 0.02,
  animationSpeed: 1.0,
  quality: 'high',
  enable3D: true,
  enableVirtualization: true,
  maxVisibleNodes: 500,
};

function getCSSVariable(varName: string): string {
  if (typeof window !== 'undefined') {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#8B5CF6';
  }
  return '#8B5CF6';
}

function getCategoryColor(category?: string): string {
  if (!category) return getCSSVariable('--color-primary');
  const varName = CATEGORY_COLOR_VARS[category] || '--color-primary';
  return getCSSVariable(varName);
}

export default function WebGLRenderer({
  onNodeClick,
  onNodeHover,
  onEdgeClick,
}: WebGLRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { setSelectedNode, category, keyword } = useKnowledgeGraphStore();
  const { resolvedMode } = useThemeStore();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [settings, setSettings] = useState<RenderSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    nodeCount: 0,
    edgeCount: 0,
    renderTime: 0,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await knowledgeApi.search({
        category: category === 'all' ? undefined : category,
        keyword: keyword || undefined,
      });

      // 提取所有唯一的实体类型作为分类
      const uniqueTypes = Array.from(new Set(response.results.map((e) => e.type)));
      const categories = uniqueTypes.map((type) => ({ name: type }));

      const graphDataFromEntities: GraphData = {
        nodes: response.results.map((entity) => ({
          id: entity.id,
          name: entity.name,
          category: entity.type,
          symbolSize: 20 + (entity.importance || 0.5) * 30,
          value: entity.importance || 0.5,
          itemStyle: {
            color: getCategoryColor(entity.type),
          },
        })),
        edges: [],
        categories,
      };

      // 使用 graphOptimizer 进行优化
      const optimizationResult = graphOptimizer.optimize(graphDataFromEntities);
      const optimizedData = optimizationResult.optimizedData;

      setGraphData(optimizedData);
      setPerformanceMetrics((prev) => ({
        ...prev,
        nodeCount: optimizedData.nodes.length,
        edgeCount: optimizedData.edges.length,
      }));
    } catch (error) {
      console.error('加载图谱数据失败:', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [category, keyword, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!containerRef.current || loading) return;

    const chart = echarts.init(containerRef.current, undefined, {
      renderer: 'canvas',
      devicePixelRatio: window.devicePixelRatio,
    });

    chartRef.current = chart;

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart) {
        chart.dispose();
      }
      chartRef.current = null;
    };
  }, [loading]);

  useEffect(() => {
    if (!chartRef.current || !graphData) return;

    const startTime = performance.now();
    const chart = chartRef.current;

    const textColor = getCSSVariable('--color-text-primary');
    const borderColor = getCSSVariable('--color-border');
    const primaryColor = getCSSVariable('--color-primary');

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        backgroundColor: getCSSVariable('--color-surface'),
        borderColor: borderColor,
        textStyle: { color: textColor },
        formatter: (params: unknown) => {
          const p = params as TooltipParams;
          if (p.dataType === 'node') {
            const categoryLabel = CATEGORY_LABELS[p.data.category] || p.data.category;
            return `
              <div style="padding: 8px;">
                <div style="font-weight: bold; margin-bottom: 4px;">${p.data.name}</div>
                <div style="font-size: 12px; color: ${getCSSVariable('--color-text-muted')};">类型：${categoryLabel}</div>
                <div style="font-size: 12px; color: ${getCSSVariable('--color-text-muted')};">关联：${p.data.value?.toFixed(2)}</div>
              </div>
            `;
          } else if (p.dataType === 'edge') {
            return `${p.data.source} → ${p.data.target}${p.data.relationType ? ` (${p.data.relationType})` : ''}`;
          }
          return '';
        },
      },
      legend: [
        {
          data: (graphData.categories || []).map((c) => CATEGORY_LABELS[c.name] || c.name),
          textStyle: { color: textColor },
          left: 'center',
          top: 10,
        },
      ],
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: graphData.nodes.map((node) => {
            const categoryIndex = (graphData.categories || []).findIndex(
              (c) => c.name === node.category
            );
            return {
              id: node.id,
              name: node.name,
              category: categoryIndex >= 0 ? categoryIndex : undefined,
              symbolSize: settings.enableVirtualization
                ? Math.min(node.symbolSize || (node.value || 0.5) * 2, 50)
                : (node.value || 0.5) * 2,
              x: node.x,
              y: node.y,
              itemStyle: {
                color: getCategoryColor(node.category),
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.3)',
              },
              label: {
                show: settings.showLabels,
                position: 'right',
                formatter: '{b}',
                color: textColor,
                fontSize: 12,
              },
            };
          }),
          links: graphData.edges.map((edge) => ({
            source: edge.source,
            target: edge.target,
            relationType: edge.relationType,
            lineStyle: {
              color: borderColor,
              width: settings.edgeWidth,
              curveness: 0.3,
            },
          })),
          categories: (graphData.categories || []).map((cat) => ({
            name: CATEGORY_LABELS[cat.name] || cat.name,
            itemStyle: {
              color: getCategoryColor(cat.name),
            },
          })),
          roam: true,
          draggable: true,
          focusNodeAdjacency: true,
          force: {
            repulsion: settings.enableVirtualization ? 200 : 500,
            gravity: 0.1,
            edgeLength: 150,
          },
          emphasis: {
            focus: 'adjacency',
            lineStyle: {
              width: 3,
              color: primaryColor,
            },
          },
        },
      ],
    };

    chart.setOption(option, true);

    // 安全地添加事件监听器，避免内存泄漏
    chart.off('click');
    chart.on('click', (params: unknown) => {
      const p = params as {
        dataType?: 'node' | 'edge';
        data: { id?: string; source?: string; target?: string };
      };
      if (p.dataType === 'node' && onNodeClick) {
        onNodeClick(p.data.id as string);
        setSelectedNode(p.data.id as string);
      } else if (p.dataType === 'edge' && onEdgeClick) {
        onEdgeClick(p.data.source as string, p.data.target as string);
      }
    });

    chart.off('mouseover');
    chart.on('mouseover', (params: unknown) => {
      const p = params as { dataType?: 'node'; data: GraphNode };
      if (p.dataType === 'node' && onNodeHover) {
        onNodeHover(p.data);
      }
    });

    const endTime = performance.now();
    setPerformanceMetrics((prev) => ({
      ...prev,
      renderTime: endTime - startTime,
    }));
  }, [graphData, settings, onNodeClick, onNodeHover, onEdgeClick, setSelectedNode, resolvedMode]);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime - lastTime >= 1000) {
        setPerformanceMetrics((prev) => ({
          ...prev,
          fps: frameCount,
        }));
        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrameRef.current = requestAnimationFrame(measureFPS);
    };

    measureFPS();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleZoomIn = () => {
    if (chartRef.current) {
      chartRef.current.dispatchAction({
        type: 'graphRoam',
        dx: 0,
        dy: 0,
        zoom: 0.2,
      });
    }
  };

  const handleZoomOut = () => {
    if (chartRef.current) {
      chartRef.current.dispatchAction({
        type: 'graphRoam',
        dx: 0,
        dy: 0,
        zoom: -0.2,
      });
    }
  };

  const handleReset = () => {
    if (chartRef.current) {
      chartRef.current.dispatchAction({
        type: 'graphRoam',
        dx: 0,
        dy: 0,
        zoom: 0,
      });
    }
    setSettings(DEFAULT_SETTINGS);
  };

  const handleFullscreen = () => {
    setFullscreen(!fullscreen);
    if (!fullscreen && containerRef.current) {
      containerRef.current.requestFullscreen();
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  const handleExport = () => {
    if (chartRef.current) {
      const url = chartRef.current.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: getCSSVariable('--color-surface'),
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = 'knowledge-graph.png';
      a.click();
      showToast('导出成功', 'success');
    }
  };

  const handleRefresh = () => {
    loadData();
    showToast('刷新中...', 'info');
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error') => {
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'info') {
      toast.info(message);
    } else {
      toast.error(message);
    }
  };

  if (loading) {
    return <GraphSkeleton />;
  }

  return (
    <div className={`relative w-full h-full ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
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

        <motion.button
          onClick={handleFullscreen}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 rounded-lg shadow-lg flex items-center justify-center transition-colors"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
          }}
          title={fullscreen ? '退出全屏' : '全屏'}
        >
          {fullscreen ? <X size={18} /> : <Maximize2 size={18} />}
        </motion.button>

        <motion.button
          onClick={handleExport}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 rounded-lg shadow-lg flex items-center justify-center transition-colors"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
          }}
          title="导出图片"
        >
          <Download size={18} />
        </motion.button>

        <motion.button
          onClick={handleRefresh}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 rounded-lg shadow-lg flex items-center justify-center transition-colors"
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
          }}
          title="刷新"
        >
          <RefreshCw size={18} />
        </motion.button>

        <motion.button
          onClick={() => setShowSettings(!showSettings)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 rounded-lg shadow-lg flex items-center justify-center transition-colors"
          style={{
            background: showSettings ? 'var(--color-primary)' : 'var(--color-surface)',
            color: showSettings ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
          }}
          title="设置"
        >
          <Settings size={18} />
        </motion.button>
      </div>

      <div
        className="absolute top-4 left-4 z-10 p-3 rounded-lg backdrop-blur-sm shadow-lg text-xs"
        style={{
          background: 'var(--gradient-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
          <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            性能监控
          </span>
        </div>
        <div
          className="grid grid-cols-2 gap-x-4 gap-y-1"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <span>FPS:</span>
          <span className="font-mono">{performanceMetrics.fps}</span>
          <span>节点:</span>
          <span className="font-mono">{performanceMetrics.nodeCount}</span>
          <span>边:</span>
          <span className="font-mono">{performanceMetrics.edgeCount}</span>
          <span>渲染:</span>
          <span className="font-mono">{performanceMetrics.renderTime.toFixed(1)}ms</span>
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-20 right-4 w-72 p-4 rounded-xl shadow-xl z-10"
            style={{
              background: 'var(--gradient-card)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                渲染设置
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  显示标签
                </span>
                <input
                  type="checkbox"
                  checked={settings.showLabels}
                  onChange={(e) => setSettings({ ...settings, showLabels: e.target.checked })}
                  className="toggle"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  显示边
                </span>
                <input
                  type="checkbox"
                  checked={settings.showEdges}
                  onChange={(e) => setSettings({ ...settings, showEdges: e.target.checked })}
                  className="toggle"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  3D 效果
                </span>
                <input
                  type="checkbox"
                  checked={settings.enable3D}
                  onChange={(e) => setSettings({ ...settings, enable3D: e.target.checked })}
                  className="toggle"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  虚拟化
                </span>
                <input
                  type="checkbox"
                  checked={settings.enableVirtualization}
                  onChange={(e) =>
                    setSettings({ ...settings, enableVirtualization: e.target.checked })
                  }
                  className="toggle"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    节点大小
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {settings.nodeSize}
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={settings.nodeSize}
                  onChange={(e) => setSettings({ ...settings, nodeSize: Number(e.target.value) })}
                  className="w-full"
                  style={{ accentColor: 'var(--color-primary)' }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    边宽度
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {settings.edgeWidth}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={settings.edgeWidth}
                  onChange={(e) => setSettings({ ...settings, edgeWidth: Number(e.target.value) })}
                  className="w-full"
                  style={{ accentColor: 'var(--color-primary)' }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    质量
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {settings.quality}
                  </span>
                </div>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setSettings({ ...settings, quality: q })}
                      className="flex-1 py-1 rounded text-xs transition-colors"
                      style={{
                        background:
                          settings.quality === q ? 'var(--color-primary)' : 'var(--color-surface)',
                        color:
                          settings.quality === q
                            ? 'var(--color-text-inverse)'
                            : 'var(--color-text-secondary)',
                      }}
                    >
                      {q === 'low' ? '低' : q === 'medium' ? '中' : '高'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
