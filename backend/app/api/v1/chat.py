from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import json

from app.core.database import get_db
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


def get_mock_user_id():
    return "default_user"


@router.post("/chat/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_mock_user_id),
):
    session_service = SessionService(db)
    message_service = MessageService(db)

    session = await session_service.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    user_message = await message_service.create_message(
        session_id=request.session_id,
        content=request.content,
        role=MessageRole.user,
    )

    ai_response = await llm_service.chat(request.content)

    mock_sources = [
        Source(
            id="1",
            title="《湖北地方志》卷三",
            content="武汉木雕技艺源远流长...",
            page=128,
            relevance=0.95,
        ),
        Source(
            id="2",
            title="武汉木雕传承人访谈",
            content="传统木雕技法需要多年磨练...",
            relevance=0.88,
        ),
    ]

    mock_entities = [
        Entity(id="1", name="武汉木雕", type=EntityType.technique, description="湖北地区传统雕刻工艺"),
        Entity(id="2", name="浮雕技法", type=EntityType.technique, description="在平面上雕刻凸起图案"),
        Entity(id="3", name="黄鹤楼", type=EntityType.work, description="武汉木雕代表作品"),
    ]

    ai_message = await message_service.create_message(
        session_id=request.session_id,
        content=ai_response,
        role=MessageRole.assistant,
        sources=mock_sources,
        entities=mock_entities,
        keywords=["木雕", "浮雕", "圆雕", "镂空雕"],
    )

    return ChatMessageResponse(
        message_id=ai_message.id,
        content=ai_message.content,
        role=ai_message.role,
        sources=mock_sources,
        entities=mock_entities,
        keywords=["木雕", "浮雕", "圆雕", "镂空雕"],
        created_at=ai_message.created_at.isoformat(),
    )


@router.post("/chat/stream")
async def send_message_stream(
    request: ChatMessageRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_mock_user_id),
):
    session_service = SessionService(db)
    message_service = MessageService(db)

    session = await session_service.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    user_message = await message_service.create_message(
        session_id=request.session_id,
        content=request.content,
        role=MessageRole.user,
    )

    async def generate():
        full_content = ""
        async for chunk in llm_service.chat_stream(request.content):
            full_content += chunk
            data = json.dumps({"type": "content", "content": chunk}, ensure_ascii=False)
            yield f"data: {data}\n\n"

        ai_message = await message_service.create_message(
            session_id=request.session_id,
            content=full_content,
            role=MessageRole.assistant,
        )

        complete_data = json.dumps(
            {
                "type": "complete",
                "response": {
                    "message_id": ai_message.id,
                    "content": full_content,
                    "role": "assistant",
                    "created_at": ai_message.created_at.isoformat(),
                },
            },
            ensure_ascii=False,
        )
        yield f"data: {complete_data}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/chat/recommendations")
async def get_recommendations(
    session_id: Optional[str] = Query(None),
):
    questions = [
        RecommendedQuestion(id="1", question="武汉木雕的传承人有哪些？"),
        RecommendedQuestion(id="2", question="浮雕技法的特点是什么？"),
        RecommendedQuestion(id="3", question="黄鹤楼木雕作品的历史背景？"),
        RecommendedQuestion(id="4", question="如何保护和传承传统木雕技艺？"),
    ]
    return {"questions": questions}


@router.post("/chat/message/{message_id}/feedback")
async def submit_feedback(
    message_id: str,
    request: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
):
    message_service = MessageService(db)
    message = await message_service.update_feedback(message_id, request.feedback)
    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")
    return {"success": True, "feedback": request.feedback}


@router.post("/chat/message/{message_id}/favorite", response_model=FavoriteResponse)
async def toggle_favorite(
    message_id: str,
    db: AsyncSession = Depends(get_db),
):
    message_service = MessageService(db)
    is_favorite = await message_service.toggle_favorite(message_id)
    if is_favorite is None:
        raise HTTPException(status_code=404, detail="消息不存在")
    return FavoriteResponse(is_favorite=is_favorite)


@router.get("/session", response_model=SessionListResponse)
async def list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_mock_user_id),
):
    session_service = SessionService(db)
    sessions, total = await session_service.get_user_sessions(user_id, page, page_size)
    
    return SessionListResponse(
        sessions=[SessionSchema.model_validate(s) for s in sessions],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/session", response_model=SessionSchema)
async def create_session(
    data: SessionCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_mock_user_id),
):
    session_service = SessionService(db)
    session = await session_service.create_session(user_id, data)
    return SessionSchema.model_validate(session)


@router.get("/session/{session_id}", response_model=SessionSchema)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    session_service = SessionService(db)
    session = await session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return SessionSchema.model_validate(session)


@router.put("/session/{session_id}", response_model=SessionSchema)
async def update_session(
    session_id: str,
    data: SessionUpdate,
    db: AsyncSession = Depends(get_db),
):
    session_service = SessionService(db)
    session = await session_service.update_session(session_id, data)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return SessionSchema.model_validate(session)


@router.delete("/session/{session_id}")
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    session_service = SessionService(db)
    success = await session_service.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"success": True}


@router.get("/session/{session_id}/messages", response_model=MessageListResponse)
async def get_session_messages(
    session_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
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
