from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.database import get_db
from app.core.auth import get_current_user, get_current_or_guest
from app.schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    SessionCreate,
    SessionUpdate,
    Session as SessionSchema,
    SessionListResponse,
    MessageListResponse,
    Message as MessageSchema,
    FeedbackRequest,
    FavoriteResponse,
    RecommendedQuestion,
    Source,
    Entity,
    Relation,
    RelationType,
    RecommendationRequest,
)
from app.services.chat_service import SessionService, MessageService
from app.services.llm_service import llm_service
from app.services.source_retrieval import retrieve_sources_from_knowledge
from app.services.question_generator import question_generator
from app.models.chat import MessageRole

router = APIRouter(prefix="/api/v1", tags=["chat"])
logger = logging.getLogger(__name__)

# 常量定义
MAX_ENTITIES = 5
MAX_KEYWORDS = 5
STREAM_CHUNK_DELAY = 0.03

MOCK_SOURCES = [
    {
        "id": "1",
        "title": "《中国非物质文化遗产保护名录》",
        "content": "详细记录了国家级非遗项目的传承谱系、技艺特点和保护措施...",
        "page": 128,
        "relevance": 0.95,
    },
    {
        "id": "2",
        "title": "《地方志·传统技艺卷》",
        "content": "记载了传统技艺的历史渊源、发展脉络和地域特色...",
        "page": 56,
        "relevance": 0.88,
    },
]

HERITAGE_FALLBACK_RESPONSES = [
    "根据非遗知识库的资料，您询问的内容涉及传统技艺的核心传承。这项技艺已有数百年历史，是中华传统文化的重要组成部分。",
    "关于您的问题，从非遗保护的角度来看，这体现了先民智慧的结晶。传承人在技艺传承中扮演着关键角色，需要长期的学习和实践。",
    '这是一个很好的问题！非遗文化强调"活态传承"，每一代传承人都会在保持核心技艺的同时，融入时代特色。',
]


def parse_session_tags(session: Any) -> dict[str, Any]:
    """解析 Session 模型的 tags 字段"""
    session_dict = {c.name: getattr(session, c.name) for c in session.__table__.columns}
    if hasattr(session, 'tags') and session.tags:
        try:
            session_dict['tags'] = json.loads(session.tags) if isinstance(session.tags, str) else session.tags
        except (json.JSONDecodeError, TypeError):
            session_dict['tags'] = []
    else:
        session_dict['tags'] = []
    return session_dict


def generate_fallback_response(content: str) -> str:
    """生成降级响应"""
    lower_content = content.lower()
    
    if '传承人' in lower_content or '传人' in lower_content:
        return "传承人是非遗保护的核心。他们不仅掌握着精湛的技艺，更承载着文化的记忆。目前我国已建立了完善的传承人认定和保护机制，确保这些珍贵技艺得以延续。"
    
    if '历史' in lower_content or '起源' in lower_content:
        return "这项非遗技艺历史悠久，可追溯至数百年前。它凝聚了先民的智慧，在历史长河中不断发展演变，形成了独特的艺术风格。"
    
    if '工艺' in lower_content or '制作' in lower_content:
        return '该技艺的制作工艺十分讲究，需要经过多道工序，每一步都需要精心操作。传统工艺强调"慢工出细活"，体现了匠人精神。'
    
    import random
    return random.choice(HERITAGE_FALLBACK_RESPONSES)


def extract_fallback_keywords(content: str) -> list[str]:
    """提取关键词（降级版本）"""
    keywords = ['传承', '技艺', '非遗', '传统', '文化']
    result = []
    for kw in keywords:
        if kw in content and len(result) < MAX_KEYWORDS:
            result.append(kw)
    return result if result else ['非遗文化']


