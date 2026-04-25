from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct
from typing import Optional, List
import uuid
import json
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.auth import get_current_user, get_current_or_guest
from app.schemas.chat import Entity, Relation, RelationType, GraphData, GraphNode, GraphEdge
from app.services.graph_service import GraphSnapshotService
from app.models.chat import MessageEntity, Message, MessageRelation
from pydantic import BaseModel


router = APIRouter(prefix="/api/v1", tags=["graph"])


class CreateSnapshotRequest(BaseModel):
    session_id: str
    message_id: str
    graph_data: GraphData
    keywords: list[str] = []
    entities: list[Entity] = []
    relations: list[Relation] = []
    title: Optional[str] = None
    description: Optional[str] = None


class SnapshotResponse(BaseModel):
    id: str
    session_id: str
    message_id: str
    graph_data: GraphData
    keywords: list[str]
    entities: list[Entity]
    relations: list[Relation]
    created_at: str
    title: Optional[str] = None
    description: Optional[str] = None
    is_shared: bool = False
    share_url: Optional[str] = None
    node_count: int = 0
    edge_count: int = 0

    class Config:
        from_attributes = True


class SnapshotListResponse(BaseModel):
    snapshots: list[SnapshotResponse]
    total: int
    page: int
    page_size: int


@router.post("/graph/snapshot", response_model=SnapshotResponse)
async def create_snapshot(
    request: CreateSnapshotRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_or_guest),
):
    snapshot_service = GraphSnapshotService(db)
    
    snapshot = await snapshot_service.create_snapshot(
        user_id=user_id,
        session_id=request.session_id,
        message_id=request.message_id,
        graph_data=request.graph_data,
        entities=request.entities,
        relations=request.relations,
        keywords=request.keywords,
        title=request.title,
        description=request.description,
    )
    
    return SnapshotResponse(
        id=snapshot.id,
        session_id=snapshot.session_id,
        message_id=snapshot.message_id,
        graph_data=snapshot.graph_data,
        keywords=snapshot.keywords or [],
        entities=snapshot.entities or [],
        relations=snapshot.relations or [],
        created_at=snapshot.created_at.isoformat(),
        title=snapshot.title,
        description=snapshot.description,
        is_shared=snapshot.is_shared,
        node_count=snapshot.node_count,
        edge_count=snapshot.edge_count,
    )


@router.get("/graph/snapshot/{snapshot_id}", response_model=SnapshotResponse)
async def get_snapshot(
    snapshot_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_or_guest),
):
    snapshot_service = GraphSnapshotService(db)
    snapshot = await snapshot_service.get_snapshot(snapshot_id)
    
    if not snapshot:
        raise HTTPException(status_code=404, detail="快照不存在")
    
    # 检查权限
    if snapshot.user_id != user_id and not snapshot.is_shared:
        raise HTTPException(status_code=403, detail="无权访问该快照")
    
    share_url = None
    if snapshot.is_shared and snapshot.share_token:
        share_url = f"/api/v1/shared/graph/{snapshot.share_token}"
    
    return SnapshotResponse(
        id=snapshot.id,
        session_id=snapshot.session_id,
        message_id=snapshot.message_id,
        graph_data=snapshot.graph_data,
        keywords=snapshot.keywords or [],
        entities=snapshot.entities or [],
        relations=snapshot.relations or [],
        created_at=snapshot.created_at.isoformat(),
        title=snapshot.title,
        description=snapshot.description,
        is_shared=snapshot.is_shared,
        share_url=share_url,
        node_count=snapshot.node_count,
        edge_count=snapshot.edge_count,
    )


@router.get("/graph/snapshots", response_model=SnapshotListResponse)
async def list_snapshots(
    session_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_or_guest),
):
    snapshot_service = GraphSnapshotService(db)
    snapshots, total = await snapshot_service.get_user_snapshots(
        user_id=user_id,
        session_id=session_id,
        page=page,
        page_size=page_size,
    )
    
    response_snapshots = []
    for snapshot in snapshots:
        share_url = None
        if snapshot.is_shared and snapshot.share_token:
            share_url = f"/api/v1/shared/graph/{snapshot.share_token}"
        
        response_snapshots.append(
            SnapshotResponse(
                id=snapshot.id,
                session_id=snapshot.session_id,
                message_id=snapshot.message_id,
                graph_data=snapshot.graph_data,
                keywords=snapshot.keywords or [],
                entities=snapshot.entities or [],
                relations=snapshot.relations or [],
                created_at=snapshot.created_at.isoformat(),
                title=snapshot.title,
                description=snapshot.description,
                is_shared=snapshot.is_shared,
                share_url=share_url,
                node_count=snapshot.node_count,
                edge_count=snapshot.edge_count,
            )
        )
    
    return SnapshotListResponse(
        snapshots=response_snapshots,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.delete("/graph/snapshot/{snapshot_id}")
async def delete_snapshot(
    snapshot_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_or_guest),
):
    snapshot_service = GraphSnapshotService(db)
    success = await snapshot_service.delete_snapshot(snapshot_id, user_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="快照不存在")
    
    return {"success": True}


class SnapshotUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


@router.patch("/graph/snapshot/{snapshot_id}", response_model=SnapshotResponse)
async def update_snapshot(
    snapshot_id: str,
    updates: SnapshotUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_or_guest),
):
    snapshot_service = GraphSnapshotService(db)
    snapshot = await snapshot_service.update_snapshot(
        snapshot_id, 
        user_id, 
        **updates.model_dump(exclude_unset=True)
    )
    
    if not snapshot:
        raise HTTPException(status_code=404, detail="快照不存在或无权限")
    
    share_url = None
    if snapshot.is_shared and snapshot.share_token:
        share_url = f"/api/v1/shared/graph/{snapshot.share_token}"
    
    return SnapshotResponse(
        id=snapshot.id,
        session_id=snapshot.session_id,
        message_id=snapshot.message_id,
        graph_data=snapshot.graph_data,
        keywords=snapshot.keywords or [],
        entities=snapshot.entities or [],
        relations=snapshot.relations or [],
        created_at=snapshot.created_at.isoformat(),
        title=snapshot.title,
        description=snapshot.description,
        is_shared=snapshot.is_shared,
        share_url=share_url,
        node_count=snapshot.node_count,
        edge_count=snapshot.edge_count,
    )


@router.post("/graph/snapshot/{snapshot_id}/share", response_model=SnapshotResponse)
async def share_snapshot(
    snapshot_id: str,
    expires_days: Optional[int] = Query(7, ge=1, le=365),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_or_guest),
):
    snapshot_service = GraphSnapshotService(db)
    share = await snapshot_service.share_snapshot(
        snapshot_id=snapshot_id,
        user_id=user_id,
        expires_days=expires_days,
    )
    
    if not share:
        raise HTTPException(status_code=404, detail="快照不存在")
    
    # 获取更新后的快照
    snapshot = await snapshot_service.get_snapshot(snapshot_id)
    
    # 生成完整 URL
    if request:
        share_url = f"{request.url.scheme}://{request.url.netloc}/api/v1/shared/graph/{share.share_token}"
    else:
        share_url = f"/api/v1/shared/graph/{share.share_token}"
    
    return SnapshotResponse(
        id=snapshot.id,
        session_id=snapshot.session_id,
        message_id=snapshot.message_id,
        graph_data=snapshot.graph_data,
        keywords=snapshot.keywords or [],
        entities=snapshot.entities or [],
        relations=snapshot.relations or [],
        created_at=snapshot.created_at.isoformat(),
        title=snapshot.title,
        description=snapshot.description,
        is_shared=snapshot.is_shared,
        share_url=share_url,
        node_count=snapshot.node_count,
        edge_count=snapshot.edge_count,
    )


@router.post("/graph/snapshot/{snapshot_id}/unshare")
async def unshare_snapshot(
    snapshot_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_or_guest),
):
    snapshot_service = GraphSnapshotService(db)
    success = await snapshot_service.cancel_share(snapshot_id, user_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="快照不存在")
    
    return {"success": True}


@router.get("/shared/graph/{share_token}")
async def get_shared_snapshot(
    share_token: str,
    db: AsyncSession = Depends(get_db),
):
    snapshot_service = GraphSnapshotService(db)
    snapshot = await snapshot_service.get_shared_snapshot(share_token)
    
    if not snapshot:
        raise HTTPException(status_code=404, detail="分享已过期或不存在")
    
    share_url = f"/api/v1/shared/graph/{share_token}"
    
    return SnapshotResponse(
        id=snapshot.id,
        session_id=snapshot.session_id,
        message_id=snapshot.message_id,
        graph_data=snapshot.graph_data,
        keywords=snapshot.keywords or [],
        entities=snapshot.entities or [],
        relations=snapshot.relations or [],
        created_at=snapshot.created_at.isoformat(),
        title=snapshot.title,
        description=snapshot.description,
        is_shared=snapshot.is_shared,
        share_url=share_url,
        node_count=snapshot.node_count,
        edge_count=snapshot.edge_count,
    )


