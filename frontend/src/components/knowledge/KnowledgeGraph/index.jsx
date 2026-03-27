import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as echarts from 'echarts';
import { knowledgeApi } from '../../../api/knowledge';
import useKnowledgeGraphStore from '../../../stores/knowledgeGraphStore';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Sparkles } from 'lucide-react';

export default function KnowledgeGraph() {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState(null);

  const { selectedNode, highlightedNodes, layoutType, setSelectedNode, setHighlightedNodes } =
    useKnowledgeGraphStore();

  const categoryColors = {
    inheritor: '#8B5CF6',
    technique: '#10B981',
    work: '#F59E0B',
    pattern: '#EF4444',
    region: '#06B6D4',
    period: '#6366F1',
    material: '#84CC16',
  };

  const categoryGradients = {
    inheritor: ['#8B5CF6', '#A78BFA'],
    technique: ['#10B981', '#34D399'],
    work: ['#F59E0B', '#FBBF24'],
    pattern: ['#EF4444', '#F87171'],
    region: ['#06B6D4', '#22D3EE'],
    period: ['#6366F1', '#818CF8'],
    material: ['#84CC16', '#A3E635'],
  };

  const renderGraph = useCallback(() => {
    if (!chartInstance.current || !graphData) return;

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 2,
        textStyle: {
          color: '#e2e8f0',
          fontSize: 14,
        },
        formatter: (params) => {
          if (params.dataType === 'node') {
            const color = categoryColors[params.data.category] || '#3B82F6';
            return `
              <div style="padding: 12px; min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color}; box-shadow: 0 0 10px ${color}"></div>
                  <strong style="color: #60a5fa; font-size: 16px;">${params.data.name}</strong>
                </div>
                <div style="color: #94a3b8; font-size: 13px; margin-bottom: 4px;">
                  <span style="color: #cbd5e1;">类型:</span> ${params.data.category}
                </div>
                <div style="color: #94a3b8; font-size: 13px;">
                  <span style="color: #cbd5e1;">重要性:</span> 
                  <span style="color: #fbbf24; font-weight: bold;">${(params.data.value * 100).toFixed(0)}%</span>
                </div>
              </div>
            `;
          }
          return `
            <div style="padding: 12px; min-width: 200px;">
              <div style="color: #60a5fa; font-size: 14px; margin-bottom: 8px;">
                ${params.data.source} → ${params.data.target}
              </div>
              <div style="color: #94a3b8; font-size: 13px;">
                <span style="color: #cbd5e1;">关系:</span> 
                <span style="color: #34d399; font-weight: bold;">${params.data.relationType}</span>
              </div>
            </div>
          `;
        },
      },
      legend: {
        data: graphData.categories.map((c) => c.name),
        orient: 'vertical',
        right: 30,
        top: 30,
        textStyle: {
          fontSize: 14,
          color: '#cbd5e1',
          fontWeight: '500',
        },
        pageTextStyle: {
          color: '#cbd5e1',
        },
        pageIconColor: '#60a5fa',
        pageIconInactiveColor: '#475569',
        itemWidth: 20,
        itemHeight: 14,
        itemGap: 12,
      },
      animationDuration: 1500,
      animationEasingUpdate: 'quinticInOut',
      series: [
        {
          type: 'graph',
          layout: layoutType,
          data: graphData.nodes.map((node) => {
            const isSelected = selectedNode === node.id;
            const isHighlighted = highlightedNodes.includes(node.id);
            const color = categoryColors[node.category] || '#3B82F6';

            return {
              ...node,
              symbolSize: node.symbolSize,
              itemStyle: {
                ...node.itemStyle,
                color: {
                  type: 'radial',
                  x: 0.5,
                  y: 0.5,
                  r: 0.5,
                  colorStops: [
                    { offset: 0, color: color },
                    { offset: 1, color: categoryGradients[node.category]?.[1] || color },
                  ],
                },
                borderColor: isSelected ? '#fbbf24' : '#ffffff',
                borderWidth: isSelected ? 4 : 2,
                shadowBlur: isHighlighted ? 30 : 15,
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
                color: '#e2e8f0',
                fontWeight: '500',
                textShadowColor: 'rgba(0, 0, 0, 0.8)',
                textShadowBlur: 6,
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
                color: isHighlighted ? '#60a5fa' : '#475569',
                opacity: isHighlighted ? 0.9 : highlightedNodes.length > 0 ? 0.2 : 0.5,
                width: isHighlighted ? 4 : highlightedNodes.length > 0 ? 1 : 2,
                curveness: 0.3,
              },
            };
          }),
          categories: graphData.categories,
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
              color: '#60a5fa',
            },
            itemStyle: {
              shadowBlur: 40,
              shadowColor: 'rgba(59, 130, 246, 0.8)',
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
            color: '#475569',
            curveness: 0.3,
            opacity: 0.5,
          },
        },
      ],
    };

    chartInstance.current.setOption(option, true);

    chartInstance.current.off('click');
    chartInstance.current.on('click', (params) => {
      if (params.dataType === 'node') {
        const nodeId = params.data.id;
        setSelectedNode(nodeId);

        const relatedNodeIds = graphData.edges
          .filter((edge) => edge.source === nodeId || edge.target === nodeId)
          .map((edge) => (edge.source === nodeId ? edge.target : edge.source));

        setHighlightedNodes([nodeId, ...relatedNodeIds]);
      }
    });

    chartInstance.current.off('mouseover');
    chartInstance.current.on('mouseover', (params) => {
      if (params.dataType === 'node') {
        setHoveredNode(params.data);
      }
    });

    chartInstance.current.off('mouseout');
    chartInstance.current.on('mouseout', () => {
      setHoveredNode(null);
    });
  }, [graphData, layoutType, selectedNode, highlightedNodes, setSelectedNode, setHighlightedNodes]);

  useEffect(() => {
    loadGraphData();
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (graphData && chartRef.current) {
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current, 'dark');
      }
      renderGraph();
    }
  }, [graphData, layoutType, selectedNode, highlightedNodes, renderGraph]);

  useEffect(() => {
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadGraphData = async () => {
    try {
      setLoading(true);
      const data = await knowledgeApi.getGraphData();
      console.log('Graph data loaded:', data);
      setGraphData(data);
    } catch (error) {
      console.error('加载图谱数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleZoomIn = () => {
    if (chartInstance.current) {
      const option = chartInstance.current.getOption();
      const zoom = (option.series[0].zoom || 1) * 1.2;
      chartInstance.current.setOption({
        series: [{ zoom }],
      });
    }
  };

  const handleZoomOut = () => {
    if (chartInstance.current) {
      const option = chartInstance.current.getOption();
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
      setHighlightedNodes([]);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full"
          />
          <div className="text-center">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center gap-2 text-blue-400 mb-2"
            >
              <Sparkles size={20} />
              <span className="text-lg font-medium">正在加载知识图谱</span>
            </motion.div>
            <p className="text-sm text-gray-500">正在构建知识网络...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!graphData) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center shadow-lg">
            <span className="text-4xl">⚠️</span>
          </div>
          <p className="text-xl font-semibold text-gray-300 mb-2">无法加载图谱数据</p>
          <p className="text-sm text-gray-500">请检查网络连接或稍后重试</p>
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
        className="absolute bottom-6 left-6 bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl px-5 py-4 shadow-2xl"
        style={{
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div className="flex items-center gap-6 text-sm">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2"
          >
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 animate-pulse" />
            <span className="text-gray-300">
              节点:{' '}
              <span className="text-white font-bold text-base">{graphData?.nodes.length}</span>
            </span>
          </motion.div>
          <div className="w-px h-5 bg-slate-600" />
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2"
          >
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 animate-pulse" />
            <span className="text-gray-300">
              关系:{' '}
              <span className="text-white font-bold text-base">{graphData?.edges.length}</span>
            </span>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute top-6 right-6 flex flex-col gap-2"
      >
        {[
          { icon: ZoomIn, label: '放大', onClick: handleZoomIn },
          { icon: ZoomOut, label: '缩小', onClick: handleZoomOut },
          { icon: RotateCcw, label: '重置', onClick: handleReset },
          { icon: Maximize2, label: '全屏', onClick: handleFullscreen },
        ].map((item, index) => (
          <motion.button
            key={item.label}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * index }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={item.onClick}
            className="w-12 h-12 bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-xl flex items-center justify-center text-gray-300 hover:text-white hover:border-blue-500/50 transition-all shadow-lg"
            title={item.label}
          >
            <item.icon size={20} />
          </motion.button>
        ))}
      </motion.div>

      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-6 left-6 bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl px-5 py-4 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  backgroundColor: categoryColors[hoveredNode.category] || '#3B82F6',
                  boxShadow: `0 0 15px ${categoryColors[hoveredNode.category] || '#3B82F6'}`,
                }}
              />
              <div>
                <div className="text-white font-semibold">{hoveredNode.name}</div>
                <div className="text-gray-400 text-xs">{hoveredNode.category}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
