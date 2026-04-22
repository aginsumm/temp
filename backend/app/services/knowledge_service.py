from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone
import logging

from app.models.knowledge import Entity, Relationship, SearchHistory, Favorite, Feedback, EntityAlias, GraphVersion
from app.algorithms.pagerank import PageRankCalculator
from app.schemas.knowledge import (
    EntityCreate,
    EntityUpdate,
    RelationshipCreate,
    RelationshipUpdate,
    SearchRequest,
    AdvancedSearchRequest,
    FavoriteCreate,
    FeedbackCreate,
    ExportRequest,
    ImportRequest,
)

logger = logging.getLogger(__name__)


class KnowledgeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_entity(self, entity_data: EntityCreate) -> Entity:
        entity = Entity(**entity_data.model_dump())
        self.db.add(entity)
        await self.db.commit()
        await self.db.refresh(entity)
        return entity

    async def get_entity(self, entity_id: str) -> Optional[Entity]:
        result = await self.db.execute(
            select(Entity).where(Entity.id == entity_id)
        )
        return result.scalar_one_or_none()

    async def update_entity(
        self, entity_id: str, update_data: EntityUpdate
    ) -> Optional[Entity]:
        entity = await self.get_entity(entity_id)
        if not entity:
            return None

        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(entity, key, value)

        await self.db.commit()
        await self.db.refresh(entity)
        return entity

    async def delete_entity(self, entity_id: str) -> bool:
        entity = await self.get_entity(entity_id)
        if not entity:
            return False

        await self.db.delete(entity)
        await self.db.commit()
        return True

    async def search_entities(
        self, search_request: SearchRequest
    ) -> tuple[List[Entity], int]:
        query = select(Entity)

        conditions = []

        if search_request.keyword:
            keyword = f"%{search_request.keyword}%"
            conditions.append(
                or_(
                    Entity.name.ilike(keyword),
                    Entity.description.ilike(keyword),
                )
            )

        if search_request.category and search_request.category != "all":
            conditions.append(Entity.type == search_request.category)

        if search_request.region:
            conditions.append(Entity.region.in_(search_request.region))

        if search_request.period:
            conditions.append(Entity.period.in_(search_request.period))

        if conditions:
            query = query.where(and_(*conditions))

        total_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(total_query)
        total = total_result.scalar()

        if search_request.sort_by == "name":
            query = query.order_by(Entity.name)
        elif search_request.sort_by == "date":
            query = query.order_by(Entity.created_at.desc())
        else:
            query = query.order_by(Entity.importance.desc())

        query = query.offset(
            (search_request.page - 1) * search_request.page_size
        ).limit(search_request.page_size)

        result = await self.db.execute(query)
        entities = result.scalars().all()

        return list(entities), total

    async def calculate_pagerank(self, top_k: int = 20) -> Dict[str, Any]:
        """计算图谱 PageRank 并返回重要性排序"""
        # 获取所有实体和关系
        entities_result = await self.db.execute(select(Entity))
        entities = entities_result.scalars().all()

        relationships_result = await self.db.execute(select(Relationship))
        relationships = relationships_result.scalars().all()

        if not entities:
            return {
                "pagerank_scores": {},
                "top_entities": [],
                "total_computed": 0,
            }

        # 构建 PageRank 输入
        entity_ids = [e.id for e in entities]
        rel_tuples = [
            (r.source_id, r.target_id, r.weight)
            for r in relationships
        ]

        # 计算 PageRank
        calculator = PageRankCalculator()
        pagerank_scores = calculator.calculate(entity_ids, rel_tuples)

        # 获取 Top K 实体
        top_entity_ids = calculator.get_top_entities(pagerank_scores, top_k)
        
        # 获取实体详情
        top_entities = []
        for entity_id, score in top_entity_ids:
            entity = await self.get_entity(entity_id)
            if entity:
                top_entities.append({
                    "id": entity.id,
                    "name": entity.name,
                    "type": entity.type,
                    "pagerank_score": round(score, 4),
                    "original_importance": entity.importance,
                })

        return {
            "pagerank_scores": {k: round(v, 4) for k, v in pagerank_scores.items()},
            "top_entities": top_entities,
            "total_computed": len(entities),
        }

    async def update_entity_importance_with_pagerank(
        self,
        weight_pagerank: float = 0.7,
        weight_original: float = 0.3,
    ) -> Dict[str, Any]:
        """使用 PageRank 更新实体重要性评分"""
        pagerank_result = await self.calculate_pagerank()
        pagerank_scores = pagerank_result["pagerank_scores"]

        updated_count = 0
        for entity_id, pagerank_score in pagerank_scores.items():
            entity = await self.get_entity(entity_id)
            if entity:
                # 综合评分 = PageRank 权重 + 原始重要性权重
                new_importance = (
                    weight_pagerank * pagerank_score +
                    weight_original * entity.importance
                )
                entity.importance = round(new_importance, 4)
                updated_count += 1

        await self.db.commit()

        return {
            "updated_count": updated_count,
            "weight_pagerank": weight_pagerank,
            "weight_original": weight_original,
        }

    async def create_snapshot(
        self,
        title: str,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        created_by: Optional[str] = None,
    ) -> GraphVersion:
        """创建图谱快照"""
        entities_result = await self.db.execute(select(Entity))
        entities = entities_result.scalars().all()

        relationships_result = await self.db.execute(select(Relationship))
        relationships = relationships_result.scalars().all()

        snapshot_data = {
            "entities": [
                {
                    "id": e.id,
                    "name": e.name,
                    "type": e.type,
                    "description": e.description,
                    "region": e.region,
                    "period": e.period,
                    "importance": e.importance,
                }
                for e in entities
            ],
            "relationships": [
                {
                    "id": r.id,
                    "source_id": r.source_id,
                    "target_id": r.target_id,
                    "relation_type": r.relation_type,
                    "weight": r.weight,
                }
                for r in relationships
            ],
        }

        snapshot = GraphVersion(
            title=title,
            description=description,
            snapshot_data=snapshot_data,
            entity_count=len(entities),
            relationship_count=len(relationships),
            tags=tags or [],
            created_by=created_by,
        )

        self.db.add(snapshot)
        await self.db.commit()
        await self.db.refresh(snapshot)

        return snapshot

    async def get_snapshots(
        self,
        page: int = 1,
        page_size: int = 20,
        created_by: Optional[str] = None,
    ) -> Tuple[List[GraphVersion], int]:
        """获取快照列表"""
        query = select(GraphVersion)

        if created_by:
            query = query.where(GraphVersion.created_by == created_by)

        total_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(total_query)
        total = total_result.scalar()

        query = query.order_by(GraphVersion.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        snapshots = result.scalars().all()

        return list(snapshots), total

    async def get_snapshot(self, snapshot_id: str) -> Optional[GraphVersion]:
        """获取快照详情"""
        result = await self.db.execute(
            select(GraphVersion).where(GraphVersion.id == snapshot_id)
        )
        return result.scalar_one_or_none()

    async def delete_snapshot(self, snapshot_id: str) -> bool:
        """删除快照"""
        result = await self.db.execute(
            select(GraphVersion).where(GraphVersion.id == snapshot_id)
        )
        snapshot = result.scalar_one_or_none()

        if not snapshot:
            return False

        await self.db.delete(snapshot)
        await self.db.commit()
        return True

    async def restore_snapshot(self, snapshot_id: str) -> Dict[str, Any]:
        """从快照恢复图谱"""
        snapshot = await self.get_snapshot(snapshot_id)
        if not snapshot:
            raise ValueError("快照不存在")

        snapshot_data = snapshot.snapshot_data
        entities_data = snapshot_data.get("entities", [])
        relationships_data = snapshot_data.get("relationships", [])

        restored_entities = 0
        restored_relationships = 0

        for entity_data in entities_data:
            entity = await self.get_entity(entity_data["id"])
            if entity:
                entity.name = entity_data["name"]
                entity.type = entity_data["type"]
                entity.description = entity_data.get("description")
                entity.region = entity_data.get("region")
                entity.period = entity_data.get("period")
                entity.importance = entity_data.get("importance", 0.0)
                restored_entities += 1
            else:
                new_entity = Entity(**entity_data)
                self.db.add(new_entity)
                restored_entities += 1

        for rel_data in relationships_data:
            rel = await self.get_relationship(rel_data["id"])
            if rel:
                rel.source_id = rel_data["source_id"]
                rel.target_id = rel_data["target_id"]
                rel.relation_type = rel_data["relation_type"]
                rel.weight = rel_data.get("weight", 1.0)
                restored_relationships += 1
            else:
                new_rel = Relationship(**rel_data)
                self.db.add(new_rel)
                restored_relationships += 1

        await self.db.commit()

        return {
            "restored_entities": restored_entities,
            "restored_relationships": restored_relationships,
            "snapshot_title": snapshot.title,
        }

    async def diff_snapshots(
        self, snapshot_id_1: str, snapshot_id_2: str
    ) -> Dict[str, Any]:
        """比较两个快照的差异"""
        snapshot1 = await self.get_snapshot(snapshot_id_1)
        snapshot2 = await self.get_snapshot(snapshot_id_2)

        if not snapshot1 or not snapshot2:
            raise ValueError("快照不存在")

        entities1 = {e["id"]: e for e in snapshot1.snapshot_data.get("entities", [])}
        entities2 = {e["id"]: e for e in snapshot2.snapshot_data.get("entities", [])}

        added_entities = len(set(entities2.keys()) - set(entities1.keys()))
        removed_entities = len(set(entities1.keys()) - set(entities2.keys()))
        modified_entities = sum(
            1
            for eid in set(entities1.keys()) & set(entities2.keys())
            if entities1[eid] != entities2[eid]
        )

        rels1 = {r["id"]: r for r in snapshot1.snapshot_data.get("relationships", [])}
        rels2 = {r["id"]: r for r in snapshot2.snapshot_data.get("relationships", [])}

        added_relationships = len(set(rels2.keys()) - set(rels1.keys()))
        removed_relationships = len(set(rels1.keys()) - set(rels2.keys()))

        return {
            "added_entities": added_entities,
            "removed_entities": removed_entities,
            "modified_entities": modified_entities,
            "added_relationships": added_relationships,
            "removed_relationships": removed_relationships,
        }

    async def advanced_search_entities(
        self, search_request: AdvancedSearchRequest
    ) -> tuple[List[Entity], int]:
        query = select(Entity)

        conditions = []

        if search_request.keyword:
            keyword = f"%{search_request.keyword}%"
            conditions.append(
                or_(
                    Entity.name.ilike(keyword),
                    Entity.description.ilike(keyword),
                )
            )

        if search_request.categories:
            conditions.append(Entity.type.in_(search_request.categories))

        if search_request.regions:
            conditions.append(Entity.region.in_(search_request.regions))

        if search_request.periods:
            conditions.append(Entity.period.in_(search_request.periods))

        if search_request.min_importance is not None:
            conditions.append(Entity.importance >= search_request.min_importance)

        if search_request.max_importance is not None:
            conditions.append(Entity.importance <= search_request.max_importance)

        if conditions:
            query = query.where(and_(*conditions))

        total_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(total_query)
        total = total_result.scalar()

        if search_request.sort_by == "name":
            query = query.order_by(Entity.name)
        elif search_request.sort_by == "date":
            query = query.order_by(Entity.created_at.desc())
        else:
            query = query.order_by(Entity.importance.desc())

        query = query.offset(
            (search_request.page - 1) * search_request.page_size
        ).limit(search_request.page_size)

        result = await self.db.execute(query)
        entities = result.scalars().all()

        return list(entities), total

    async def create_relationship(
        self, relationship_data: RelationshipCreate
    ) -> Relationship:
        relationship = Relationship(**relationship_data.model_dump())
        self.db.add(relationship)
        await self.db.commit()
        await self.db.refresh(relationship)
        return relationship

    async def get_entity_relationships(
        self, entity_id: str
    ) -> List[Relationship]:
        result = await self.db.execute(
            select(Relationship).where(
                or_(
                    Relationship.source_id == entity_id,
                    Relationship.target_id == entity_id,
                )
            )
        )
        return list(result.scalars().all())

    async def get_related_entities(
        self, entity_id: str, _max_depth: int = 1
    ) -> List[Entity]:
        relationships = await self.get_entity_relationships(entity_id)

        related_ids = set()
        for rel in relationships:
            if rel.source_id != entity_id:
                related_ids.add(rel.source_id)
            if rel.target_id != entity_id:
                related_ids.add(rel.target_id)

        if not related_ids:
            return []

        result = await self.db.execute(
            select(Entity).where(Entity.id.in_(related_ids))
        )
        return list(result.scalars().all())

    async def get_graph_data(
        self,
        center_entity_id: Optional[str] = None,
        max_depth: int = 2,
    ) -> tuple[List[Entity], List[Relationship]]:
        if center_entity_id:
            center_entity = await self.get_entity(center_entity_id)
            if not center_entity:
                return [], []

            entities = [center_entity]
            relationships = []

            current_level_ids = {center_entity_id}

            for _depth in range(max_depth):
                next_level_ids = set()

                for entity_id in current_level_ids:
                    try:
                        rels = await self.get_entity_relationships(entity_id)

                        for rel in rels:
                            if rel not in relationships:
                                relationships.append(rel)

                            if rel.source_id != entity_id:
                                next_level_ids.add(rel.source_id)
                            if rel.target_id != entity_id:
                                next_level_ids.add(rel.target_id)
                    except SQLAlchemyError as e:
                        logger.error(f"获取实体关系失败：{entity_id}, 错误：{e}")
                        continue
                    except Exception as e:
                        logger.error(f"处理实体关系时发生未知错误：{entity_id}, 错误：{e}")
                        continue

                if not next_level_ids:
                    break

                try:
                    new_entities = await self.db.execute(
                        select(Entity).where(
                            Entity.id.in_(next_level_ids)
                        )
                    )
                    for entity in new_entities.scalars().all():
                        if entity not in entities:
                            entities.append(entity)
                except SQLAlchemyError as e:
                    logger.error(f"获取新实体失败：{next_level_ids}, 错误：{e}")
                    break
                except Exception as e:
                    logger.error(f"处理新实体时发生未知错误：{e}")
                    break

                current_level_ids = next_level_ids
        else:
            try:
                result = await self.db.execute(
                    select(Entity).order_by(Entity.importance.desc()).limit(100)
                )
                entities = list(result.scalars().all())

                entity_ids = [e.id for e in entities]
                result = await self.db.execute(
                    select(Relationship).where(
                        or_(
                            Relationship.source_id.in_(entity_ids),
                            Relationship.target_id.in_(entity_ids),
                        )
                    )
                )
                relationships = list(result.scalars().all())
            except SQLAlchemyError as e:
                logger.error(f"获取图谱数据失败: {e}")
                return [], []
            except Exception as e:
                logger.error(f"处理图谱数据时发生未知错误: {e}")
                return [], []

        return entities, relationships

    async def find_path(
        self, source_id: str, target_id: str, max_depth: int = 3
    ) -> List[List[str]]:
        from collections import deque

        if source_id == target_id:
            return [[source_id]]

        paths = []
        max_paths = 100
        max_iterations = 10000
        max_queue_size = 10000

        queue = deque()
        queue.append(([source_id], 0, {source_id}))

        iteration_count = 0

        while queue and iteration_count < max_iterations:
            iteration_count += 1

            if len(queue) > max_queue_size:
                break

            current_path, depth, visited = queue.popleft()

            if depth > max_depth:
                continue

            current_id = current_path[-1]

            if current_id == target_id:
                paths.append(current_path)
                if len(paths) >= max_paths:
                    break
                continue

            relationships = await self.get_entity_relationships(current_id)

            for rel in relationships:
                next_id = (
                    rel.target_id if rel.source_id == current_id else rel.source_id
                )

                if next_id not in visited:
                    new_visited = visited.copy()
                    new_visited.add(next_id)
                    new_path = current_path.copy()
                    new_path.append(next_id)
                    queue.append((new_path, depth + 1, new_visited))

        return paths

    async def analyze_graph_connectivity(self) -> Dict[str, Any]:
        result = await self.db.execute(select(func.count()).select_from(Entity))
        total_entities = result.scalar()

        result = await self.db.execute(select(func.count()).select_from(Relationship))
        total_relationships = result.scalar()

        if total_entities == 0:
            return {
                "total_entities": 0,
                "total_relationships": 0,
                "average_degree": 0.0,
                "density": 0.0,
                "connected_components": 0,
            }

        average_degree = (2 * total_relationships) / total_entities if total_entities > 0 else 0.0
        max_possible_edges = total_entities * (total_entities - 1) / 2
        density = total_relationships / max_possible_edges if max_possible_edges > 0 else 0.0

        connected_components = await self._count_connected_components()

        return {
            "total_entities": total_entities,
            "total_relationships": total_relationships,
            "average_degree": round(average_degree, 2),
            "density": round(density, 4),
            "connected_components": connected_components,
        }

    async def _count_connected_components(self) -> int:
        result = await self.db.execute(select(Entity.id))
        all_entity_ids = [row[0] for row in result.all()]

        if not all_entity_ids:
            return 0

        visited = set()
        components = 0

        for entity_id in all_entity_ids:
            if entity_id not in visited:
                components += 1
                queue = [entity_id]
                visited.add(entity_id)

                while queue:
                    current_id = queue.pop(0)
                    relationships = await self.get_entity_relationships(current_id)

                    for rel in relationships:
                        next_id = (
                            rel.target_id if rel.source_id == current_id else rel.source_id
                        )
                        if next_id not in visited:
                            visited.add(next_id)
                            queue.append(next_id)

        return components

    async def analyze_entity_centrality(self, entity_id: str) -> Dict[str, Any]:
        relationships = await self.get_entity_relationships(entity_id)
        degree_centrality = len(relationships)

        result = await self.db.execute(select(func.count()).select_from(Entity))
        total_entities = result.scalar()

        normalized_degree = degree_centrality / (total_entities - 1) if total_entities > 1 else 0.0

        return {
            "entity_id": entity_id,
            "degree_centrality": degree_centrality,
            "normalized_degree": round(normalized_degree, 4),
        }

    async def analyze_community_structure(self) -> Dict[str, Any]:
        result = await self.db.execute(
            select(Entity.type, func.count(Entity.id)).group_by(Entity.type)
        )
        type_counts = {row[0]: row[1] for row in result.all()}

        communities = []
        for entity_type, count in type_counts.items():
            communities.append({
                "type": entity_type,
                "size": count,
                "percentage": round(count / sum(type_counts.values()) * 100, 2) if type_counts else 0.0
            })

        return {
            "total_communities": len(communities),
            "communities": communities,
        }

    async def get_statistics(self) -> Dict[str, Any]:
        total_entities_result = await self.db.execute(
            select(func.count()).select_from(Entity)
        )
        total_entities = total_entities_result.scalar()

        total_relationships_result = await self.db.execute(
            select(func.count()).select_from(Relationship)
        )
        total_relationships = total_relationships_result.scalar()

        entities_by_type_result = await self.db.execute(
            select(Entity.type, func.count(Entity.id))
            .group_by(Entity.type)
        )
        entities_by_type = {
            row[0]: row[1] for row in entities_by_type_result.all()
        }

        relationships_by_type_result = await self.db.execute(
            select(Relationship.relation_type, func.count(Relationship.id))
            .group_by(Relationship.relation_type)
        )
        relationships_by_type = {
            row[0]: row[1]
            for row in relationships_by_type_result.all()
        }

        top_entities_result = await self.db.execute(
            select(Entity)
            .order_by(Entity.importance.desc())
            .limit(10)
        )
        top_entities = [
            {"id": e.id, "name": e.name, "type": e.type, "importance": e.importance}
            for e in top_entities_result.scalars().all()
        ]

        return {
            "total_entities": total_entities,
            "total_relationships": total_relationships,
            "entities_by_type": entities_by_type,
            "relationships_by_type": relationships_by_type,
            "top_entities": top_entities,
        }

    async def save_search_history(
        self, user_id: str, search_request: SearchRequest, result_count: int
    ):
        history = SearchHistory(
            user_id=user_id,
            keyword=search_request.keyword or "",
            filters={
                "category": search_request.category,
                "region": search_request.region,
                "period": search_request.period,
            },
            result_count=result_count,
        )
        self.db.add(history)
        await self.db.commit()

    async def add_favorite(self, favorite_data: FavoriteCreate) -> Favorite:
        existing = await self.db.execute(
            select(Favorite).where(
                and_(
                    Favorite.user_id == favorite_data.user_id,
                    Favorite.entity_id == favorite_data.entity_id,
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("已收藏该实体")

        favorite = Favorite(**favorite_data.model_dump())
        self.db.add(favorite)
        await self.db.commit()
        await self.db.refresh(favorite)
        return favorite

    async def remove_favorite(self, user_id: str, entity_id: str) -> bool:
        result = await self.db.execute(
            select(Favorite).where(
                and_(
                    Favorite.user_id == user_id,
                    Favorite.entity_id == entity_id,
                )
            )
        )
        favorite = result.scalar_one_or_none()
        if not favorite:
            return False

        await self.db.delete(favorite)
        await self.db.commit()
        return True

    async def get_user_favorites(self, user_id: str) -> List[Favorite]:
        result = await self.db.execute(
            select(Favorite).where(Favorite.user_id == user_id)
        )
        return list(result.scalars().all())

    async def check_favorite(self, user_id: str, entity_id: str) -> bool:
        result = await self.db.execute(
            select(Favorite).where(
                and_(
                    Favorite.user_id == user_id,
                    Favorite.entity_id == entity_id,
                )
            )
        )
        return result.scalar_one_or_none() is not None

    async def add_feedback(self, feedback_data: FeedbackCreate) -> Feedback:
        feedback = Feedback(**feedback_data.model_dump())
        self.db.add(feedback)
        await self.db.commit()
        await self.db.refresh(feedback)
        return feedback

    async def get_entity_feedbacks(self, entity_id: str) -> List[Feedback]:
        result = await self.db.execute(
            select(Feedback).where(Feedback.entity_id == entity_id)
        )
        return list(result.scalars().all())

    async def get_user_feedbacks(self, user_id: str) -> List[Feedback]:
        result = await self.db.execute(
            select(Feedback).where(Feedback.user_id == user_id)
        )
        return list(result.scalars().all())

    async def get_relationship(
        self, relationship_id: str
    ) -> Optional[Relationship]:
        result = await self.db.execute(
            select(Relationship).where(Relationship.id == relationship_id)
        )
        return result.scalar_one_or_none()

    async def update_relationship(
        self, relationship_id: str, update_data: RelationshipUpdate
    ) -> Optional[Relationship]:
        relationship = await self.get_relationship(relationship_id)
        if not relationship:
            return None

        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(relationship, key, value)

        await self.db.commit()
        await self.db.refresh(relationship)
        return relationship

    async def delete_relationship(
        self, relationship_id: str
    ) -> bool:
        relationship = await self.get_relationship(relationship_id)
        if not relationship:
            return False

        await self.db.delete(relationship)
        await self.db.commit()
        return True

    async def export_data(self, export_request: ExportRequest) -> Dict[str, Any]:
        result = {
            "format": export_request.format,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if export_request.include_entities:
            entities_result = await self.db.execute(select(Entity))
            entities = entities_result.scalars().all()
            result["entities"] = [
                {
                    "id": e.id,
                    "name": e.name,
                    "type": e.type,
                    "description": e.description,
                    "region": e.region,
                    "period": e.period,
                    "coordinates": e.coordinates,
                    "metadata": e.meta_data,
                    "importance": e.importance,
                }
                for e in entities
            ]

        if export_request.include_relationships:
            relationships_result = await self.db.execute(select(Relationship))
            relationships = relationships_result.scalars().all()
            result["relationships"] = [
                {
                    "id": r.id,
                    "source_id": r.source_id,
                    "target_id": r.target_id,
                    "relation_type": r.relation_type,
                    "weight": r.weight,
                    "metadata": r.meta_data,
                }
                for r in relationships
            ]

        return result

    async def import_data(self, import_request: ImportRequest) -> Dict[str, Any]:
        data = import_request.data
        result = {
            "entities_imported": 0,
            "relationships_imported": 0,
            "errors": [],
        }

        if "entities" in data:
            for entity_data in data["entities"]:
                try:
                    entity = Entity(**entity_data)
                    self.db.add(entity)
                    result["entities_imported"] += 1
                except Exception as e:
                    result["errors"].append(f"实体导入失败: {entity_data.get('name', 'unknown')}, 错误: {str(e)}")

        if "relationships" in data:
            for rel_data in data["relationships"]:
                try:
                    relationship = Relationship(**rel_data)
                    self.db.add(relationship)
                    result["relationships_imported"] += 1
                except Exception as e:
                    result["errors"].append(f"关系导入失败: {rel_data.get('id', 'unknown')}, 错误: {str(e)}")

        await self.db.commit()
        return result

    async def batch_create_entities(
        self, entities_data: List[EntityCreate]
    ) -> Dict[str, Any]:
        """批量创建实体"""
        result = {
            "success_count": 0,
            "failed_count": 0,
            "results": [],
            "errors": [],
        }

        for idx, entity_data in enumerate(entities_data):
            try:
                entity = Entity(**entity_data.model_dump())
                self.db.add(entity)
                await self.db.flush()
                await self.db.refresh(entity)
                
                result["success_count"] += 1
                result["results"].append({
                    "index": idx,
                    "id": entity.id,
                    "name": entity.name,
                    "status": "success",
                })
            except Exception as e:
                result["failed_count"] += 1
                result["errors"].append({
                    "index": idx,
                    "name": entity_data.name,
                    "error": str(e),
                    "status": "failed",
                })

        await self.db.commit()
        return result

    async def batch_update_entities(
        self, updates: Dict[str, EntityUpdate]
    ) -> Dict[str, Any]:
        """批量更新实体"""
        result = {
            "success_count": 0,
            "failed_count": 0,
            "results": [],
            "errors": [],
        }

        for entity_id, update_data in updates.items():
            try:
                entity = await self.get_entity(entity_id)
                if not entity:
                    result["failed_count"] += 1
                    result["errors"].append({
                        "entity_id": entity_id,
                        "error": "实体不存在",
                        "status": "failed",
                    })
                    continue

                update_dict = update_data.model_dump(exclude_unset=True)
                for key, value in update_dict.items():
                    setattr(entity, key, value)

                await self.db.flush()
                await self.db.refresh(entity)
                
                result["success_count"] += 1
                result["results"].append({
                    "entity_id": entity_id,
                    "name": entity.name,
                    "status": "success",
                })
            except Exception as e:
                result["failed_count"] += 1
                result["errors"].append({
                    "entity_id": entity_id,
                    "error": str(e),
                    "status": "failed",
                })

        await self.db.commit()
        return result

    async def batch_create_relationships(
        self, relationships_data: List[RelationshipCreate]
    ) -> Dict[str, Any]:
        """批量创建关系"""
        result = {
            "success_count": 0,
            "failed_count": 0,
            "results": [],
            "errors": [],
        }

        for idx, rel_data in enumerate(relationships_data):
            try:
                source_entity = await self.get_entity(rel_data.source_id)
                target_entity = await self.get_entity(rel_data.target_id)
                
                if not source_entity or not target_entity:
                    result["failed_count"] += 1
                    result["errors"].append({
                        "index": idx,
                        "error": "源实体或目标实体不存在",
                        "status": "failed",
                    })
                    continue

                relationship = Relationship(**rel_data.model_dump())
                self.db.add(relationship)
                await self.db.flush()
                await self.db.refresh(relationship)
                
                result["success_count"] += 1
                result["results"].append({
                    "index": idx,
                    "id": relationship.id,
                    "status": "success",
                })
            except Exception as e:
                result["failed_count"] += 1
                result["errors"].append({
                    "index": idx,
                    "error": str(e),
                    "status": "failed",
                })

        await self.db.commit()
        return result

    async def semantic_search(
        self,
        query: str,
        entity_types: Optional[List[str]] = None,
        regions: Optional[List[str]] = None,
        periods: Optional[List[str]] = None,
        top_k: int = 20,
    ) -> List[Entity]:
        """语义搜索实体（支持别名搜索）"""
        search_query = f"%{query}%"
        
        base_query = select(Entity).where(
            or_(
                Entity.name.ilike(search_query),
                Entity.description.ilike(search_query),
            )
        )
        
        conditions = []
        
        if entity_types:
            conditions.append(Entity.type.in_(entity_types))
        if regions:
            conditions.append(Entity.region.in_(regions))
        if periods:
            conditions.append(Entity.period.in_(periods))
        
        if conditions:
            base_query = base_query.where(and_(*conditions))
        
        base_query = base_query.order_by(Entity.importance.desc()).limit(top_k)
        
        result = await self.db.execute(base_query)
        return list(result.scalars().all())

    async def add_entity_alias(self, entity_id: str, alias_name: str, alias_type: str = "synonym") -> EntityAlias:
        """添加实体别名"""
        entity = await self.get_entity(entity_id)
        if not entity:
            raise ValueError("实体不存在")

        existing = await self.db.execute(
            select(EntityAlias).where(
                and_(
                    EntityAlias.entity_id == entity_id,
                    EntityAlias.alias_name == alias_name,
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("该别名已存在")

        alias = EntityAlias(
            entity_id=entity_id,
            alias_name=alias_name,
            alias_type=alias_type,
        )
        self.db.add(alias)
        await self.db.commit()
        await self.db.refresh(alias)
        return alias

    async def get_entity_aliases(self, entity_id: str) -> List[EntityAlias]:
        """获取实体的所有别名"""
        result = await self.db.execute(
            select(EntityAlias).where(EntityAlias.entity_id == entity_id)
        )
        return list(result.scalars().all())

    async def delete_entity_alias(self, alias_id: str) -> bool:
        """删除实体别名"""
        result = await self.db.execute(
            select(EntityAlias).where(EntityAlias.id == alias_id)
        )
        alias = result.scalar_one_or_none()
        if not alias:
            return False

        await self.db.delete(alias)
        await self.db.commit()
        return True

    async def search_entities_with_alias(
        self, search_request: SearchRequest
    ) -> tuple[List[Entity], int]:
        """支持别名搜索的实体搜索"""
        query = select(Entity)

        conditions = []

        if search_request.keyword:
            keyword = f"%{search_request.keyword}%"
            conditions.append(
                or_(
                    Entity.name.ilike(keyword),
                    Entity.description.ilike(keyword),
                )
            )

            if search_request.fuzzy:
                alias_subquery = (
                    select(EntityAlias.entity_id)
                    .where(EntityAlias.alias_name.ilike(keyword))
                    .subquery()
                )
                conditions.append(Entity.id.in_(select(alias_subquery)))

        if search_request.category and search_request.category != "all":
            conditions.append(Entity.type == search_request.category)

        if search_request.region:
            conditions.append(Entity.region.in_(search_request.region))

        if search_request.period:
            conditions.append(Entity.period.in_(search_request.period))

        if conditions:
            query = query.where(or_(*conditions))

        total_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(total_query)
        total = total_result.scalar()

        if search_request.sort_by == "name":
            query = query.order_by(Entity.name)
        elif search_request.sort_by == "date":
            query = query.order_by(Entity.created_at.desc())
        else:
            query = query.order_by(Entity.importance.desc())

        query = query.offset(
            (search_request.page - 1) * search_request.page_size
        ).limit(search_request.page_size)

        result = await self.db.execute(query)
        entities = result.scalars().all()

        return list(entities), total
