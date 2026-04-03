from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from app.core.database import get_db
from app.services.knowledge_service import KnowledgeService
from app.schemas.knowledge import (
    Entity,
    EntityCreate,
    EntityUpdate,
    RelationshipCreate,
    RelationshipUpdate,
    Relationship,
    GraphData,
    GraphNode,
    GraphEdge,
    SearchRequest,
    SearchResponse,
    AdvancedSearchRequest,
    EntityDetailResponse,
    PathRequest,
    PathResponse,
    StatsResponse,
    FavoriteCreate,
    Favorite,
    FeedbackCreate,
    Feedback,
    ExportRequest,
    ImportRequest,
)

router = APIRouter(prefix="/api/v1/knowledge", tags=["knowledge"])


@router.post("/entity", response_model=Entity, summary="创建实体")
async def create_entity(
    entity_data: EntityCreate,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    entity = await service.create_entity(entity_data)
    return entity


@router.get("/entity/{entity_id}", response_model=Entity, summary="获取实体详情")
async def get_entity(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    entity = await service.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="实体不存在")
    return entity


@router.put("/entity/{entity_id}", response_model=Entity, summary="更新实体")
async def update_entity(
    entity_id: str,
    update_data: EntityUpdate,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    entity = await service.update_entity(entity_id, update_data)
    if not entity:
        raise HTTPException(status_code=404, detail="实体不存在")
    return entity


@router.delete("/entity/{entity_id}", summary="删除实体")
async def delete_entity(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    success = await service.delete_entity(entity_id)
    if not success:
        raise HTTPException(status_code=404, detail="实体不存在")
    return {"message": "删除成功"}


@router.post("/search", response_model=SearchResponse, summary="搜索实体")
async def search_entities(
    search_request: SearchRequest,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    entities, total = await service.search_entities(search_request)

    total_pages = (total + search_request.page_size - 1) // search_request.page_size

    return SearchResponse(
        results=entities,
        total=total,
        page=search_request.page,
        page_size=search_request.page_size,
        total_pages=total_pages,
    )


@router.post("/search/advanced", response_model=SearchResponse, summary="高级搜索实体")
async def advanced_search_entities(
    search_request: AdvancedSearchRequest,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    entities, total = await service.advanced_search_entities(search_request)

    total_pages = (total + search_request.page_size - 1) // search_request.page_size

    return SearchResponse(
        results=entities,
        total=total,
        page=search_request.page,
        page_size=search_request.page_size,
        total_pages=total_pages,
    )


@router.get(
    "/entity/{entity_id}/detail",
    response_model=EntityDetailResponse,
    summary="获取实体详情及关联关系",
)
async def get_entity_detail(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    entity = await service.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="实体不存在")

    relationships = await service.get_entity_relationships(entity_id)
    related_entities = await service.get_related_entities(entity_id)

    return EntityDetailResponse(
        entity=entity,
        relationships=relationships,
        related_entities=related_entities,
    )


@router.get(
    "/entity/{entity_id}/relations",
    response_model=List[Relationship],
    summary="获取实体的所有关系",
)
async def get_entity_relations(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    relationships = await service.get_entity_relationships(entity_id)
    return relationships


@router.post("/relationship", response_model=Relationship, summary="创建关系")
async def create_relationship(
    relationship_data: RelationshipCreate,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    relationship = await service.create_relationship(relationship_data)
    return relationship


@router.get("/relationship/{relationship_id}", response_model=Relationship, summary="获取关系详情")
async def get_relationship(
    relationship_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    relationship = await service.get_relationship(relationship_id)
    if not relationship:
        raise HTTPException(status_code=404, detail="关系不存在")
    return relationship


@router.put("/relationship/{relationship_id}", response_model=Relationship, summary="更新关系")
async def update_relationship(
    relationship_id: str,
    update_data: RelationshipUpdate,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    relationship = await service.update_relationship(relationship_id, update_data)
    if not relationship:
        raise HTTPException(status_code=404, detail="关系不存在")
    return relationship


@router.delete("/relationship/{relationship_id}", summary="删除关系")
async def delete_relationship(
    relationship_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    success = await service.delete_relationship(relationship_id)
    if not success:
        raise HTTPException(status_code=404, detail="关系不存在")
    return {"success": True}


@router.get("/graph", response_model=GraphData, summary="获取图谱数据")
async def get_graph_data(
    center_entity_id: Optional[str] = Query(None, description="中心实体ID"),
    max_depth: int = Query(2, ge=1, le=3, description="最大深度"),
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    
    if center_entity_id:
        center_entity = await service.get_entity(center_entity_id)
        if not center_entity:
            raise HTTPException(status_code=404, detail="中心实体不存在")
    
    entities, relationships = await service.get_graph_data(
        center_entity_id, max_depth
    )

    categories = [
        {"name": "传承人", "itemStyle": {"color": "#8B5CF6"}},
        {"name": "技艺", "itemStyle": {"color": "#10B981"}},
        {"name": "作品", "itemStyle": {"color": "#F59E0B"}},
        {"name": "纹样", "itemStyle": {"color": "#EF4444"}},
        {"name": "地域", "itemStyle": {"color": "#06B6D4"}},
        {"name": "时期", "itemStyle": {"color": "#6366F1"}},
        {"name": "材料", "itemStyle": {"color": "#84CC16"}},
    ]

    category_map = {
        "inheritor": "传承人",
        "technique": "技艺",
        "work": "作品",
        "pattern": "纹样",
        "region": "地域",
        "period": "时期",
        "material": "材料",
    }

    nodes = []
    for entity in entities:
        category_name = category_map.get(entity.type, entity.type)
        symbol_size = int(20 + entity.importance * 30)

        nodes.append(
            GraphNode(
                id=entity.id,
                name=entity.name,
                category=category_name,
                symbolSize=symbol_size,
                value=entity.importance,
                itemStyle={
                    "color": next(
                        (
                            c["itemStyle"]["color"]
                            for c in categories
                            if c["name"] == category_name
                        ),
                        "#3B82F6",
                    )
                },
            )
        )

    edges = []
    for rel in relationships:
        edges.append(
            GraphEdge(
                source=rel.source_id,
                target=rel.target_id,
                relationType=rel.relation_type,
                lineStyle={
                    "width": 2 * rel.weight,
                    "curveness": 0.3,
                    "opacity": 0.6,
                },
            )
        )

    return GraphData(nodes=nodes, edges=edges, categories=categories)


@router.post("/path", response_model=PathResponse, summary="查找实体间路径")
async def find_path(
    path_request: PathRequest,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)

    source_entity = await service.get_entity(path_request.source_id)
    target_entity = await service.get_entity(path_request.target_id)

    if not source_entity or not target_entity:
        raise HTTPException(status_code=404, detail="实体不存在")

    paths = await service.find_path(
        path_request.source_id,
        path_request.target_id,
        path_request.max_depth,
    )

    entity_ids = set()
    for path in paths:
        entity_ids.update(path)

    entities = []
    if entity_ids:
        from sqlalchemy import select
        from app.models.knowledge import Entity

        result = await db.execute(
            select(Entity).where(Entity.id.in_(entity_ids))
        )
        entities = list(result.scalars().all())

    return PathResponse(paths=paths, entities=entities)


@router.get("/stats", response_model=StatsResponse, summary="获取图谱统计数据")
async def get_statistics(
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    stats = await service.get_statistics()
    return StatsResponse(**stats)


@router.get("/categories", summary="获取实体类型列表")
async def get_categories():
    categories = [
        {"value": "inheritor", "label": "传承人", "color": "#8B5CF6"},
        {"value": "technique", "label": "技艺", "color": "#10B981"},
        {"value": "work", "label": "作品", "color": "#F59E0B"},
        {"value": "pattern", "label": "纹样", "color": "#EF4444"},
        {"value": "region", "label": "地域", "color": "#06B6D4"},
        {"value": "period", "label": "时期", "color": "#6366F1"},
        {"value": "material", "label": "材料", "color": "#84CC16"},
    ]
    return categories


@router.get("/regions", summary="获取地域列表")
async def get_regions(
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, distinct
    from app.models.knowledge import Entity

    result = await db.execute(
        select(distinct(Entity.region))
        .where(Entity.region.isnot(None))
        .order_by(Entity.region)
    )
    regions = [row[0] for row in result.all() if row[0]]
    return regions


@router.get("/periods", summary="获取时期列表")
async def get_periods(
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, distinct
    from app.models.knowledge import Entity

    result = await db.execute(
        select(distinct(Entity.period))
        .where(Entity.period.isnot(None))
        .order_by(Entity.period)
    )
    periods = [row[0] for row in result.all() if row[0]]
    return periods


@router.post("/favorite", response_model=Favorite, summary="添加收藏")
async def add_favorite(
    favorite_data: FavoriteCreate,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    try:
        favorite = await service.add_favorite(favorite_data)
        return favorite
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/favorite", summary="取消收藏")
async def remove_favorite(
    user_id: str = Query(..., description="用户ID"),
    entity_id: str = Query(..., description="实体ID"),
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    success = await service.remove_favorite(user_id, entity_id)
    if not success:
        raise HTTPException(status_code=404, detail="收藏不存在")
    return {"success": True}


@router.get("/favorite/{user_id}", response_model=List[Favorite], summary="获取用户收藏列表")
async def get_user_favorites(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    favorites = await service.get_user_favorites(user_id)
    return favorites


@router.get("/favorite/check", summary="检查是否已收藏")
async def check_favorite(
    user_id: str = Query(..., description="用户ID"),
    entity_id: str = Query(..., description="实体ID"),
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    is_favorite = await service.check_favorite(user_id, entity_id)
    return {"is_favorite": is_favorite}


@router.post("/feedback", response_model=Feedback, summary="提交反馈")
async def add_feedback(
    feedback_data: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    feedback = await service.add_feedback(feedback_data)
    return feedback


@router.get("/feedback/entity/{entity_id}", response_model=List[Feedback], summary="获取实体的反馈列表")
async def get_entity_feedbacks(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    feedbacks = await service.get_entity_feedbacks(entity_id)
    return feedbacks


@router.get("/feedback/user/{user_id}", response_model=List[Feedback], summary="获取用户的反馈列表")
async def get_user_feedbacks(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    feedbacks = await service.get_user_feedbacks(user_id)
    return feedbacks


@router.get("/analysis/connectivity", summary="分析图谱连通性")
async def analyze_graph_connectivity(
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    connectivity = await service.analyze_graph_connectivity()
    return connectivity


@router.get("/analysis/centrality/{entity_id}", summary="分析实体中心性")
async def analyze_entity_centrality(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    entity = await service.get_entity(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="实体不存在")
    
    centrality = await service.analyze_entity_centrality(entity_id)
    return centrality


@router.get("/analysis/community", summary="分析社区结构")
async def analyze_community_structure(
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    community = await service.analyze_community_structure()
    return community


@router.post("/export", summary="导出图谱数据")
async def export_data(
    export_request: ExportRequest,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    data = await service.export_data(export_request)
    return data


@router.post("/import", summary="导入图谱数据")
async def import_data(
    import_request: ImportRequest,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    result = await service.import_data(import_request)
    return result
