from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, desc
from sqlalchemy.orm import selectinload
import uuid
import json

from app.models.chat import Session, Message, MessageSource, MessageEntity, MessageRelation, MessageRole, MessageKeyword
from app.schemas.chat import (
    SessionCreate,
    SessionUpdate,
    ChatMessageRequest,
    ChatMessageResponse,
    Source,
    Entity,
    Relation,
)


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_session(self, user_id: str, data: SessionCreate) -> Session:
        session = Session(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=data.title,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(session)
        await self.db.flush()
        return session

    async def get_session(self, session_id: str) -> Optional[Session]:
        result = await self.db.execute(
            select(Session).where(Session.id == session_id)
        )
        return result.scalar_one_or_none()

    async def get_user_sessions(
        self, user_id: str, page: int = 1, page_size: int = 20
    ) -> tuple[list[Session], int]:
        offset = (page - 1) * page_size
        
        count_result = await self.db.execute(
            select(func.count(Session.id)).where(Session.user_id == user_id)
        )
        total = count_result.scalar() or 0
        
        result = await self.db.execute(
            select(Session)
            .where(Session.user_id == user_id)
            .order_by(desc(Session.is_pinned), desc(Session.updated_at))
            .offset(offset)
            .limit(page_size)
        )
        sessions = list(result.scalars().all())
        
        return sessions, total

    async def update_session(self, session_id: str, data: SessionUpdate) -> Optional[Session]:
        session = await self.get_session(session_id)
        if not session:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        if update_data:
            update_data["updated_at"] = datetime.utcnow()
            
            # 处理 tags 字段，转换为 JSON 字符串
            if "tags" in update_data and update_data["tags"] is not None:
                update_data["tags"] = json.dumps(update_data["tags"])
            
            await self.db.execute(
                update(Session).where(Session.id == session_id).values(**update_data)
            )
            await self.db.flush()
        
        return await self.get_session(session_id)

    async def delete_session(self, session_id: str) -> bool:
        result = await self.db.execute(
            delete(Session).where(Session.id == session_id)
        )
        await self.db.flush()
        return result.rowcount > 0


class MessageService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_message(
        self,
        session_id: str,
        content: str,
        role: MessageRole,
        sources: Optional[list[Source]] = None,
        entities: Optional[list[Entity]] = None,
        keywords: Optional[list[str]] = None,
        relations: Optional[list[Relation]] = None,
    ) -> Message:
        try:
            keywords_json = json.dumps(keywords) if keywords else "[]"
            
            message = Message(
                id=str(uuid.uuid4()),
                session_id=session_id,
                role=role,
                content=content,
                created_at=datetime.utcnow(),
                keywords=keywords_json,
            )
            self.db.add(message)
            await self.db.flush()

            if sources:
                for source in sources:
                    msg_source = MessageSource(
                        id=str(uuid.uuid4()),
                        message_id=message.id,
                        title=source.title,
                        content=source.content,
                        url=source.url,
                        page=source.page,
                        relevance=int(source.relevance * 100),
                    )
                    self.db.add(msg_source)

            if entities:
                for entity in entities:
                    metadata_str = None
                    if entity.properties:
                        try:
                            metadata_str = json.dumps(entity.properties)
                        except Exception:
                            pass
                    
                    msg_entity = MessageEntity(
                        id=str(uuid.uuid4()),
                        message_id=message.id,
                        name=entity.name,
                        type=entity.type.value if hasattr(entity.type, "value") else entity.type,
                        description=entity.description,
                        relevance=int((entity.relevance or 0.8) * 100),
                        metadata_json=metadata_str,
                    )
                    self.db.add(msg_entity)

            if relations:
                for relation in relations:
                    msg_relation = MessageRelation(
                        id=str(uuid.uuid4()),
                        message_id=message.id,
                        source_entity=relation.source,
                        target_entity=relation.target,
                        relation_type=relation.type.value if hasattr(relation.type, "value") else relation.type,
                        confidence=int((relation.confidence or 0.8) * 100),
                        evidence=relation.evidence,
                        bidirectional=relation.bidirectional or False,
                    )
                    self.db.add(msg_relation)

            if keywords:
                for keyword in keywords:
                    msg_keyword = MessageKeyword(
                        id=str(uuid.uuid4()),
                        message_id=message.id,
                        keyword=keyword,
                    )
                    self.db.add(msg_keyword)

            await self.db.execute(
                update(Session)
                .where(Session.id == session_id)
                .values(
                    message_count=Session.message_count + 1,
                    updated_at=datetime.utcnow()
                )
            )
            await self.db.flush()

            return message
        except Exception as e:
            await self.db.rollback()
            raise Exception(f"创建消息失败: {str(e)}") from e

    async def get_session_messages(
        self, session_id: str, page: int = 1, page_size: int = 50
    ) -> tuple[list[Message], int, bool]:
        offset = (page - 1) * page_size
        
        count_result = await self.db.execute(
            select(func.count(Message.id)).where(Message.session_id == session_id)
        )
        total = count_result.scalar() or 0
        
        result = await self.db.execute(
            select(Message)
            .options(
                selectinload(Message.sources),
                selectinload(Message.entities),
                selectinload(Message.relations),
                selectinload(Message.keyword_records),
            )
            .where(Message.session_id == session_id)
            .order_by(Message.created_at)
            .offset(offset)
            .limit(page_size + 1)
        )
        messages = list(result.scalars().all())
        
        has_more = len(messages) > page_size
        if has_more:
            messages = messages[:page_size]
        
        return messages, total, has_more

    async def get_message(self, message_id: str) -> Optional[Message]:
        result = await self.db.execute(
            select(Message)
            .options(
                selectinload(Message.sources),
                selectinload(Message.entities),
                selectinload(Message.relations),
                selectinload(Message.keyword_records),
            )
            .where(Message.id == message_id)
        )
        return result.scalar_one_or_none()

    async def update_feedback(self, message_id: str, feedback: str) -> Optional[Message]:
        await self.db.execute(
            update(Message)
            .where(Message.id == message_id)
            .values(feedback=feedback)
        )
        await self.db.flush()
        return await self.get_message(message_id)

    async def toggle_favorite(self, message_id: str) -> bool:
        message = await self.get_message(message_id)
        if not message:
            return False
        
        new_status = not message.is_favorite
        await self.db.execute(
            update(Message)
            .where(Message.id == message_id)
            .values(is_favorite=new_status)
        )
        await self.db.flush()
        return new_status

    async def update_message(
        self,
        message_id: str,
        content: Optional[str] = None,
        sources: Optional[list[Source]] = None,
        entities: Optional[list[Entity]] = None,
        keywords: Optional[list[str]] = None,
        relations: Optional[list[Relation]] = None,
    ) -> Optional[Message]:
        """更新消息及其关联数据（用于重新生成）"""
        try:
            message = await self.get_message(message_id)
            if not message:
                return None

            # 更新消息内容
            if content is not None:
                await self.db.execute(
                    update(Message)
                    .where(Message.id == message_id)
                    .values(content=content)
                )

            # 删除旧的关联数据
            await self.db.execute(
                delete(MessageSource).where(MessageSource.message_id == message_id)
            )
            await self.db.execute(
                delete(MessageEntity).where(MessageEntity.message_id == message_id)
            )
            await self.db.execute(
                delete(MessageRelation).where(MessageRelation.message_id == message_id)
            )
            await self.db.execute(
                delete(MessageKeyword).where(MessageKeyword.message_id == message_id)
            )

            # 添加新的来源
            if sources:
                for source in sources:
                    msg_source = MessageSource(
                        id=str(uuid.uuid4()),
                        message_id=message_id,
                        title=source.title,
                        content=source.content,
                        url=source.url,
                        page=source.page,
                        relevance=int(source.relevance * 100),
                    )
                    self.db.add(msg_source)

            # 添加新的实体
            if entities:
                for entity in entities:
                    metadata_str = None
                    if entity.properties:
                        try:
                            metadata_str = json.dumps(entity.properties)
                        except Exception:
                            pass
                    
                    msg_entity = MessageEntity(
                        id=str(uuid.uuid4()),
                        message_id=message_id,
                        name=entity.name,
                        type=entity.type.value if hasattr(entity.type, "value") else entity.type,
                        description=entity.description,
                        relevance=int((entity.relevance or 0.8) * 100),
                        metadata_json=metadata_str,
                    )
                    self.db.add(msg_entity)

            # 添加新的关系
            if relations:
                for relation in relations:
                    msg_relation = MessageRelation(
                        id=str(uuid.uuid4()),
                        message_id=message_id,
                        source_entity=relation.source,
                        target_entity=relation.target,
                        relation_type=relation.type.value if hasattr(relation.type, "value") else relation.type,
                        confidence=int((relation.confidence or 0.8) * 100),
                        evidence=relation.evidence,
                        bidirectional=relation.bidirectional or False,
                    )
                    self.db.add(msg_relation)

            # 添加新的关键词
            if keywords:
                for keyword in keywords:
                    msg_keyword = MessageKeyword(
                        id=str(uuid.uuid4()),
                        message_id=message_id,
                        keyword=keyword,
                    )
                    self.db.add(msg_keyword)

            await self.db.flush()
            return await self.get_message(message_id)
        except Exception as e:
            await self.db.rollback()
            raise Exception(f"更新消息失败: {str(e)}") from e
