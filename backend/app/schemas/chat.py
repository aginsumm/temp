from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum


class EntityType(str, Enum):
    inheritor = "inheritor"
    technique = "technique"
    work = "work"
    pattern = "pattern"
    region = "region"
    period = "period"
    material = "material"


class RelationType(str, Enum):
    inherits = "inherits"
    origin = "origin"
    creates = "creates"
    flourished_in = "flourished_in"
    located_in = "located_in"
    uses_material = "uses_material"
    has_pattern = "has_pattern"
    related_to = "related_to"
    influenced_by = "influenced_by"
    contains = "contains"


class MessageRole(str, Enum):
    user = "user"
    assistant = "assistant"


class SourceBase(BaseModel):
    title: str
    content: str
    url: Optional[str] = None
    page: Optional[int] = None
    relevance: float = Field(default=0.0, ge=0.0, le=1.0)


class Source(SourceBase):
    id: str
    
    class Config:
        from_attributes = True


class EntityBase(BaseModel):
    name: str
    type: EntityType
    description: Optional[str] = None
    # Knowledge 模块扩展字段
    importance: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    region: Optional[str] = None
    period: Optional[str] = None
    coordinates: Optional[dict] = None
    images: Optional[list[str]] = None
    tags: Optional[list[str]] = None


class Entity(EntityBase):
    id: str
    properties: Optional[dict] = None
    relevance: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class RelationBase(BaseModel):
    source: str
    target: str
    type: RelationType


class Relation(RelationBase):
    id: str
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    evidence: Optional[str] = None
    bidirectional: bool = False
    
    class Config:
        from_attributes = True


class GraphNode(BaseModel):
    id: str
    name: str
    category: EntityType
    value: float = 0.5
    symbolSize: float = 30
    x: Optional[float] = None
    y: Optional[float] = None
    description: Optional[str] = None
    metadata: Optional[dict] = None
    itemStyle: Optional[dict] = None
    
    class Config:
        from_attributes = True


class GraphEdge(BaseModel):
    id: Optional[str] = None
    source: str
    target: str
    relationType: Optional[RelationType] = None
    value: float = 0.5
    lineStyle: Optional[dict] = None
    
    class Config:
        from_attributes = True


class GraphCategory(BaseModel):
    name: str
    color: Optional[str] = None
    
    class Config:
        from_attributes = True


class GraphData(BaseModel):
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    categories: Optional[list[GraphCategory]] = None
    
    class Config:
        from_attributes = True


class MessageBase(BaseModel):
    content: str
    role: MessageRole


class Message(MessageBase):
    id: str
    session_id: str
    created_at: datetime
    sources: Optional[list[Source]] = None
    entities: Optional[list[Entity]] = None
    keywords: Optional[list[str]] = None
    relations: Optional[list[Relation]] = None
    feedback: Optional[str] = None
    is_favorite: bool = False
    
    class Config:
        from_attributes = True


class SessionBase(BaseModel):
    title: str = "新对话"


class Session(SessionBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    is_pinned: bool = False
    is_archived: bool = False
    tags: list[str] = []
    
    class Config:
        from_attributes = True


class ChatMessageRequest(BaseModel):
    session_id: str
    content: str
    message_type: str = "text"
    resume_from: Optional[int] = None  # 断点续传：从第几个字符继续
    file_urls: Optional[list[str]] = None  # 上传文件的 URL 列表
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "session_001",
                "content": "武汉木雕有哪些代表性技法？",
                "message_type": "text",
                "file_urls": ["/uploads/images/xxx.jpg", "/uploads/documents/yyy.pdf"]
            }
        }


class RecommendationRequest(BaseModel):
    session_id: Optional[str] = None  # 会话 ID，用于获取对话历史
    entities: Optional[list[str]] = None  # 实体列表
    keywords: Optional[list[str]] = None  # 关键词列表
    context: Optional[str] = None  # 上下文内容
    limit: int = 6  # 推荐数量
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "session_001",
                "entities": ["传承人", "木雕"],
                "keywords": ["非遗", "技艺"],
                "context": "用户正在了解武汉木雕相关技艺",
                "limit": 6
            }
        }


class ChatMessageResponse(BaseModel):
    message_id: str
    content: str
    role: MessageRole
    sources: Optional[list[Source]] = None
    entities: Optional[list[Entity]] = None
    keywords: Optional[list[str]] = None
    relations: Optional[list[Relation]] = None
    created_at: str


class SessionCreate(BaseModel):
    title: str = "新对话"


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    tags: Optional[list[str]] = None


class SessionListResponse(BaseModel):
    sessions: list[Session]
    total: int
    page: int
    page_size: int


class MessageListResponse(BaseModel):
    messages: list[Message]
    total: int
    has_more: bool


class RecommendedQuestion(BaseModel):
    id: str
    question: str
    category: Optional[str] = None


class FeedbackRequest(BaseModel):
    feedback: str = Field(..., pattern="^(helpful|unclear)$")


class FavoriteResponse(BaseModel):
    is_favorite: bool
