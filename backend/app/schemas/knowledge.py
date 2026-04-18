from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class EntityBase(BaseModel):
    name: str = Field(..., description="实体名称")
    type: str = Field(..., description="实体类型：inheritor/technique/work/pattern/region/period/material")
    description: Optional[str] = Field(None, description="实体描述")
    region: Optional[str] = Field(None, description="所属地域")
    period: Optional[str] = Field(None, description="所属时期")
    coordinates: Optional[Dict[str, float]] = Field(None, description="地理坐标")
    metadata: Optional[Dict[str, Any]] = Field(None, description="额外元数据", alias="meta_data")
    importance: Optional[float] = Field(0.0, description="重要性评分")

    class Config:
        populate_by_name = True


class EntityCreate(EntityBase):
    pass


class EntityUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    region: Optional[str] = None
    period: Optional[str] = None
    coordinates: Optional[Dict[str, float]] = None
    metadata: Optional[Dict[str, Any]] = Field(None, alias="meta_data")
    importance: Optional[float] = None

    class Config:
        populate_by_name = True


class Entity(EntityBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RelationshipBase(BaseModel):
    source_id: str = Field(..., description="源实体ID")
    target_id: str = Field(..., description="目标实体ID")
    relation_type: str = Field(..., description="关系类型")
    weight: Optional[float] = Field(1.0, description="关系权重")
    metadata: Optional[Dict[str, Any]] = Field(None, description="额外元数据", alias="meta_data")

    class Config:
        populate_by_name = True


class RelationshipCreate(RelationshipBase):
    pass


class RelationshipUpdate(BaseModel):
    source_id: Optional[str] = None
    target_id: Optional[str] = None
    relation_type: Optional[str] = None
    weight: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = Field(None, alias="meta_data")

    class Config:
        populate_by_name = True


class Relationship(RelationshipBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class GraphNode(BaseModel):
    id: str
    name: str
    category: str
    symbolSize: int
    value: Optional[float] = None
    itemStyle: Optional[Dict[str, str]] = None


class GraphEdge(BaseModel):
    source: str
    target: str
    relationType: str
    lineStyle: Optional[Dict[str, Any]] = None


class GraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    categories: List[Dict[str, Any]]


class SearchRequest(BaseModel):
    keyword: Optional[str] = Field(None, description="搜索关键词")
    category: Optional[str] = Field(None, description="实体类型筛选")
    region: Optional[List[str]] = Field(None, description="地域筛选")
    period: Optional[List[str]] = Field(None, description="时期筛选")
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")
    sort_by: str = Field("relevance", description="排序方式")
    fuzzy: bool = Field(False, description="是否启用模糊搜索")


class AdvancedSearchRequest(BaseModel):
    keyword: Optional[str] = Field(None, description="搜索关键词")
    categories: Optional[List[str]] = Field(None, description="实体类型筛选（多选）")
    regions: Optional[List[str]] = Field(None, description="地域筛选（多选）")
    periods: Optional[List[str]] = Field(None, description="时期筛选（多选）")
    min_importance: Optional[float] = Field(None, ge=0.0, le=1.0, description="最小重要性")
    max_importance: Optional[float] = Field(None, ge=0.0, le=1.0, description="最大重要性")
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")
    sort_by: str = Field("relevance", description="排序方式")
    fuzzy: bool = Field(True, description="是否启用模糊搜索")


class SearchResponse(BaseModel):
    results: List[Entity]
    total: int
    page: int
    page_size: int
    total_pages: int


class EntityDetailResponse(BaseModel):
    entity: Entity
    relationships: List[Relationship]
    related_entities: List[Entity]


class PathRequest(BaseModel):
    source_id: str = Field(..., description="起始实体ID")
    target_id: str = Field(..., description="目标实体ID")
    max_depth: int = Field(3, ge=1, le=5, description="最大深度")


class PathResponse(BaseModel):
    paths: List[List[str]]
    entities: List[Entity]


class StatsResponse(BaseModel):
    total_entities: int
    total_relationships: int
    entities_by_type: Dict[str, int]
    relationships_by_type: Dict[str, int]
    top_entities: List[Dict[str, Any]]


class FavoriteCreate(BaseModel):
    user_id: str = Field(..., description="用户ID")
    entity_id: str = Field(..., description="实体ID")


class Favorite(BaseModel):
    id: str
    user_id: str
    entity_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class FeedbackCreate(BaseModel):
    user_id: str = Field(..., description="用户ID")
    entity_id: str = Field(..., description="实体ID")
    feedback_type: str = Field(..., description="反馈类型")
    content: Optional[str] = Field(None, description="反馈内容")
    rating: Optional[int] = Field(None, ge=1, le=5, description="评分")


class Feedback(BaseModel):
    id: str
    user_id: str
    entity_id: str
    feedback_type: str
    content: Optional[str]
    rating: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class ExportRequest(BaseModel):
    format: str = Field("json", description="导出格式：json/csv")
    include_entities: bool = Field(True, description="是否包含实体")
    include_relationships: bool = Field(True, description="是否包含关系")


class ImportRequest(BaseModel):
    format: str = Field("json", description="导入格式：json/csv")
    data: Dict[str, Any] = Field(..., description="导入数据")
