"""
知识图谱数据验证中间件
提供实体和关系数据的完整验证功能
"""

from typing import Dict, Any, List, Optional, Tuple
from pydantic import ValidationError
import re
import logging

logger = logging.getLogger(__name__)


class KnowledgeDataValidator:
    """知识图谱数据验证器"""

    VALID_ENTITY_TYPES = {
        'inheritor', 'technique', 'work', 'pattern', 
        'region', 'period', 'material'
    }

    VALID_RELATION_TYPES = {
        'inherits', 'creates', 'uses', 'belongs_to',
        'located_in', 'exists_in', 'made_of', 'related_to'
    }

    MAX_NAME_LENGTH = 200
    MAX_DESCRIPTION_LENGTH = 5000
    MIN_IMPORTANCE = 0.0
    MAX_IMPORTANCE = 1.0
    MIN_WEIGHT = 0.0
    MAX_WEIGHT = 1.0

    @classmethod
    def validate_entity(cls, entity_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        验证实体数据
        返回: (是否有效, 错误列表)
        """
        errors = []

        if not entity_data.get('name'):
            errors.append("实体名称不能为空")
        elif len(entity_data['name']) > cls.MAX_NAME_LENGTH:
            errors.append(f"实体名称长度不能超过 {cls.MAX_NAME_LENGTH} 字符")

        entity_type = entity_data.get('type')
        if not entity_type:
            errors.append("实体类型不能为空")
        elif entity_type not in cls.VALID_ENTITY_TYPES:
            errors.append(f"无效的实体类型: {entity_type}，支持的类型: {cls.VALID_ENTITY_TYPES}")

        importance = entity_data.get('importance', 0.0)
        if not (cls.MIN_IMPORTANCE <= importance <= cls.MAX_IMPORTANCE):
            errors.append(f"重要性评分必须在 {cls.MIN_IMPORTANCE} 到 {cls.MAX_IMPORTANCE} 之间")

        description = entity_data.get('description')
        if description and len(description) > cls.MAX_DESCRIPTION_LENGTH:
            errors.append(f"实体描述长度不能超过 {cls.MAX_DESCRIPTION_LENGTH} 字符")

        coordinates = entity_data.get('coordinates')
        if coordinates:
            if not isinstance(coordinates, dict):
                errors.append("坐标格式无效，应为字典格式")
            else:
                if 'lat' not in coordinates or 'lng' not in coordinates:
                    errors.append("坐标必须包含 lat 和 lng 字段")
                else:
                    if not (-90 <= coordinates['lat'] <= 90):
                        errors.append("纬度必须在 -90 到 90 之间")
                    if not (-180 <= coordinates['lng'] <= 180):
                        errors.append("经度必须在 -180 到 180 之间")

        metadata = entity_data.get('metadata') or entity_data.get('meta_data')
        if metadata and not isinstance(metadata, dict):
            errors.append("元数据必须是字典格式")

        return len(errors) == 0, errors

    @classmethod
    def validate_relationship(cls, rel_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        验证关系数据
        返回: (是否有效, 错误列表)
        """
        errors = []

        if not rel_data.get('source_id'):
            errors.append("源实体 ID 不能为空")

        if not rel_data.get('target_id'):
            errors.append("目标实体 ID 不能为空")

        if rel_data.get('source_id') == rel_data.get('target_id'):
            errors.append("源实体和目标实体不能相同")

        relation_type = rel_data.get('relation_type')
        if not relation_type:
            errors.append("关系类型不能为空")
        elif relation_type not in cls.VALID_RELATION_TYPES:
            logger.warning(f"未知的关系类型: {relation_type}")

        weight = rel_data.get('weight', 1.0)
        if not (cls.MIN_WEIGHT <= weight <= cls.MAX_WEIGHT):
            errors.append(f"关系权重必须在 {cls.MIN_WEIGHT} 到 {cls.MAX_WEIGHT} 之间")

        metadata = rel_data.get('metadata') or rel_data.get('meta_data')
        if metadata and not isinstance(metadata, dict):
            errors.append("元数据必须是字典格式")

        return len(errors) == 0, errors

    @classmethod
    def validate_batch_entities(cls, entities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        批量验证实体数据
        返回验证结果统计
        """
        results = {
            'total': len(entities),
            'valid': 0,
            'invalid': 0,
            'errors': [],
        }

        for idx, entity in enumerate(entities):
            is_valid, errors = cls.validate_entity(entity)
            if is_valid:
                results['valid'] += 1
            else:
                results['invalid'] += 1
                results['errors'].append({
                    'index': idx,
                    'name': entity.get('name', f'Entity {idx}'),
                    'errors': errors,
                })

        return results

    @classmethod
    def validate_batch_relationships(cls, relationships: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        批量验证关系数据
        返回验证结果统计
        """
        results = {
            'total': len(relationships),
            'valid': 0,
            'invalid': 0,
            'errors': [],
        }

        for idx, rel in enumerate(relationships):
            is_valid, errors = cls.validate_relationship(rel)
            if is_valid:
                results['valid'] += 1
            else:
                results['invalid'] += 1
                results['errors'].append({
                    'index': idx,
                    'source': rel.get('source_id', 'unknown'),
                    'target': rel.get('target_id', 'unknown'),
                    'errors': errors,
                })

        return results

    @classmethod
    def sanitize_entity(cls, entity_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        清理实体数据，移除无效字段
        """
        sanitized = {}

        if 'name' in entity_data:
            sanitized['name'] = entity_data['name'].strip()

        if 'type' in entity_data:
            sanitized['type'] = entity_data['type'].lower().strip()

        if 'description' in entity_data:
            sanitized['description'] = entity_data['description'].strip() if entity_data['description'] else None

        if 'region' in entity_data:
            sanitized['region'] = entity_data['region'].strip() if entity_data['region'] else None

        if 'period' in entity_data:
            sanitized['period'] = entity_data['period'].strip() if entity_data['period'] else None

        if 'importance' in entity_data:
            importance = float(entity_data['importance'])
            sanitized['importance'] = max(cls.MIN_IMPORTANCE, min(cls.MAX_IMPORTANCE, importance))

        if 'coordinates' in entity_data and entity_data['coordinates']:
            coords = entity_data['coordinates']
            if isinstance(coords, dict) and 'lat' in coords and 'lng' in coords:
                sanitized['coordinates'] = {
                    'lat': float(coords['lat']),
                    'lng': float(coords['lng']),
                }

        if 'metadata' in entity_data or 'meta_data' in entity_data:
            metadata = entity_data.get('metadata') or entity_data.get('meta_data')
            if isinstance(metadata, dict):
                sanitized['meta_data'] = metadata

        return sanitized

    @classmethod
    def validate_graph_data(cls, graph_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        验证完整的图谱数据（包含实体和关系）
        """
        errors = []

        entities = graph_data.get('entities', [])
        relationships = graph_data.get('relationships', [])

        entity_ids = set()

        for idx, entity in enumerate(entities):
            is_valid, entity_errors = cls.validate_entity(entity)
            if not is_valid:
                errors.extend([f"实体 {idx}: {err}" for err in entity_errors])
            
            if entity.get('id'):
                if entity['id'] in entity_ids:
                    errors.append(f"实体 ID 重复: {entity['id']}")
                entity_ids.add(entity['id'])

        for idx, rel in enumerate(relationships):
            is_valid, rel_errors = cls.validate_relationship(rel)
            if not is_valid:
                errors.extend([f"关系 {idx}: {err}" for err in rel_errors])

            if rel.get('source_id') and rel['source_id'] not in entity_ids:
                errors.append(f"关系 {idx}: 源实体不存在 - {rel['source_id']}")

            if rel.get('target_id') and rel['target_id'] not in entity_ids:
                errors.append(f"关系 {idx}: 目标实体不存在 - {rel['target_id']}")

        return len(errors) == 0, errors
