/**
 * 图谱布局算法工具
 * 提供多种布局算法：force, circular, hierarchical, radial, grid
 */

import type { GraphNode, GraphEdge } from '../api/knowledge';

/**
 * 布局类型
 */
export type LayoutType = 'force' | 'circular' | 'hierarchical' | 'radial' | 'grid';

/**
 * 布局配置
 */
export interface LayoutConfig {
  type: LayoutType;
  width: number;
  height: number;
  nodeSpacing?: number;
  linkDistance?: number;
  center?: { x: number; y: number };
  // 层次布局特有
  direction?: 'TB' | 'BT' | 'LR' | 'RL'; // Top-Bottom, Bottom-Top, Left-Right, Right-Left
  levelSpacing?: number;
  // 环形布局特有
  radius?: number;
  startAngle?: number;
  // 辐射布局特有
  radialLevels?: number;
}

/**
 * 节点位置
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface NodePosition {
  x: number;
  y: number;
}

/**
 * 计算节点度
 */
function calculateNodeDegrees(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();

  nodes.forEach((node) => {
    degrees.set(node.id, 0);
  });

  edges.forEach((edge) => {
    const sourceDegree = degrees.get(edge.source) || 0;
    const targetDegree = degrees.get(edge.target) || 0;
    degrees.set(edge.source, sourceDegree + 1);
    degrees.set(edge.target, targetDegree + 1);
  });

  return degrees;
}

/**
 * 计算节点重要性（基于度和自定义值）
 */
function calculateNodeImportance(node: GraphNode, degree: number): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeValue = node.value || (node.metadata as any)?.importance || 0.5;
  return nodeValue * 0.6 + (degree / 10) * 0.4;
}

/**
 * 力导向布局（使用 ECharts 内置）
 */
export function applyForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  config: LayoutConfig
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { width, height: _height, nodeSpacing = 100, linkDistance: _linkDistance = 50 } = config; // eslint-disable-line @typescript-eslint/no-unused-vars
  const centerX = config.center?.x || width / 2;
  const centerY = config.center?.y || _height / 2;

  // 为节点分配初始位置（随机分布在中心附近）
  const positionedNodes = nodes.map((node) => ({
    ...node,
    x: centerX + (Math.random() - 0.5) * nodeSpacing,
    y: centerY + (Math.random() - 0.5) * nodeSpacing,
    fixed: false,
  }));

  // ECharts 的 force 布局会在渲染时进一步优化位置
  // 这里提供初始位置和配置参数
  return { nodes: positionedNodes, edges };
}

/**
 * 环形布局
 */
export function applyCircularLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  config: LayoutConfig
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { width, height, radius, startAngle = 0 } = config;
  const centerX = config.center?.x || width / 2;
  const centerY = config.center?.y || height / 2;
  const actualRadius = radius || Math.min(width, height) * 0.35;

  const degrees = calculateNodeDegrees(nodes, edges);

  // 按重要性排序节点，重要的放在顶部
  const sortedNodes = [...nodes].sort((a, b) => {
    const importanceA = calculateNodeImportance(a, degrees.get(a.id) || 0);
    const importanceB = calculateNodeImportance(b, degrees.get(b.id) || 0);
    return importanceB - importanceA;
  });

  const angleStep = (2 * Math.PI) / sortedNodes.length;

  const positionedNodes = sortedNodes.map((node, index) => {
    const angle = startAngle + index * angleStep;
    const x = centerX + actualRadius * Math.cos(angle);
    const y = centerY + actualRadius * Math.sin(angle);

    return {
      ...node,
      x,
      y,
      fixed: false,
    };
  });

  return { nodes: positionedNodes, edges };
}

/**
 * 层次布局（树状布局）
 */
export function applyHierarchicalLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  config: LayoutConfig
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { width, height, direction = 'TB', levelSpacing = 80, nodeSpacing = 60 } = config;

  // 计算节点的层级（使用 BFS）
  const rootNodes = findRootNodes(nodes, edges);
  const levels = new Map<string, number>();
  const queue: { id: string; level: number }[] = [];

  // 初始化根节点
  rootNodes.forEach((root) => {
    levels.set(root.id, 0);
    queue.push({ id: root.id, level: 0 });
  });

  // BFS 计算层级
  while (queue.length > 0) {
    const { id, level } = queue.shift()!;

    // 找到所有子节点
    const children = edges.filter((e) => e.source === id).map((e) => e.target);

    children.forEach((childId) => {
      if (!levels.has(childId)) {
        const childLevel = level + 1;
        levels.set(childId, childLevel);
        queue.push({ id: childId, level: childLevel });
      }
    });
  }

  // 处理没有父节点的孤立节点
  nodes.forEach((node) => {
    if (!levels.has(node.id)) {
      levels.set(node.id, 0);
    }
  });

  // 按层级分组
  const levelMap = new Map<number, GraphNode[]>();
  nodes.forEach((node) => {
    const level = levels.get(node.id) || 0;
    if (!levelMap.has(level)) {
      levelMap.set(level, []);
    }
    levelMap.get(level)!.push(node);
  });

  // 计算最大层级数（用于后续扩展）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const maxLevel = Math.max(...Array.from(levelMap.keys()));

  // 根据方向计算起始位置
  const isVertical = direction === 'TB' || direction === 'BT';
  const startY = direction === 'BT' ? height - 50 : 50;
  const startX = 50;

  // 为每个节点分配位置
  const positionedNodes = nodes.map((node) => {
    const level = levels.get(node.id) || 0;
    const levelNodes = levelMap.get(level) || [];
    const indexInLevel = levelNodes.indexOf(node);

    let x: number, y: number;

    if (isVertical) {
      // 垂直布局
      const levelWidth = width - 100;
      const nodeSpacingInLevel = Math.max(nodeSpacing, levelWidth / (levelNodes.length + 1));
      x = 50 + (indexInLevel + 1) * nodeSpacingInLevel;
      y = startY + level * levelSpacing * (direction === 'BT' ? -1 : 1);
    } else {
      // 水平布局
      const levelHeight = height - 100;
      const nodeSpacingInLevel = Math.max(nodeSpacing, levelHeight / (levelNodes.length + 1));
      x = startX + level * levelSpacing * (direction === 'RL' ? -1 : 1);
      y = 50 + (indexInLevel + 1) * nodeSpacingInLevel;
    }

    return {
      ...node,
      x: Math.max(50, Math.min(x, width - 50)),
      y: Math.max(50, Math.min(y, height - 50)),
      fixed: false,
    };
  });

  return { nodes: positionedNodes, edges };
}

