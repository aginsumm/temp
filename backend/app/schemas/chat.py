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


class Entity(EntityBase):
    id: str
    properties: Optional[dict] = None
    
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
    
    class Config:
        from_attributes = True


class ChatMessageRequest(BaseModel):
    session_id: str
    content: str
    message_type: str = "text"
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "session_001",
                "content": "武汉木雕有哪些代表性技法？",
                "message_type": "text"
            }
        }


class ChatMessageResponse(BaseModel):
    message_id: str
    content: str
    role: MessageRole
    sources: Optional[list[Source]] = None
    entities: Optional[list[Entity]] = None
    keywords: Optional[list[str]] = None
    created_at: str


class SessionCreate(BaseModel):
    title: str = "新对话"


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    is_pinned: Optional[bool] = None


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
