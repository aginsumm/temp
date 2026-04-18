/**
 * 数据验证工具类
 * 提供统一的数据验证功能，确保数据完整性和一致性
 */

import type { Entity, Relation, GraphNode, GraphEdge } from '../types/chat';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class DataValidator {
  /**
   * 验证实体数据
   */
  static validateEntity(entity: Entity): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 必填字段检查
    if (!entity.id) {
      errors.push('实体 ID 不能为空');
    }

    if (!entity.name) {
      errors.push('实体名称不能为空');
    } else if (entity.name.length > 255) {
      errors.push('实体名称不能超过 255 个字符');
    }

    if (!entity.type) {
      errors.push('实体类型不能为空');
    }

    // 可选字段验证
    if (entity.description && entity.description.length > 2000) {
      warnings.push('实体描述过长，建议精简');
    }

    if (entity.relevance !== undefined) {
      if (entity.relevance < 0 || entity.relevance > 1) {
        errors.push('实体相关性必须在 0-1 之间');
      }
    }

    // 坐标验证
    if (entity.coordinates) {
      if (
        typeof entity.coordinates.lat !== 'number' ||
        entity.coordinates.lat < -90 ||
        entity.coordinates.lat > 90
      ) {
        errors.push('纬度必须在 -90 到 90 之间');
      }
      if (
        typeof entity.coordinates.lng !== 'number' ||
        entity.coordinates.lng < -180 ||
        entity.coordinates.lng > 180
      ) {
        errors.push('经度必须在 -180 到 180 之间');
      }
    }

    // 重要性验证
    if (entity.importance !== undefined) {
      if (entity.importance < 0 || entity.importance > 1) {
        errors.push('实体重要性必须在 0-1 之间');
      }
    }

    // 数组字段验证
    if (entity.images && !Array.isArray(entity.images)) {
      errors.push('图片列表必须是数组');
    }

    if (entity.tags && !Array.isArray(entity.tags)) {
      errors.push('标签列表必须是数组');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证图谱节点数据
   */
  static validateGraphNode(node: GraphNode): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 必填字段检查
    if (!node.id) {
      errors.push('节点 ID 不能为空');
    }

    if (!node.name) {
      errors.push('节点名称不能为空');
    }

    if (!node.category) {
      errors.push('节点类别不能为空');
    }

    // 可选字段验证
    if (node.symbolSize !== undefined && (node.symbolSize < 0 || node.symbolSize > 100)) {
      warnings.push('节点大小必须在 0-100 之间');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证关系数据
   */
  static validateRelation(relation: Relation): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 必填字段检查
    if (!relation.id) {
      errors.push('关系 ID 不能为空');
    }

    if (!relation.source) {
      errors.push('源实体 ID 不能为空');
    }

    if (!relation.target) {
      errors.push('目标实体 ID 不能为空');
    }

    if (!relation.type) {
      errors.push('关系类型不能为空');
    }

    // 自环检查
    if (relation.source === relation.target) {
      warnings.push('关系的源实体和目标实体相同');
    }

    // 置信度验证
    if (relation.confidence !== undefined) {
      if (typeof relation.confidence !== 'number') {
        errors.push('置信度必须是数字');
      } else if (relation.confidence < 0 || relation.confidence > 1) {
        errors.push('置信度必须在 0-1 之间');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证图谱边数据
   */
  static validateGraphEdge(edge: GraphEdge): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 必填字段检查
    if (!edge.id) {
      errors.push('边 ID 不能为空');
    }

    if (!edge.source) {
      errors.push('源节点 ID 不能为空');
    }

    if (!edge.target) {
      errors.push('目标节点 ID 不能为空');
    }

    if (!edge.relationType) {
      errors.push('关系类型不能为空');
    }

    // 权重验证
    if (edge.value !== undefined && edge.value < 0) {
      warnings.push('边权重应为非负数');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证图谱数据
   */
  static validateGraphData(nodes: GraphNode[], edges: GraphEdge[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 节点验证
    nodes.forEach((node, index) => {
      const result = this.validateGraphNode(node);
      if (!result.valid) {
        errors.push(`节点 ${index + 1}: ${result.errors.join(', ')}`);
      }
      warnings.push(...result.warnings.map((w) => `节点 ${index + 1}: ${w}`));
    });

    // 边验证
    edges.forEach((edge, index) => {
      const result = this.validateGraphEdge(edge);
      if (!result.valid) {
        errors.push(`边 ${index + 1}: ${result.errors.join(', ')}`);
      }
      warnings.push(...result.warnings.map((w) => `边 ${index + 1}: ${w}`));
    });

    // 引用完整性检查
    const nodeIds = new Set(nodes.map((n) => n.id));
    edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.source)) {
        errors.push(`边 ${index + 1}: 源实体 ${edge.source} 不存在于节点列表中`);
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`边 ${index + 1}: 目标实体 ${edge.target} 不存在于节点列表中`);
      }
    });

    // 孤立节点警告
    const connectedNodeIds = new Set<string>();
    edges.forEach((edge) => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });

    nodes.forEach((node) => {
      if (!connectedNodeIds.has(node.id)) {
        warnings.push(`节点 ${node.name} (${node.id}) 是孤立节点`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证并过滤无效数据
   */
  static sanitizeGraphData(
    nodes: GraphNode[],
    edges: GraphEdge[]
  ): { nodes: GraphNode[]; edges: GraphEdge[]; removedNodes: number; removedEdges: number } {
    // 过滤无效节点
    const validNodes = nodes.filter((node) => {
      const result = this.validateGraphNode(node);
      return result.valid;
    });

    const nodeIds = new Set(validNodes.map((n) => n.id));

    // 过滤无效边和引用不存在的边
    const validEdges = edges.filter((edge) => {
      const result = this.validateGraphEdge(edge);
      if (!result.valid) {
        return false;
      }
      // 检查引用的节点是否存在
      return nodeIds.has(edge.source) && nodeIds.has(edge.target);
    });

    return {
      nodes: validNodes,
      edges: validEdges,
      removedNodes: nodes.length - validNodes.length,
      removedEdges: edges.length - validEdges.length,
    };
  }

  /**
   * 验证搜索查询
   */
  static validateSearchQuery(query: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!query || query.trim().length === 0) {
      errors.push('搜索关键词不能为空');
    } else if (query.length > 500) {
      errors.push('搜索关键词过长');
    } else if (query.length < 2) {
      warnings.push('搜索关键词过短，可能影响搜索结果');
    }

    // 特殊字符检查
    const specialChars = /[<>\"\'&]/g;
    if (specialChars.test(query)) {
      warnings.push('搜索词包含特殊字符，可能影响搜索结果');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证会话 ID
   */
  static validateSessionId(sessionId: string): boolean {
    if (!sessionId || typeof sessionId !== 'string') {
      return false;
    }
    // UUID 格式检查
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(sessionId);
  }

  /**
   * 验证消息内容
   */
  static validateMessageContent(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push('消息内容不能为空');
    } else if (content.length > 10000) {
      errors.push('消息内容过长');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * 高阶组件：数据验证包装器
 */
export function withValidation<T extends object>(
  data: T,
  validator: (data: T) => ValidationResult,
  options: {
    throwOnError?: boolean;
    logWarnings?: boolean;
  } = {}
): T {
  const { throwOnError = false, logWarnings = true } = options;

  const result = validator(data);

  if (logWarnings && result.warnings.length > 0) {
    console.warn('Data validation warnings:', result.warnings);
  }

  if (!result.valid) {
    if (throwOnError) {
      throw new Error(`Data validation failed: ${result.errors.join(', ')}`);
    }
    console.error('Data validation errors:', result.errors);
  }

  return data;
}
