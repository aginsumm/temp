from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
import uuid
import json
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.auth import get_current_user
from app.schemas.chat import Entity, Relation, GraphData, GraphNode, GraphEdge
from app.services.graph_service import GraphSnapshotService
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
    user_id: str = Depends(get_current_user),
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
    user_id: str = Depends(get_current_user),
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
        share_url = f"/shared/graph/{snapshot.share_token}"
    
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
    user_id: str = Depends(get_current_user),
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
            share_url = f"/shared/graph/{snapshot.share_token}"
        
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
    user_id: str = Depends(get_current_user),
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
    user_id: str = Depends(get_current_user),
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
        share_url = f"/shared/graph/{snapshot.share_token}"
    
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
    user_id: str = Depends(get_current_user),
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
        share_url = f"{request.url.scheme}://{request.url.netloc}/shared/graph/{share.share_token}"
    else:
        share_url = f"/shared/graph/{share.share_token}"
    
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
    user_id: str = Depends(get_current_user),
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
    
    share_url = f"/shared/graph/{share_token}"
    
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
    user_id: str = Depends(get_current_user),
):
    from app.services.chat_service import MessageService
    
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
            all_keywords.extend(msg.keywords)
    
    seen_entity_names = set()
    unique_entities = []
    for e in all_entities:
        if e.name not in seen_entity_names:
            seen_entity_names.add(e.name)
            unique_entities.append(e)
    
    unique_keywords = list(dict.fromkeys(all_keywords))
    
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
    for relation in all_relations:
        if relation.source in node_ids and relation.target in node_ids:
            edge = GraphEdge(
                source=relation.source,
                target=relation.target,
                value=relation.confidence or 0.5,
            )
            edges.append(edge)
    
    return {
        "nodes": [n.model_dump() for n in nodes],
        "edges": [e.model_dump() for e in edges],
        "entities": [e.model_dump() for e in unique_entities],
        "keywords": unique_keywords[:20],
    }