def extract_fallback_entities(content: str) -> list[dict]:
    """提取实体（降级版本）"""
    entities = []
    entity_map = {
        '传承人': ('inheritor', '非物质文化遗产传承人'),
        '技艺': ('technique', '传统技艺技法'),
        '工艺': ('technique', '传统制作工艺'),
        '历史': ('period', '历史时期背景'),
    }
    
    for i, (keyword, (etype, desc)) in enumerate(entity_map.items()):
        if keyword in content and len(entities) < MAX_ENTITIES:
            entities.append({
                "id": f"entity_{i+1}",
                "name": keyword,
                "type": etype,
                "description": desc,
                "relevance": 0.85,
            })
    
    return entities


class ChatError(Exception):
    """聊天服务异常"""
    def __init__(self, code: str, message: str, recoverable: bool = True):
        self.code = code
        self.message = message
        self.recoverable = recoverable
        super().__init__(message)


@router.get("/health")
async def health_check():
    """LLM服务健康检查端点"""
    try:
        state = llm_service.state.value
        is_healthy = state == "healthy"
        
        response = {
            "status": "healthy" if is_healthy else "degraded",
            "llm_state": state,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error_counts": llm_service.error_counts,
            "is_degraded": llm_service.is_degraded,
        }
        
        if llm_service.last_health_check:
            response["last_health_check"] = llm_service.last_health_check.isoformat()
            
        return response
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return {
            "status": "error",
            "llm_state": "unknown",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e)
        }


