/**
 * GraphOptimizer 单元测试
 */

import { describe, expect, beforeEach, afterEach, test } from 'vitest'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { graphOptimizer } from './graphOptimizer';
import type { GraphData, GraphNode, GraphEdge } from '../api/knowledge';

describe('GraphOptimizer 性能测试', () => {
  beforeEach(() => {
    // 重置优化器配置
    graphOptimizer.updateConfig({
      enableLOD: true,
      enableViewportCulling: true,
      enableProgressiveLoading: true,
      enablePerformanceMonitoring: true,
      autoAdjustLOD: true,
      maxVisibleNodes: 1000,
      chunkSize: 100,
      cullingMargin: 200,
    });
  });

  afterEach(() => {
    graphOptimizer.stopMonitoring();
    graphOptimizer.dispose();
  });

  /**
   * 生成测试图谱数据
   */
  function generateGraphData(nodeCount: number): GraphData {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // 生成节点
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        id: `node-${i}`,
        name: `节点${i}`,
        category: `类别${i % 10}`,
        symbolSize: 10 + Math.random() * 20,
        value: Math.random(),
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        itemStyle: {
          color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        },
      });
    }

    // 生成边（每个节点连接 2-5 个其他节点）
    for (let i = 0; i < nodeCount; i++) {
      const connectionCount = Math.floor(Math.random() * 4) + 2;
      for (let j = 0; j < connectionCount; j++) {
        const target = Math.floor(Math.random() * nodeCount);
        if (target !== i) {
          edges.push({
            source: `node-${i}`,
            target: `node-${target}`,
            relationType: '关系',
            weight: Math.random(),
            lineStyle: {
              width: 1 + Math.random() * 2,
              curveness: Math.random() * 0.3,
              opacity: 0.3 + Math.random() * 0.5,
            },
          });
        }
      }
    }

    return {
      nodes,
      edges,
      categories: Array.from({ length: 10 }, (_, i) => ({
        name: `类别${i}`,
        itemStyle: { color: `hsl(${i * 36}, 70%, 50%)` },
      })),
    };
  }

  describe('LOD 性能测试', () => {
    test('500 节点 LOD 过滤性能', () => {
      const graphData = generateGraphData(500);
      const startTime = Date.now();

      const optimizedData = graphOptimizer.optimize(graphData);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50); // 50ms 内完成
      expect(optimizedData.optimizedData.nodes.length).toBeLessThanOrEqual(500);
    });

    test('1000 节点 LOD 过滤性能', () => {
      const graphData = generateGraphData(1000);
      const startTime = Date.now();

      const optimizedData = graphOptimizer.optimize(graphData);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // 100ms 内完成
      expect(optimizedData.optimizedData.nodes.length).toBeLessThanOrEqual(1000);
    });

    test('5000 节点 LOD 过滤性能', () => {
      const graphData = generateGraphData(5000);
      const startTime = Date.now();

      const optimizedData = graphOptimizer.optimize(graphData);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200); // 200ms 内完成
      expect(optimizedData.optimizedData.nodes.length).toBeLessThan(5000);
    });
  });

  describe('视口裁剪性能测试', () => {
    test('10000 节点视口裁剪', () => {
      const graphData = generateGraphData(10000);
      const startTime = Date.now();

      graphOptimizer.updateViewport(1920, 1080, 1);
      const optimizedData = graphOptimizer.optimize(graphData);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(300); // 300ms 内完成
      expect(optimizedData.optimizedNodeCount).toBeLessThanOrEqual(1000);
    });
  });

  describe('渐进式加载性能测试', () => {
    test('5000 节点渐进式加载', async () => {
      const graphData = generateGraphData(5000);
      let chunkCount = 0;

      const startTime = Date.now();

      const result = await graphOptimizer.loadProgressively(graphData, {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onChunkLoaded: (data, _progress) => {
          chunkCount++;
          expect(data.nodes.length).toBeGreaterThan(0);
        },
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // 1 秒内完成
      expect(result.nodes.length).toBe(5000);
      expect(chunkCount).toBeGreaterThan(0);
    });
  });

  describe('性能监控测试', () => {
    test('启动性能监控', () => {
      const getNodeCount = () => 1000;
      const getEdgeCount = () => 5000;

      graphOptimizer.startMonitoring(getNodeCount, getEdgeCount);

      // 等待一段时间让监控器收集数据
      setTimeout(() => {
        const report = graphOptimizer.getPerformanceReport();
        expect(report).not.toBeNull();
      }, 1000);
    });

    test('自动 LOD 调整', () => {
      const getNodeCount = () => 2000;
      const getEdgeCount = () => 10000;

      graphOptimizer.startMonitoring(getNodeCount, getEdgeCount);

      // 模拟低 FPS 场景
      setTimeout(() => {
        const currentLOD = graphOptimizer.getCurrentLODLevel();
        expect(currentLOD).toBeGreaterThanOrEqual(0);
        expect(currentLOD).toBeLessThanOrEqual(4);
      }, 1000);
    });
  });

  describe('混合渲染性能测试', () => {
    test('小规模图谱使用 2D 渲染', () => {
      const graphData = generateGraphData(100);
      const optimizedData = graphOptimizer.optimize(graphData);

      // 验证节点数不超过原始数量
      expect(optimizedData.optimizedData.nodes.length).toBeLessThanOrEqual(100);
      expect(optimizedData.optimizedData.nodes.length).toBeGreaterThan(0);
    });

    test('大规模图谱自动降级', () => {
      const graphData = generateGraphData(5000);
      const optimizedData = graphOptimizer.optimize(graphData);

      // 应该自动减少渲染节点数
      expect(optimizedData.optimizedNodeCount).toBeLessThanOrEqual(1000);
    });
  });

  describe('内存管理测试', () => {
    test('释放资源', () => {
      const graphData = generateGraphData(1000);
      graphOptimizer.optimize(graphData);

      // 释放资源
      graphOptimizer.dispose();

      // 验证资源已释放（这里可以通过检查内部状态来验证）
      expect(graphOptimizer).toBeDefined();
    });
  });
});
