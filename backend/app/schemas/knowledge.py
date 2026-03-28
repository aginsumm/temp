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
    meta_data: Optional[Dict[str, Any]] = Field(None, description="额外元数据")
    importance: Optional[float] = Field(0.0, description="重要性评分")


class EntityCreate(EntityBase):
    pass


class EntityUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    region: Optional[str] = None
    period: Optional[str] = None
    coordinates: Optional[Dict[str, float]] = None
    meta_data: Optional[Dict[str, Any]] = None
    importance: Optional[float] = None


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
    meta_data: Optional[Dict[str, Any]] = Field(None, description="额外元数据")


class RelationshipCreate(RelationshipBase):
    pass


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
