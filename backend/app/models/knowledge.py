from sqlalchemy import Column, String, Integer, Float, Text, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()


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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    source_id = Column(String, nullable=False, index=True)
    target_id = Column(String, nullable=False, index=True)
    relation_type = Column(String(50), nullable=False, index=True)
    weight = Column(Float, default=1.0)
    meta_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True)
    keyword = Column(String(200), nullable=False)
    filters = Column(JSON)
    result_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True)
    entity_id = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