@router.get("/graph/session/{session_id}/data")
async def get_session_graph_data(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_or_guest),
):
    from app.services.chat_service import MessageService
    from app.services.chat_service import SessionService
    
    session_service = SessionService(db)
    session = await session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="无权访问该会话图谱")

    message_service = MessageService(db)
    messages, total, _ = await message_service.get_session_messages(session_id, 1, 100)
    
    all_entities: list[Entity] = []
    all_relations: list[Relation] = []
    all_keywords: list[str] = []
    
    for msg in messages:
        if msg.entities:
            for e in msg.entities:
                entity = Entity(
                    id=e.id,
                    name=e.name,
                    type=e.type,
                    description=e.description,
                    relevance=e.relevance,
                )
                all_entities.append(entity)
        
        if msg.keywords:
            if isinstance(msg.keywords, str):
                try:
                    all_keywords.extend(json.loads(msg.keywords))
                except json.JSONDecodeError:
                    pass
            elif isinstance(msg.keywords, list):
                all_keywords.extend(msg.keywords)

        if msg.relations:
            for rel in msg.relations:
                raw_type = rel.relation_type if hasattr(rel, "relation_type") else None
                try:
                    relation_type = (
                        RelationType(raw_type)
                        if raw_type
                        else RelationType.related_to
                    )
                except ValueError:
                    relation_type = RelationType.related_to

                all_relations.append(
                    Relation(
                        id=rel.id,
                        source=rel.source_entity,
                        target=rel.target_entity,
                        type=relation_type,
                        confidence=(rel.confidence or 80) / 100.0,
                        evidence=rel.evidence,
                        bidirectional=bool(rel.bidirectional),
                    )
                )
    
    seen_entity_ids = set()
    unique_entities = []
    for e in all_entities:
        if e.id not in seen_entity_ids:
            seen_entity_ids.add(e.id)
            unique_entities.append(e)
    
    unique_keywords = [kw for kw in dict.fromkeys(all_keywords) if isinstance(kw, str)]
    
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    
    for entity in unique_entities[:50]:
        node = GraphNode(
            id=entity.id,
            name=entity.name,
            category=entity.type.value,
            value=entity.relevance or 0.5,
            symbolSize=max(20, min(50, (entity.relevance or 0.5) * 50)),
        )
        nodes.append(node)
    
    node_ids = {n.id for n in nodes}
    entity_name_to_id = {entity.name: entity.id for entity in unique_entities}
    edge_keys = set()
    for relation in all_relations:
        source_id = relation.source if relation.source in node_ids else entity_name_to_id.get(relation.source)
        target_id = relation.target if relation.target in node_ids else entity_name_to_id.get(relation.target)

        if source_id in node_ids and target_id in node_ids:
            edge_key = (source_id, target_id, relation.type.value)
            if edge_key in edge_keys:
                continue
            edge_keys.add(edge_key)
            edge = GraphEdge(
                id=relation.id,
                source=source_id,
                target=target_id,
                relationType=relation.type,
                value=relation.confidence or 0.5,
            )
            edges.append(edge)
    
    return {
        "nodes": [n.model_dump() for n in nodes],
        "edges": [e.model_dump() for e in edges],
        "entities": [e.model_dump() for e in unique_entities],
        "keywords": unique_keywords[:20],
    }


@router.get("/graph/stats")
async def get_graph_stats(
    session_id: Optional[str] = Query(None, description="会话 ID，如果提供则只统计该会话的数据"),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """获取图谱统计信息"""
    # 基础查询
    entity_query = select(func.count(MessageEntity.id))
    relation_query = select(func.count(MessageRelation.id))
    
    if session_id:
        # 获取会话的消息 ID 列表
        message_ids_result = await db.execute(
            select(Message.id).where(Message.session_id == session_id)
        )
        message_ids = [row[0] for row in message_ids_result.all()]
        
        if message_ids:
            entity_query = entity_query.where(MessageEntity.message_id.in_(message_ids))
            relation_query = relation_query.where(MessageRelation.message_id.in_(message_ids))
        else:
            # 会话没有消息
            return {
                "total_entities": 0,
                "total_relations": 0,
                "entities_by_type": {},
                "relations_by_type": {},
            }
    
    # 执行统计查询
    total_entities_result = await db.execute(entity_query)
    total_entities = total_entities_result.scalar() or 0
    
    total_relations_result = await db.execute(relation_query)
    total_relations = total_relations_result.scalar() or 0
    
    # 按类型统计实体
    type_query = select(MessageEntity.type, func.count(MessageEntity.id)).group_by(MessageEntity.type)
    if session_id and message_ids:
        type_query = type_query.where(MessageEntity.message_id.in_(message_ids))
    
    type_result = await db.execute(type_query)
    entities_by_type = {row[0]: row[1] for row in type_result.all()}
    
    # 按类型统计关系
    rel_type_query = select(MessageRelation.relation_type, func.count(MessageRelation.id)).group_by(MessageRelation.relation_type)
    if session_id and message_ids:
        rel_type_query = rel_type_query.where(MessageRelation.message_id.in_(message_ids))
    
    rel_type_result = await db.execute(rel_type_query)
    relations_by_type = {row[0]: row[1] for row in rel_type_result.all()}
    
    return {
        "total_entities": total_entities,
        "total_relations": total_relations,
        "entities_by_type": entities_by_type,
        "relations_by_type": relations_by_type,
    }