@router.post("/chat/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_or_guest),
):
    session_service = SessionService(db)
    message_service = MessageService(db)

    try:
        session = await session_service.get_session(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")

        # 处理文件 URL，将其附加到消息内容中
        user_content = request.content
        if request.file_urls:
            file_references = []
            for url in request.file_urls:
                filename = url.split('/')[-1] if '/' in url else url
                file_references.append(f"[文件: {filename}]({url})")
            user_content = f"{request.content}\n\n{' '.join(file_references)}"

        await message_service.create_message(
            session_id=request.session_id,
            content=user_content,
            role=MessageRole.user,
        )

        ai_response = await llm_service.chat(user_content)
        entities = await llm_service.extract_entities(ai_response)
        keywords = await llm_service.extract_keywords(ai_response)
        relations = await llm_service.extract_relations(ai_response, entities)

        # 动态检索相关来源，替换硬编码的 MOCK_SOURCES
        sources = await retrieve_sources_from_knowledge(db, request.content, entities)

        ai_message = await message_service.create_message(
            session_id=request.session_id,
            content=ai_response,
            role=MessageRole.assistant,
            sources=sources,
            entities=entities,
            keywords=keywords,
            relations=relations,
        )

        return ChatMessageResponse(
            message_id=ai_message.id,
            content=ai_message.content,
            role=ai_message.role,
            sources=sources,
            entities=entities,
            keywords=keywords,
            created_at=ai_message.created_at.isoformat(),
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in send_message: {e}")
        raise HTTPException(status_code=500, detail=f"发送消息失败: {str(e)}")


@router.post("/chat/stream")
async def send_message_stream(
    request: ChatMessageRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_or_guest),
):
    session_service = SessionService(db)
    message_service = MessageService(db)

    try:
        session = await session_service.get_session(request.session_id)
        if not session:
            print(f"⚠️ 流式接口发现未知的会话 ID: {request.session_id}，正在自动创建...")
            from app.models.chat import Session
            new_session = Session(
                id=request.session_id,
                user_id=user_id,
                title="新对话",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(new_session)
            await db.flush()
            session = new_session

        # 处理文件 URL，将其附加到消息内容中
        user_content = request.content
        if request.file_urls:
            file_references = []
            for url in request.file_urls:
                filename = url.split('/')[-1] if '/' in url else url
                file_references.append(f"[文件: {filename}]({url})")
            user_content = f"{request.content}\n\n{' '.join(file_references)}"

        if request.resume_from is None:
            await message_service.create_message(
                session_id=request.session_id,
                content=user_content,
                role=MessageRole.user,
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user message: {e}")
        raise HTTPException(status_code=500, detail=f"创建消息失败: {str(e)}")

    def deduplicate_entities(entities: list) -> list:
        """实体去重：基于名称和类型合并相同实体"""
        if not entities:
            return []
        
        seen = {}
        for entity in entities:
            key = f"{entity.name.lower().strip()}_{entity.type}"
            if key not in seen:
                seen[key] = entity
            else:
                existing = seen[key]
                if entity.description and not existing.description:
                    existing.description = entity.description
                if entity.relevance and (not existing.relevance or entity.relevance > existing.relevance):
                    existing.relevance = entity.relevance
                if entity.importance and (not existing.importance or entity.importance > existing.importance):
                    existing.importance = entity.importance
        
        return list(seen.values())

    def deduplicate_relations(relations: list) -> list:
        """关系去重：基于 source-target-type 合并相同关系"""
        if not relations:
            return []
        
        seen = {}
        for relation in relations:
            key = f"{relation.source}_{relation.target}_{relation.type}"
            if key not in seen:
                seen[key] = relation
            else:
                existing = seen[key]
                if relation.confidence and (not existing.confidence or relation.confidence > existing.confidence):
                    existing.confidence = relation.confidence
        
        return list(seen.values())

    async def generate():
        full_content = ""
        accumulated_length = 0
        
        try:
            if request.resume_from is not None:
                yield f"data: {json.dumps({'type': 'resume', 'offset': request.resume_from}, ensure_ascii=False)}\n\n"
            
            async for chunk in llm_service.chat_stream(request.content):
                full_content += chunk
                accumulated_length += len(chunk)
                
                data = json.dumps({
                    "type": "content_chunk",
                    "content": chunk,
                    "accumulated_length": accumulated_length
                }, ensure_ascii=False)
                yield f"data: {data}\n\n"

            entities = await llm_service.extract_entities(full_content)
            keywords = await llm_service.extract_keywords(full_content)
            relations = await llm_service.extract_relations(full_content, entities)

            # 实体和关系去重
            entities = deduplicate_entities(entities)
            relations = deduplicate_relations(relations)

            if entities:
                entities_data = json.dumps({
                    "type": "entities",
                    "entities": [e.model_dump() for e in entities],
                    "is_incremental": False
                }, ensure_ascii=False)
                yield f"data: {entities_data}\n\n"

            if keywords:
                keywords_data = json.dumps({
                    "type": "keywords",
                    "keywords": list(dict.fromkeys(keywords))  # 关键词去重
                }, ensure_ascii=False)
                yield f"data: {keywords_data}\n\n"

            if relations:
                relations_data = json.dumps({
                    "type": "relations",
                    "relations": [r.model_dump() for r in relations]
                }, ensure_ascii=False)
                yield f"data: {relations_data}\n\n"

            # 动态检索相关来源，替换硬编码的 MOCK_SOURCES
            sources = await retrieve_sources_from_knowledge(db, request.content, entities)

            try:
                ai_message = await message_service.create_message(
                    session_id=request.session_id,
                    content=full_content,
                    role=MessageRole.assistant,
                    sources=sources,
                    entities=entities,
                    keywords=keywords,
                    relations=relations,
                )
                message_id = ai_message.id
            except Exception as db_error:
                logger.error(f"Error saving AI message: {db_error}")
                message_id = f"msg_{datetime.now(timezone.utc).timestamp()}"
                sources = []

            complete_data = json.dumps(
                {
                    "type": "complete",
                    "message_id": message_id,
                    "content": full_content,
                    "sources": [s.model_dump() for s in sources],
                    "entities": [e.model_dump() for e in entities],
                    "keywords": keywords,
                    "relations": [r.model_dump() for r in relations],
                },
                ensure_ascii=False,
            )
            yield f"data: {complete_data}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}")
            error_data = json.dumps({
                "type": "error",
                "code": "STREAM_ERROR",
                "message": str(e),
                "recoverable": True
            }, ensure_ascii=False)
            yield f"data: {error_data}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/chat/recommendations")
async def get_recommendations(
    request: RecommendationRequest,
    db: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_or_guest),
):
    """获取智能推荐问题 - 基于对话历史上下文"""
    try:
        conversation_history = []
        extracted_entities = request.entities or []
        extracted_keywords = request.keywords or []
        context_content = request.context or ""

        if request.session_id:
            message_service = MessageService(db)
            messages, total, _ = await message_service.get_session_messages(
                request.session_id, page=1, page_size=10
            )

            for msg in messages[-6:]:
                conversation_history.append({
                    "role": msg.role.value if hasattr(msg.role, "value") else msg.role,
                    "content": msg.content[:200],
                })

                if msg.entities:
                    for entity in msg.entities:
                        name = entity.name if hasattr(entity, "name") else entity
                        if name not in extracted_entities:
                            extracted_entities.append(name)

                if msg.keyword_records:
                    for kw_record in msg.keyword_records:
                        kw = kw_record.keyword if hasattr(kw_record, "keyword") else kw_record
                        if kw not in extracted_keywords:
                            extracted_keywords.append(kw)

            if conversation_history:
                last_user_msg = next(
                    (m for m in reversed(conversation_history) if m["role"] == "user"), None
                )
                if last_user_msg:
                    context_content = context_content or last_user_msg["content"]

        hour = datetime.now().hour
        if 6 <= hour < 12:
            time_of_day = 'morning'
        elif 12 <= hour < 18:
            time_of_day = 'afternoon'
        elif 18 <= hour < 23:
            time_of_day = 'evening'
        else:
            time_of_day = 'night'

        recommendations = question_generator.generate_recommendations(
            entities=extracted_entities,
            keywords=extracted_keywords,
            context=context_content,
            time_of_day=time_of_day,
            limit=request.limit
        )

        return {"questions": recommendations}
    except Exception as e:
        logger.error(f"Failed to generate recommendations: {e}")
        questions = [
            RecommendedQuestion(id="1", question="什么是非物质文化遗产？"),
            RecommendedQuestion(id="2", question="如何成为非遗传承人？"),
            RecommendedQuestion(id="3", question="非遗保护有哪些重要意义？"),
            RecommendedQuestion(id="4", question="传统技艺如何与现代生活结合？"),
            RecommendedQuestion(id="5", question="中国有哪些世界级非遗项目？"),
            RecommendedQuestion(id="6", question="非遗传承面临哪些挑战？"),
        ]
        return {"questions": questions}