/**
 * 辐射布局
 */
export function applyRadialLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  config: LayoutConfig
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { width, height, radialLevels = 5 } = config;
  const centerX = config.center?.x || width / 2;
  const centerY = config.center?.y || height / 2;
  const maxRadius = Math.min(width, height) * 0.4;

  const degrees = calculateNodeDegrees(nodes, edges);

  // 找到中心节点（度最大的节点）
  let centerNode = nodes[0];
  let maxDegree = 0;
  nodes.forEach((node) => {
    const degree = degrees.get(node.id) || 0;
    if (degree > maxDegree) {
      maxDegree = degree;
      centerNode = node;
    }
  });

  // 使用 BFS 计算每个节点到中心的距离
  const distances = new Map<string, number>();
  const queue: { id: string; distance: number }[] = [{ id: centerNode.id, distance: 0 }];
  distances.set(centerNode.id, 0);

  while (queue.length > 0) {
    const { id, distance } = queue.shift()!;

    // 找到相邻节点
    const neighbors = edges
      .filter((e) => e.source === id || e.target === id)
      .map((e) => (e.source === id ? e.target : e.source));

    neighbors.forEach((neighborId) => {
      if (!distances.has(neighborId)) {
        const newDistance = distance + 1;
        distances.set(neighborId, newDistance);
        queue.push({ id: neighborId, distance: newDistance });
      }
    });
  }

  // 处理孤立节点
  nodes.forEach((node) => {
    if (!distances.has(node.id)) {
      distances.set(node.id, radialLevels);
    }
  });

  // 按距离分组
  const distanceMap = new Map<number, GraphNode[]>();
  nodes.forEach((node) => {
    const distance = distances.get(node.id) || 0;
    const level = Math.min(distance, radialLevels - 1);
    if (!distanceMap.has(level)) {
      distanceMap.set(level, []);
    }
    distanceMap.get(level)!.push(node);
  });

  // 为每个节点分配位置
  const positionedNodes = nodes.map((node) => {
    const distance = distances.get(node.id) || 0;
    const level = Math.min(distance, radialLevels - 1);
    const levelNodes = distanceMap.get(level) || [];
    const indexInLevel = levelNodes.indexOf(node);

    // 计算半径
    const radius = (level / (radialLevels - 1)) * maxRadius;

    // 计算角度
    const angleStep = (2 * Math.PI) / Math.max(levelNodes.length, 1);
    const angle = indexInLevel * angleStep - Math.PI / 2; // 从顶部开始

    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    return {
      ...node,
      x,
      y,
      fixed: false,
    };
  });

  return { nodes: positionedNodes, edges };
}

/**
 * 网格布局
 */
export function applyGridLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  config: LayoutConfig
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { width, nodeSpacing = 80 } = config;
  // height 保留用于后续扩展
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { height: _height } = config;

  // 计算网格行列数
  const cols = Math.floor((width - 100) / nodeSpacing);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const rows = Math.ceil(nodes.length / cols);

  // 为每个节点分配网格位置
  const positionedNodes = nodes.map((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    const x = 50 + col * nodeSpacing;
    const y = 50 + row * nodeSpacing;

    return {
      ...node,
      x,
      y,
      fixed: false,
    };
  });

  return { nodes: positionedNodes, edges };
}

/**
 * 查找根节点（入度为 0 的节点）
 */
function findRootNodes(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const hasIncomingEdge = new Set<string>();

  edges.forEach((edge) => {
    hasIncomingEdge.add(edge.target);
  });

  return nodes.filter((node) => !hasIncomingEdge.has(node.id));
}

/**
 * 应用布局算法
 */
export function applyLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  config: LayoutConfig
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  switch (config.type) {
    case 'force':
      return applyForceLayout(nodes, edges, config);
    case 'circular':
      return applyCircularLayout(nodes, edges, config);
    case 'hierarchical':
      return applyHierarchicalLayout(nodes, edges, config);
    case 'radial':
      return applyRadialLayout(nodes, edges, config);
    case 'grid':
      return applyGridLayout(nodes, edges, config);
    default:
      return applyForceLayout(nodes, edges, config);
  }
}

/**
 * 平滑过渡到新布局
 */
export function transitionLayout(
  currentNodes: GraphNode[],
  targetNodes: GraphNode[],
  progress: number
): GraphNode[] {
  return targetNodes.map((targetNode, index) => {
    const currentNode = currentNodes[index] || targetNode;

    return {
      ...targetNode,
      x: currentNode.x! + (targetNode.x! - currentNode.x!) * progress,
      y: currentNode.y! + (targetNode.y! - currentNode.y!) * progress,
    };
  });
}

export default {
  applyLayout,
  applyForceLayout,
  applyCircularLayout,
  applyHierarchicalLayout,
  applyRadialLayout,
  applyGridLayout,
  transitionLayout,
};
