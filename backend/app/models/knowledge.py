from sqlalchemy import Column, String, Integer, Float, Text, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone
import uuid
from app.core.database import Base


class Entity(Base):
    __tablename__ = "entities"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False, index=True)
    type = Column(String(50), nullable=False, index=True)
    description = Column(Text)
    region = Column(String(100), index=True)
    period = Column(String(100), index=True)
    coordinates = Column(JSON)
    meta_data = Column(JSON)
    importance = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    source_id = Column(String, nullable=False, index=True)
    target_id = Column(String, nullable=False, index=True)
    relation_type = Column(String(50), nullable=False, index=True)
    weight = Column(Float, default=1.0)
    meta_data = Column(JSON)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True)
    keyword = Column(String(200), nullable=False)
    filters = Column(JSON)
    result_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True)
    entity_id = Column(String, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True)
    entity_id = Column(String, index=True)
    feedback_type = Column(String(50), nullable=False)
    content = Column(Text)
    rating = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class EntityAlias(Base):
    __tablename__ = "entity_aliases"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    entity_id = Column(String, nullable=False, index=True)
    alias_name = Column(String(200), nullable=False, index=True)
    alias_type = Column(String(50), default="synonym", comment="别名类型：synonym/abbreviation/translation")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class GraphVersion(Base):
    __tablename__ = "graph_versions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    snapshot_data = Column(JSON, nullable=False, comment="图谱快照数据")
    entity_count = Column(Integer, default=0)
    relationship_count = Column(Integer, default=0)
    tags = Column(JSON, comment="标签列表")
    created_by = Column(String(36), index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    parent_version_id = Column(String(36), comment="父版本 ID")