@router.post("/chat/message/{message_id}/feedback")
async def submit_feedback(
    message_id: str,
    request: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        message_service = MessageService(db)
        message = await message_service.update_feedback(message_id, request.feedback)
        if not message:
            raise HTTPException(status_code=404, detail="消息不存在")
        return {"success": True, "feedback": request.feedback}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting feedback: {e}")
        raise HTTPException(status_code=500, detail=f"提交反馈失败: {str(e)}")


@router.post("/chat/message/{message_id}/favorite", response_model=FavoriteResponse)
async def toggle_favorite(
    message_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        message_service = MessageService(db)
        is_favorite = await message_service.toggle_favorite(message_id)
        if is_favorite is None:
            raise HTTPException(status_code=404, detail="消息不存在")
        return FavoriteResponse(is_favorite=is_favorite)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling favorite: {e}")
        raise HTTPException(status_code=500, detail=f"操作失败: {str(e)}")


@router.get("/session", response_model=SessionListResponse)
async def list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    try:
        session_service = SessionService(db)
        sessions, total = await session_service.get_user_sessions(user_id, page, page_size)
        
        session_data = []
        for s in sessions:
            data = parse_session_tags(s)
            session_data.append(SessionSchema(**data))
        
        return SessionListResponse(
            sessions=session_data,
            total=total,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        raise HTTPException(status_code=500, detail=f"获取会话列表失败: {str(e)}")


@router.post("/session", response_model=SessionSchema)
async def create_session(
    data: SessionCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    try:
        session_service = SessionService(db)
        session = await session_service.create_session(user_id, data)
        return SessionSchema.model_validate(session)
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail=f"创建会话失败: {str(e)}")


@router.get("/session/{session_id}", response_model=SessionSchema)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        session_service = SessionService(db)
        session = await session_service.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        data = parse_session_tags(session)
        return SessionSchema(**data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session: {e}")
        raise HTTPException(status_code=500, detail=f"获取会话失败: {str(e)}")


@router.put("/session/{session_id}", response_model=SessionSchema)
async def update_session(
    session_id: str,
    data: SessionUpdate,
    db: AsyncSession = Depends(get_db),
):
    try:
        session_service = SessionService(db)
        session = await session_service.update_session(session_id, data)
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        parsed_data = parse_session_tags(session)
        return SessionSchema(**parsed_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating session: {e}")
        raise HTTPException(status_code=500, detail=f"更新会话失败: {str(e)}")


@router.delete("/session/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    try:
        session_service = SessionService(db)
        success = await session_service.delete_session(session_id)
        if not success:
            raise HTTPException(status_code=404, detail="会话不存在")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        raise HTTPException(status_code=500, detail=f"删除会话失败: {str(e)}")


@router.get("/session/{session_id}/messages", response_model=MessageListResponse)
async def get_session_messages(
    session_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    try:
        session_service = SessionService(db)
        session = await session_service.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")
        if session.user_id != user_id:
            raise HTTPException(status_code=403, detail="无权访问该会话消息")

        message_service = MessageService(db)
        messages, total, has_more = await message_service.get_session_messages(
            session_id, page, page_size
        )
        
        message_schemas = []
        for msg in messages:
            sources = [
                Source(
                    id=s.id,
                    title=s.title,
                    content=s.content,
                    url=s.url,
                    page=s.page,
                    relevance=s.relevance / 100.0,
                )
                for s in msg.sources
            ]
            entities = [
                Entity(
                    id=e.id,
                    name=e.name,
                    type=e.type,
                    description=e.description,
                    relevance=(e.relevance / 100.0) if e.relevance is not None else None,
                )
                for e in msg.entities
            ]
            relations = []
            for r in msg.relations:
                relation_type_raw = r.relation_type or "related_to"
                try:
                    relation_type = RelationType(relation_type_raw)
                except ValueError:
                    relation_type = RelationType.related_to

                relations.append(
                    Relation(
                        id=r.id,
                        source=r.source_entity,
                        target=r.target_entity,
                        type=relation_type,
                        confidence=(r.confidence / 100.0) if r.confidence is not None else 0.8,
                        evidence=r.evidence,
                        bidirectional=bool(r.bidirectional),
                    )
                )

            keywords = []
            if msg.keywords:
                if isinstance(msg.keywords, str):
                    try:
                        parsed = json.loads(msg.keywords)
                        if isinstance(parsed, list):
                            keywords = [k for k in parsed if isinstance(k, str)]
                    except json.JSONDecodeError:
                        keywords = []
                elif isinstance(msg.keywords, list):
                    keywords = [k for k in msg.keywords if isinstance(k, str)]
            message_schemas.append(
                MessageSchema(
                    id=msg.id,
                    session_id=msg.session_id,
                    role=msg.role,
                    content=msg.content,
                    created_at=msg.created_at,
                    sources=sources,
                    entities=entities,
                    relations=relations,
                    keywords=keywords,
                    feedback=msg.feedback,
                    is_favorite=msg.is_favorite,
                )
            )
        
        return MessageListResponse(
            messages=message_schemas,
            total=total,
            has_more=has_more,
        )
    except Exception as e:
        logger.error(f"Error getting session messages: {e}")
        raise HTTPException(status_code=500, detail=f"获取消息失败: {str(e)}")


@router.post("/chat/message/{message_id}/regenerate")
async def regenerate_message(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_or_guest),
):
    """重新生成指定消息的 AI 回复"""
    session_service = SessionService(db)
    message_service = MessageService(db)

    try:
        # 获取原消息
        original_message = await message_service.get_message(message_id)
        if not original_message:
            raise HTTPException(status_code=404, detail="消息不存在")

        if original_message.role != MessageRole.assistant:
            raise HTTPException(status_code=400, detail="只能重新生成 AI 回复")

        # 获取用户消息（上一条消息）
        messages = await message_service.get_messages_by_session(
            original_message.session_id, page=1, page_size=100
        )
        
        user_message = None
        for i, msg in enumerate(messages):
            if msg.id == message_id and i > 0:
                user_message = messages[i - 1]
                break

        if not user_message:
            raise HTTPException(status_code=404, detail="找不到对应的用户消息")

        # 调用 LLM 重新生成
        ai_response = await llm_service.chat(user_message.content)
        entities = await llm_service.extract_entities(ai_response)
        keywords = await llm_service.extract_keywords(ai_response)
        relations = await llm_service.extract_relations(ai_response, entities)
        sources = await retrieve_sources_from_knowledge(db, user_message.content, entities)

        # 更新原消息内容
        updated_message = await message_service.update_message(
            message_id=message_id,
            content=ai_response,
            sources=sources,
            entities=entities,
            keywords=keywords,
            relations=relations,
        )

        return ChatMessageResponse(
            message_id=updated_message.id,
            content=updated_message.content,
            role=updated_message.role,
            sources=sources,
            entities=entities,
            keywords=keywords,
            created_at=updated_message.created_at.isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error regenerating message: {e}")
        raise HTTPException(status_code=500, detail=f"重新生成失败: {str(e)}")


@router.post("/chat/message/{message_id}/regenerate/stream")
async def regenerate_message_stream(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_or_guest),
):
    """流式重新生成指定消息的 AI 回复"""
    session_service = SessionService(db)
    message_service = MessageService(db)

    try:
        # 获取原消息
        original_message = await message_service.get_message(message_id)
        if not original_message:
            raise HTTPException(status_code=404, detail="消息不存在")

        if original_message.role != MessageRole.assistant:
            raise HTTPException(status_code=400, detail="只能重新生成 AI 回复")

        # 获取用户消息
        messages = await message_service.get_messages_by_session(
            original_message.session_id, page=1, page_size=100
        )
        
        user_message = None
        for i, msg in enumerate(messages):
            if msg.id == message_id and i > 0:
                user_message = messages[i - 1]
                break

        if not user_message:
            raise HTTPException(status_code=404, detail="找不到对应的用户消息")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error preparing regeneration: {e}")
        raise HTTPException(status_code=500, detail=f"准备重新生成失败: {str(e)}")

    async def generate():
        full_content = ""
        accumulated_length = 0
        
        try:
            async for chunk in llm_service.chat_stream(user_message.content):
                full_content += chunk
                accumulated_length += len(chunk)
                
                data = json.dumps({
                    "type": "content_chunk",
                    "content": chunk,
                    "accumulated_length": accumulated_length
                }, ensure_ascii=False)
                yield f"data: {data}\n\n"

            entities = await llm_service.extract_entities(full_content)
            keywords = await llm_service.extract_keywords(full_content)
            relations = await llm_service.extract_relations(full_content, entities)
            sources = await retrieve_sources_from_knowledge(db, user_message.content, entities)

            if entities:
                yield f"data: {json.dumps({'type': 'entities', 'entities': [e.model_dump() for e in entities]}, ensure_ascii=False)}\n\n"

            if keywords:
                yield f"data: {json.dumps({'type': 'keywords', 'keywords': keywords}, ensure_ascii=False)}\n\n"

            if relations:
                yield f"data: {json.dumps({'type': 'relations', 'relations': [r.model_dump() for r in relations]}, ensure_ascii=False)}\n\n"

            await message_service.update_message(
                message_id=message_id,
                content=full_content,
                sources=sources,
                entities=entities,
                keywords=keywords,
                relations=relations,
            )

            yield f"data: {json.dumps({'type': 'complete', 'message_id': message_id, 'content': full_content}, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"Stream regeneration error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
