from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Boolean, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import uuid
import enum

from app.core.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class MessageRole(enum.Enum):
    user = "user"
    assistant = "assistant"


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    title = Column(String(255), nullable=False, default="新对话")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    message_count = Column(Integer, default=0)
    is_pinned = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    tags = Column(String(1024), default="[]")  # JSON 字符串存储标签列表

    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Session {self.id}: {self.title}>"


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(SQLEnum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    feedback = Column(String(20), nullable=True)
    is_favorite = Column(Boolean, default=False)
    keywords = Column(String(1024), default="[]")  # JSON 字符串存储关键词列表

    session = relationship("Session", back_populates="messages")
    sources = relationship("MessageSource", back_populates="message", cascade="all, delete-orphan")
    entities = relationship("MessageEntity", back_populates="message", cascade="all, delete-orphan")
    relations = relationship("MessageRelation", back_populates="message", cascade="all, delete-orphan")
    keyword_records = relationship("MessageKeyword", back_populates="message", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Message {self.id}: {self.role}>"


class MessageSource(Base):
    __tablename__ = "message_sources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(String(36), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=True)
    url = Column(String(1000), nullable=True)
    page = Column(Integer, nullable=True)
    relevance = Column(Integer, default=0)

    message = relationship("Message", back_populates="sources")

    def __repr__(self):
        return f"<MessageSource {self.id}: {self.title}>"


class MessageEntity(Base):
    __tablename__ = "message_entities"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(String(36), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    relevance = Column(Integer, default=80)  # 相关性评分 (0-100)
    url = Column(String(1000), nullable=True)  # 实体 URL
    metadata_json = Column(String(2048), nullable=True)  # JSON 字符串存储元数据

    message = relationship("Message", back_populates="entities")

    def __repr__(self):
        return f"<MessageEntity {self.id}: {self.name}>"


class MessageRelation(Base):
    __tablename__ = "message_relations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(String(36), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    source_entity = Column(String(255), nullable=False)  # 源实体名称
    target_entity = Column(String(255), nullable=False)  # 目标实体名称
    relation_type = Column(String(100), nullable=False)  # 关系类型
    confidence = Column(Integer, default=80)  # 置信度 (0-100)
    evidence = Column(Text, nullable=True)  # 关系证据
    bidirectional = Column(Boolean, default=False)  # 是否双向关系

    message = relationship("Message", back_populates="relations")

    def __repr__(self):
        return f"<MessageRelation {self.id}: {self.source_entity} -> {self.target_entity}>"


class MessageKeyword(Base):
    __tablename__ = "message_keywords"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    message_id = Column(String(36), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    keyword = Column(String(100), nullable=False)

    message = relationship("Message", back_populates="keyword_records")

    def __repr__(self):
        return f"<MessageKeyword {self.keyword}>"


class FavoriteQuestion(Base):
    __tablename__ = "favorite_questions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    question = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<FavoriteQuestion {self.id}: {self.question[:30]}>"


class MessageFavorite(Base):
    __tablename__ = "message_favorites"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=False, index=True)
    message_id = Column(String(36), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    message = relationship("Message")

    def __repr__(self):
        return f"<MessageFavorite {self.id}: user={self.user_id}, message={self.message_id}>"
