from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from pydantic import BaseModel
from app.core.auth import get_current_user

from app.core.database import get_db
from app.core.constants import (
    CATEGORY_CONFIG,
    CATEGORY_COLORS,
    CATEGORY_LABELS,
    get_category_color,
    get_category_label,
    get_graph_categories,
)
from app.services.knowledge_service import KnowledgeService
from app.services.llm_service import llm_service
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


class LLMSearchRequest(BaseModel):
    query: str
    search_type: str = "hybrid"
    entity_types: Optional[list[str]] = None
    regions: Optional[list[str]] = None
    periods: Optional[list[str]] = None
    top_k: int = 20
    include_explanation: bool = False


class LLMSearchResponse(BaseModel):
    results: list[Entity]
    search_time_ms: int
    explanation: Optional[str] = None

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

    categories = get_graph_categories()

    nodes = []
    for entity in entities:
        category_name = get_category_label(entity.type)
        symbol_size = int(20 + entity.importance * 30)

        nodes.append(
            GraphNode(
                id=entity.id,
                name=entity.name,
                category=category_name,
                symbolSize=symbol_size,
                value=entity.importance,
                itemStyle={"color": get_category_color(entity.type)},
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


@router.post("/llm-search", response_model=LLMSearchResponse, summary="LLM 智能搜索")
async def llm_intelligent_search(
    request: LLMSearchRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    """
    使用 LLM 进行智能搜索，支持自然语言理解和语义搜索
    """
    import time
    start_time = time.time()
    
    service = KnowledgeService(db)
    
    try:
        # 使用 LLM 解析查询意图
        query_analysis = await llm_service.analyze_query(request.query)
        
        # 根据分析结果进行搜索
        entities = await service.semantic_search(
            query=request.query,
            entity_types=request.entity_types or query_analysis.get("entity_types"),
            regions=request.regions or query_analysis.get("regions"),
            periods=request.periods or query_analysis.get("periods"),
            top_k=request.top_k,
        )
        
        search_time_ms = int((time.time() - start_time) * 1000)
        
        explanation = None
        if request.include_explanation:
            explanation = f"搜索到 {len(entities)} 个相关实体，耗时 {search_time_ms}ms"
        
        return LLMSearchResponse(
            results=entities,
            search_time_ms=search_time_ms,
            explanation=explanation,
        )
        
    except Exception as e:
        # 降级到普通搜索
        logger.warning(f"LLM search failed, using fallback: {e}")
        
        # 使用基础搜索作为降级方案
        entities = await service.search_entities(
            query=request.query,
            entity_types=request.entity_types,
            top_k=request.top_k,
        )
        
        search_time_ms = int((time.time() - start_time) * 1000)
        
        return LLMSearchResponse(
            results=entities,
            search_time_ms=search_time_ms,
            explanation=f"使用基础搜索（LLM 搜索不可用），找到 {len(entities)} 个实体",
        )


@router.get("/stats", response_model=StatsResponse, summary="获取图谱统计数据")
async def get_statistics(
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    stats = await service.get_statistics()
    return StatsResponse(**stats)


@router.get("/categories", summary="获取实体类型列表")
async def get_categories():
    return CATEGORY_CONFIG


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
