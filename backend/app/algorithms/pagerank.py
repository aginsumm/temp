"""
PageRank 图算法实现
用于计算知识图谱中实体的重要性评分
"""

from typing import Dict, List, Set, Tuple
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


class PageRankCalculator:
    """PageRank 算法实现"""

    def __init__(
        self,
        damping_factor: float = 0.85,
        max_iterations: int = 100,
        convergence_threshold: float = 1e-6,
    ):
        """
        初始化 PageRank 计算器
        
        参数:
            damping_factor: 阻尼系数（通常 0.85）
            max_iterations: 最大迭代次数
            convergence_threshold: 收敛阈值
        """
        self.damping_factor = damping_factor
        self.max_iterations = max_iterations
        self.convergence_threshold = convergence_threshold

    def calculate(
        self,
        entities: List[str],
        relationships: List[Tuple[str, str, float]],
    ) -> Dict[str, float]:
        """
        计算所有实体的 PageRank 值
        
        参数:
            entities: 实体 ID 列表
            relationships: 关系列表 [(source_id, target_id, weight)]
            
        返回:
            {entity_id: pagerank_score}
        """
        if not entities:
            return {}

        # 构建图
        graph = self._build_graph(entities, relationships)
        
        # 初始化 PageRank 值
        num_entities = len(entities)
        pagerank = {entity: 1.0 / num_entities for entity in entities}

        # 迭代计算
        for iteration in range(self.max_iterations):
            new_pagerank = {}
            max_diff = 0.0

            for entity in entities:
                # 计算入链贡献
                rank_sum = 0.0
                for neighbor, weight in graph['incoming'].get(entity, []):
                    out_degree = len(graph['outgoing'].get(neighbor, []))
                    if out_degree > 0:
                        rank_sum += weight * pagerank[neighbor] / out_degree

                # PageRank 公式
                new_rank = (1 - self.damping_factor) / num_entities + \
                          self.damping_factor * rank_sum
                
                new_pagerank[entity] = new_rank
                
                # 计算最大差异
                max_diff = max(max_diff, abs(new_rank - pagerank[entity]))

            pagerank = new_pagerank

            # 检查收敛
            if max_diff < self.convergence_threshold:
                logger.info(f"PageRank 收敛于迭代 {iteration + 1}")
                break

        # 归一化到 [0, 1] 范围
        pagerank = self._normalize_scores(pagerank)

        return pagerank

    def _build_graph(
        self,
        entities: List[str],
        relationships: List[Tuple[str, str, float]],
    ) -> Dict[str, Dict]:
        """构建图结构"""
        graph = {
            'incoming': defaultdict(list),
            'outgoing': defaultdict(list),
        }

        for source, target, weight in relationships:
            if source in entities and target in entities:
                graph['outgoing'][source].append((target, weight))
                graph['incoming'][target].append((source, weight))

        return graph

    def _normalize_scores(self, scores: Dict[str, float]) -> Dict[str, float]:
        """归一化分数到 [0, 1] 范围"""
        if not scores:
            return scores

        min_score = min(scores.values())
        max_score = max(scores.values())

        if max_score == min_score:
            return {entity: 0.5 for entity in scores.keys()}

        normalized = {}
        for entity, score in scores.items():
            normalized[entity] = (score - min_score) / (max_score - min_score)

        return normalized

    def calculate_with_categories(
        self,
        entities: List[Dict],
        relationships: List[Dict],
    ) -> Dict[str, float]:
        """
        计算带分类的 PageRank（考虑实体类型权重）
        
        参数:
            entities: 实体列表 [{'id': str, 'type': str, ...}]
            relationships: 关系列表 [{'source_id': str, 'target_id': str, 'weight': float}]
            
        返回:
            {entity_id: pagerank_score}
        """
        entity_ids = [e['id'] for e in entities]
        rel_tuples = [
            (r['source_id'], r['target_id'], r.get('weight', 1.0))
            for r in relationships
        ]

        return self.calculate(entity_ids, rel_tuples)

    def get_top_entities(
        self,
        pagerank_scores: Dict[str, float],
        top_k: int = 10,
    ) -> List[Tuple[str, float]]:
        """获取 PageRank 最高的实体"""
        sorted_entities = sorted(
            pagerank_scores.items(),
            key=lambda x: x[1],
            reverse=True,
        )
        return sorted_entities[:top_k]


class ImprovedPageRankCalculator(PageRankCalculator):
    """改进版 PageRank 计算器（支持个性化排序）"""

    def __init__(
        self,
        damping_factor: float = 0.85,
        max_iterations: int = 100,
        convergence_threshold: float = 1e-6,
        personalization: Dict[str, float] = None,
    ):
        super().__init__(damping_factor, max_iterations, convergence_threshold)
        self.personalization = personalization

    def calculate(
        self,
        entities: List[str],
        relationships: List[Tuple[str, str, float]],
    ) -> Dict[str, float]:
        """带个性化的 PageRank 计算"""
        if not entities:
            return {}

        graph = self._build_graph(entities, relationships)
        
        num_entities = len(entities)
        
        # 使用个性化向量或均匀分布
        if self.personalization:
            personalization_vector = {
                entity: self.personalization.get(entity, 0.0)
                for entity in entities
            }
            # 归一化个性化向量
            total = sum(personalization_vector.values())
            if total > 0:
                personalization_vector = {
                    k: v / total for k, v in personalization_vector.items()
                }
            else:
                personalization_vector = {entity: 1.0 / num_entities for entity in entities}
        else:
            personalization_vector = {entity: 1.0 / num_entities for entity in entities}

        pagerank = personalization_vector.copy()

        # 迭代计算
        for iteration in range(self.max_iterations):
            new_pagerank = {}
            max_diff = 0.0

            for entity in entities:
                rank_sum = 0.0
                for neighbor, weight in graph['incoming'].get(entity, []):
                    out_degree = len(graph['outgoing'].get(neighbor, []))
                    if out_degree > 0:
                        rank_sum += weight * pagerank[neighbor] / out_degree

                # 带个性化的 PageRank 公式
                new_rank = (1 - self.damping_factor) * personalization_vector[entity] + \
                          self.damping_factor * rank_sum
                
                new_pagerank[entity] = new_rank
                max_diff = max(max_diff, abs(new_rank - pagerank[entity]))

            pagerank = new_pagerank

            if max_diff < self.convergence_threshold:
                logger.info(f"个性化 PageRank 收敛于迭代 {iteration + 1}")
                break

        return self._normalize_scores(pagerank)
