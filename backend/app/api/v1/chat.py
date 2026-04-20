from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import json
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.database import get_db
from app.core.auth import get_current_user, get_optional_user
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
    EntityType,
)
from app.services.chat_service import SessionService, MessageService
from app.services.llm_service import llm_service
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


@router.post("/chat/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    session_service = SessionService(db)
    message_service = MessageService(db)

    try:
        session = await session_service.get_session(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")

        user_message = await message_service.create_message(
            session_id=request.session_id,
            content=request.content,
            role=MessageRole.user,
        )

        try:
            ai_response = await llm_service.chat(request.content)
            entities = await llm_service.extract_entities(ai_response)
            keywords = await llm_service.extract_keywords(ai_response)
            relations = await llm_service.extract_relations(ai_response, entities)
        except Exception as llm_error:
            logger.warning(f"LLM service error, using fallback: {llm_error}")
            ai_response = generate_fallback_response(request.content)
            entities = [Entity(**e) for e in extract_fallback_entities(ai_response)]
            keywords = extract_fallback_keywords(ai_response)
            relations = []

        sources = [Source(**s) for s in MOCK_SOURCES]

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
    user_id: str = Depends(get_current_user),
):
    session_service = SessionService(db)
    message_service = MessageService(db)

    try:
        session = await session_service.get_session(request.session_id)
        if not session:
            # 🚨 给流式接口也加上自动创建会话的补丁
            print(f"⚠️ 流式接口发现未知的会话 ID: {request.session_id}，正在自动创建...")
            from app.models.chat import Session
            new_session = Session(
                id=request.session_id,
                user_id=user_id,
                title="新对话",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(new_session)
            await db.flush()
            session = new_session

        user_message = await message_service.create_message(
            session_id=request.session_id,
            content=request.content,
            role=MessageRole.user,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user message: {e}")
        raise HTTPException(status_code=500, detail=f"创建消息失败: {str(e)}")

    async def generate():
        full_content = ""
        accumulated_length = 0
        use_fallback = False
        
        try:
            try:
                async for chunk in llm_service.chat_stream(request.content):
                    full_content += chunk
                    accumulated_length += len(chunk)
                    
                    data = json.dumps({
                        "type": "content_chunk",
                        "content": chunk,
                        "accumulated_length": accumulated_length
                    }, ensure_ascii=False)
                    yield f"data: {data}\n\n"
            except Exception as llm_error:
                logger.warning(f"LLM stream error, using fallback: {llm_error}")
                use_fallback = True
                full_content = generate_fallback_response(request.content)
                
                for char in full_content:
                    accumulated_length += 1
                    data = json.dumps({
                        "type": "content_chunk",
                        "content": char,
                        "accumulated_length": accumulated_length
                    }, ensure_ascii=False)
                    yield f"data: {data}\n\n"
                    await asyncio.sleep(STREAM_CHUNK_DELAY)

            try:
                if use_fallback:
                    entities = [Entity(**e) for e in extract_fallback_entities(full_content)]
                    keywords = extract_fallback_keywords(full_content)
                    relations = []
                else:
                    entities = await llm_service.extract_entities(full_content)
                    keywords = await llm_service.extract_keywords(full_content)
                    relations = await llm_service.extract_relations(full_content, entities)
            except Exception as extract_error:
                logger.warning(f"Entity extraction error: {extract_error}")
                entities = [Entity(**e) for e in extract_fallback_entities(full_content)]
                keywords = extract_fallback_keywords(full_content)
                relations = []

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
                    "keywords": keywords
                }, ensure_ascii=False)
                yield f"data: {keywords_data}\n\n"

            if relations:
                relations_data = json.dumps({
                    "type": "relations",
                    "relations": [r.model_dump() for r in relations]
                }, ensure_ascii=False)
                yield f"data: {relations_data}\n\n"

            sources = [Source(**s) for s in MOCK_SOURCES]

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


@router.get("/chat/recommendations")
async def get_recommendations(
    session_id: Optional[str] = Query(None),
):
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
):
    try:
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
                )
                for e in msg.entities
            ]
            message_schemas.append(
                MessageSchema(
                    id=msg.id,
                    session_id=msg.session_id,
                    role=msg.role,
                    content=msg.content,
                    created_at=msg.created_at,
                    sources=sources,
                    entities=entities,
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
