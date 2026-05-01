from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import itertools
import json
import logging
import re
import sys
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

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
    EntityType,
    Relation,
    RelationType,
    RecommendationRequest,
)
from app.services.chat_service import SessionService, MessageService
from app.services.llm_service import llm_service
from app.services.source_retrieval import retrieve_sources_from_knowledge
from app.services.question_generator import question_generator
from app.services.response_quality import response_quality_evaluator
from app.services.dynamic_prompt import classify_question
from app.models.chat import MessageRole

router = APIRouter(prefix="/api/v1", tags=["chat"])
logger = logging.getLogger(__name__)


def _sse_enrichment_pulse(stage: str) -> str:
    """后端在正文流结束后仍有长时间离线计算；发轻量 SSE 避免前端误判读超时断开。"""
    return f"data: {json.dumps({'type': 'enrichment', 'stage': stage}, ensure_ascii=False)}\n\n"

# 常量定义
MAX_ENTITIES = 5
MAX_KEYWORDS = 5
STREAM_CHUNK_DELAY = 0.03
MAX_CONTENT_LENGTH = 5000  # 最大输入长度


def generate_entity_id(name: str, entity_type: str) -> str:
    """生成一致的实体 ID（基于名称和类型的哈希）"""
    import hashlib
    key = f"{name.lower().strip()}_{entity_type}"
    hash_value = hashlib.md5(key.encode()).hexdigest()[:12]
    return f"ent_{hash_value}"


def dedupe_chat_entities(entities: list) -> list:
    """实体去重：过滤统称、合并传承人尊称变体（见 entity_quality.refine_chat_entities）。"""
    if not entities:
        return []
    from app.services.entity_quality import refine_chat_entities

    return refine_chat_entities(entities)


def dedupe_chat_relations(relations: list) -> list:
    """关系去重：基于 source-target-type 合并相同关系"""
    if not relations:
        return []
    seen: dict = {}
    for relation in relations:
        if getattr(relation, "bidirectional", False):
            source_target = tuple(sorted([relation.source, relation.target]))
            key = f"{source_target[0]}_{source_target[1]}_{relation.type}"
        else:
            key = f"{relation.source}_{relation.target}_{relation.type}"
        if key not in seen:
            seen[key] = relation
        else:
            existing = seen[key]
            if relation.confidence and (
                not existing.confidence or relation.confidence > existing.confidence
            ):
                existing.confidence = relation.confidence
    return list(seen.values())


REL_PRIORITY_ORDER = [
    "inherits",
    "creates",
    "origin",
    "located_in",
    "uses_material",
    "has_pattern",
    "flourished_in",
    "influenced_by",
    "contains",
    "related_to",
]


def _relation_type_str(rel: Any) -> str:
    t = getattr(rel, "type", None)
    if t is None:
        return "related_to"
    return t.value if hasattr(t, "value") else str(t)


def _relation_priority(rel: Any) -> int:
    s = _relation_type_str(rel)
    try:
        return REL_PRIORITY_ORDER.index(s)
    except ValueError:
        return len(REL_PRIORITY_ORDER)


def _pick_better_relation(a: Any, b: Any) -> Any:
    pa, pb = _relation_priority(a), _relation_priority(b)
    if pa != pb:
        return a if pa < pb else b
    ca, cb = (getattr(a, "confidence", None) or 0.0), (getattr(b, "confidence", None) or 0.0)
    return a if ca >= cb else b


def collapse_relations_one_per_pair(relations: list) -> list:
    """同一对节点（无序）只保留一条关系：优先语义更具体的类型，其次置信度更高。"""
    if not relations:
        return []
    groups: dict[tuple[str, str], list] = {}
    for rel in relations:
        s, t = getattr(rel, "source", ""), getattr(rel, "target", "")
        if not s or not t or s == t:
            continue
        key = tuple(sorted([str(s), str(t)]))
        groups.setdefault(key, []).append(rel)
    out: list = []
    for _key, rels in groups.items():
        best = rels[0]
        for r in rels[1:]:
            best = _pick_better_relation(best, r)
        out.append(best)
    return out


# 时期 / 传承人 / 地域 / 材料 / 技艺 / 纹样：与「另一非作品」连成边时须经过作品轴心（与 llm_service 关系抽取说明一致）
_WORK_ANCHOR_TYPES: frozenset[str] = frozenset(
    {
        EntityType.period.value,
        EntityType.inheritor.value,
        EntityType.region.value,
        EntityType.material.value,
        EntityType.technique.value,
        EntityType.pattern.value,
    }
)


def _repair_relation_orientations_to_match_llm_rules(entities: list, relations: list) -> list:
    """
    对齐 llm_service 中「作品轴心」边方向：
    flourished_in/located_in/uses_material/has_pattern → 作品(source) → 属性实体(target)
    creates → 技艺或传承人(source) → 作品(target)
    related_to → 至少一端为作品，否则丢弃。
    """
    if not relations:
        return []

    tmap = _entity_id_to_type(entities)
    w = EntityType.work.value
    pv, rv, mv, patv = (
        EntityType.period.value,
        EntityType.region.value,
        EntityType.material.value,
        EntityType.pattern.value,
    )
    tech, inher = EntityType.technique.value, EntityType.inheritor.value

    def etype(eid: object) -> Optional[str]:
        return tmap.get(str(eid)) if eid is not None else None

    def _rel_copy(rel: Relation, source: str, target: str) -> Relation:
        return Relation(
            id=rel.id,
            source=source,
            target=target,
            type=rel.type,
            confidence=getattr(rel, "confidence", None),
            evidence=getattr(rel, "evidence", None),
            bidirectional=bool(getattr(rel, "bidirectional", False)),
        )

    repaired: list = []
    for rel in relations:
        s_raw, t_raw = str(rel.source), str(rel.target)
        st, tt = etype(s_raw), etype(t_raw)
        rts = _relation_type_str(rel)

        if rts == "related_to":
            if st != w and tt != w:
                continue
            repaired.append(rel)
            continue

        if rts == "flourished_in":
            if st == w and tt == pv:
                repaired.append(rel)
            elif st == pv and tt == w:
                repaired.append(_rel_copy(rel, t_raw, s_raw))
            else:
                continue
            continue

        if rts == "located_in":
            if st == w and tt == rv:
                repaired.append(rel)
            elif st == rv and tt == w:
                repaired.append(_rel_copy(rel, t_raw, s_raw))
            else:
                continue
            continue

        if rts == "uses_material":
            if st == w and tt == mv:
                repaired.append(rel)
            elif st == mv and tt == w:
                repaired.append(_rel_copy(rel, t_raw, s_raw))
            else:
                continue
            continue

        if rts == "has_pattern":
            if st == w and tt == patv:
                repaired.append(rel)
            elif st == patv and tt == w:
                repaired.append(_rel_copy(rel, t_raw, s_raw))
            else:
                continue
            continue

        if rts == "creates":
            if (st == tech or st == inher) and tt == w:
                repaired.append(rel)
            elif (tt == tech or tt == inher) and st == w:
                repaired.append(_rel_copy(rel, t_raw, s_raw))
            else:
                continue
            continue

        repaired.append(rel)

    return repaired


def _entity_id_to_type(entities: list) -> dict[str, str]:
    m: dict[str, str] = {}
    for e in entities or []:
        eid = getattr(e, "id", None)
        if not eid:
            continue
        t = getattr(e, "type", None)
        m[str(eid)] = t.value if hasattr(t, "value") else str(t or "")
    return m


def _mention_start_index(haystack: str, entity: Any) -> int:
    """实体名在片段中首次出现的大致字符位置；找不到则置后以便排序淘汰。"""
    name = (getattr(entity, "name", None) or "").strip()
    if not name or not haystack:
        return 10**6
    if name in haystack:
        return haystack.index(name)
    inner = name.strip("《》").strip()
    if inner and inner != name and inner in haystack:
        return haystack.index(inner)
    compact_n = re.sub(r"[\s\u3000《》「」『』]", "", name)
    compact_h = re.sub(r"[\s\u3000《》「」『』]", "", haystack)
    if len(compact_n) >= 2 and compact_n in compact_h:
        return compact_h.index(compact_n)
    return 10**6


def entity_name_appears_in_text(name: str, text: str) -> bool:
    """判断实体名是否在全文中有提及（支持书名号、去空白紧凑匹配）。"""
    n = (name or "").strip()
    if not n or len(n) < 2:
        return False
    if not text:
        return False
    if n in text:
        return True
    inner = n.strip("《》").strip()
    if inner and inner != n and inner in text:
        return True
    compact_n = re.sub(r"[\s\u3000《》「」『』]", "", n)
    compact_t = re.sub(r"[\s\u3000《》「」『』]", "", text)
    if len(compact_n) >= 2 and compact_n in compact_t:
        return True
    return False


def filter_relations_anchor_only_with_work(entities: list, relations: list) -> list:
    """去掉「时期/传承人/地域/材料/技艺」与非作品之间的边；端点不在实体表中的边也丢弃。

    若当前实体列表中没有任何 work：模型常把代表作标成 technique 等，轴心规则会把边删光；
    此时只做端点有效性校验，保留 LLM 边（仍有 collapse/dedupe）。"""
    if not relations:
        return []
    tmap = _entity_id_to_type(entities)
    work_val = EntityType.work.value
    valid_ids = frozenset(tmap.keys())
    has_work = any(v == work_val for v in tmap.values())

    out: list = []
    for rel in relations:
        s = str(getattr(rel, "source", "") or "")
        t = str(getattr(rel, "target", "") or "")
        if not s or not t or s == t:
            continue
        if s not in valid_ids or t not in valid_ids:
            continue
        if not has_work:
            out.append(rel)
            continue
        st = tmap.get(s)
        tt = tmap.get(t)
        if st is None or tt is None:
            continue
        if st in _WORK_ANCHOR_TYPES and tt != work_val:
            continue
        if tt in _WORK_ANCHOR_TYPES and st != work_val:
            continue
        out.append(rel)
    return out


def enrich_relations_for_chat(
    text: str,
    entities: list,
    relations: list,
    *,
    max_new_edges: int = 120,
) -> list:
    """
    仅在「同一子句」内、按与作品的**文字距离最近**补类型边，避免一篇里所有时期/技法都与同一作品互连：
    - 每个子句内：每个作品至多 1 条时期、1 条地域、1 条材料、1 条纹样；
    - 每个子句内：每个作品至多接 1 条「技艺→作品 creates」、1 条「传承人→作品 creates」。
    不补 related_to。不增加 LLM 调用。
    """
    text_full = str(text or "").strip()
    if len(text_full) < 2 or len(entities) < 2 or max_new_edges <= 0:
        return list(relations) if relations else []

    out: list = list(relations or [])

    def pair_key(a_id: str, b_id: str) -> tuple[str, str]:
        return tuple(sorted([str(a_id), str(b_id)]))

    seen = {
        pair_key(r.source, r.target)
        for r in out
        if getattr(r, "source", None) and getattr(r, "target", None)
    }

    def etype_val(e: Any) -> str:
        t = getattr(e, "type", None)
        return t.value if hasattr(t, "value") else str(t or "technique")

    def try_append(rel: Relation) -> bool:
        nonlocal max_new_edges
        if max_new_edges <= 0:
            return False
        pk = pair_key(rel.source, rel.target)
        if pk in seen:
            return False
        out.append(rel)
        seen.add(pk)
        max_new_edges -= 1
        return True

    wv = EntityType.work.value
    ordered = sorted(
        entities,
        key=lambda e: len((getattr(e, "name", None) or "").strip()),
        reverse=True,
    )

    chunks = [c.strip() for c in re.split(r"[。！？;；]+|\n+", text_full) if len(c.strip()) >= 4]

    for sent in chunks:
        present: list = []
        seen_ids: set[str] = set()
        for e in ordered:
            name = (getattr(e, "name", None) or "").strip()
            eid = getattr(e, "id", None)
            if not name or not eid or len(name) < 2:
                continue
            if not entity_name_appears_in_text(name, sent):
                continue
            sid = str(eid)
            if sid in seen_ids:
                continue
            seen_ids.add(sid)
            present.append(e)
        if len(present) < 2:
            continue
        present = present[:18]

        works = [e for e in present if etype_val(e) == wv]
        if not works:
            continue

        def _greedy_work_attr(attr_type: str, rtype: RelationType) -> None:
            attrs = [e for e in present if etype_val(e) == attr_type]
            if not attrs:
                return
            for w in works:
                if max_new_edges <= 0:
                    return
                iw = _mention_start_index(sent, w)
                best_a = None
                best_d = 10**9
                for a in attrs:
                    ia = _mention_start_index(sent, a)
                    d = abs(iw - ia)
                    if d < best_d:
                        best_d = d
                        best_a = a
                if best_a is None:
                    continue
                aid = str(getattr(best_a, "id", ""))
                wid = str(getattr(w, "id", ""))
                rel = Relation(
                    id=f"rel_ty_{uuid.uuid4().hex[:16]}",
                    source=wid,
                    target=aid,
                    type=rtype,
                    confidence=0.58,
                    evidence="type-rule+nearest-in-sentence",
                )
                try_append(rel)

        _greedy_work_attr(EntityType.period.value, RelationType.flourished_in)
        _greedy_work_attr(EntityType.region.value, RelationType.located_in)
        _greedy_work_attr(EntityType.material.value, RelationType.uses_material)
        _greedy_work_attr(EntityType.pattern.value, RelationType.has_pattern)

        techs = [e for e in present if etype_val(e) == EntityType.technique.value]
        inheritors = [e for e in present if etype_val(e) == EntityType.inheritor.value]

        for w in works:
            if max_new_edges <= 0:
                break
            iw = _mention_start_index(sent, w)
            wid = str(getattr(w, "id", ""))

            best_t = None
            best_td = 10**9
            for t in techs:
                it = _mention_start_index(sent, t)
                d = abs(iw - it)
                if d < best_td:
                    best_td = d
                    best_t = t
            if best_t is not None:
                tid = str(getattr(best_t, "id", ""))
                rel = Relation(
                    id=f"rel_ty_{uuid.uuid4().hex[:16]}",
                    source=tid,
                    target=wid,
                    type=RelationType.creates,
                    confidence=0.58,
                    evidence="type-rule+nearest-in-sentence",
                )
                try_append(rel)

            best_i = None
            best_id = 10**9
            for inh in inheritors:
                ii = _mention_start_index(sent, inh)
                d = abs(iw - ii)
                if d < best_id:
                    best_id = d
                    best_i = inh
            if best_i is not None:
                iid = str(getattr(best_i, "id", ""))
                rel = Relation(
                    id=f"rel_ty_{uuid.uuid4().hex[:16]}",
                    source=iid,
                    target=wid,
                    type=RelationType.creates,
                    confidence=0.58,
                    evidence="type-rule+nearest-in-sentence",
                )
                try_append(rel)

    return out


def finalize_chat_relations_for_message(text: str, entities: list, relations: list) -> list:
    """LLM 关系 → 去重 → 按作品轴心纠正方向 → 同句最近邻补边 → 再去重 → 每对一条边 → 强轴心过滤。"""
    relations = dedupe_chat_relations(relations or [])
    relations = _repair_relation_orientations_to_match_llm_rules(entities, relations)
    relations = enrich_relations_for_chat(text, entities, relations)
    relations = dedupe_chat_relations(relations)
    relations = collapse_relations_one_per_pair(relations)
    relations = filter_relations_anchor_only_with_work(entities, relations)
    return relations


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
        # 输入验证
        if not request.content or not request.content.strip():
            raise HTTPException(status_code=400, detail="消息内容不能为空")
        
        if len(request.content) > MAX_CONTENT_LENGTH:
            raise HTTPException(
                status_code=400, 
                detail=f"消息内容过长，最大支持{MAX_CONTENT_LENGTH}字"
            )
        
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
        entities = dedupe_chat_entities(entities)
        relations = await llm_service.extract_relations(ai_response, entities)
        relations = finalize_chat_relations_for_message(ai_response, entities, relations)

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
        # 输入验证
        if not request.content or not request.content.strip():
            raise HTTPException(status_code=400, detail="消息内容不能为空")
        
        if len(request.content) > MAX_CONTENT_LENGTH:
            raise HTTPException(
                status_code=400, 
                detail=f"消息内容过长，最大支持{MAX_CONTENT_LENGTH}字"
            )
        
        session = await session_service.get_session(request.session_id)
        session_created = False
        
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
            session_created = True

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

        # 流式正文 + 实体/关系提取可达数十秒：若不先提交，SQLite 会话事务会一直占写锁，
        # 并发创建会话等请求会 database is locked；其它库也可受益（尽早缩短事务）。
        await db.commit()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user message: {e}")
        raise HTTPException(status_code=500, detail=f"创建消息失败: {str(e)}")

    async def generate():
        full_content = ""
        accumulated_length = 0
        estimated_length = len(request.content) * 3  # 初始估算响应长度（基于输入长度的 3 倍）
        last_progress_sent = 0
        dynamic_adjustment_enabled = True  # 启用动态调整
        
        try:
            # 发送开始事件，包含预估长度
            start_data = json.dumps({
                "type": "start",
                "estimated_length": estimated_length,
                "dynamic_adjustment": dynamic_adjustment_enabled  # 告知前端是否启用动态调整
            }, ensure_ascii=False)
            yield f"data: {start_data}\n\n"
            sys.stdout.flush()
            
            # 如果会话是刚创建的，通知前端
            if session_created:
                session_info = json.dumps({
                    "type": "session_created",
                    "session_id": session.id,
                    "title": session.title
                }, ensure_ascii=False)
                yield f"data: {session_info}\n\n"
                sys.stdout.flush()
            
            if request.resume_from is not None:
                yield f"data: {json.dumps({'type': 'resume', 'offset': request.resume_from}, ensure_ascii=False)}\n\n"
                sys.stdout.flush()
            
            # 使用处理后的 user_content（包含 file_urls 引用等），确保模型输入与持久化一致
            async for chunk in llm_service.chat_stream(user_content):
                full_content += chunk
                accumulated_length += len(chunk)
                
                # 动态调整估算长度（如果实际长度超过估算）
                if dynamic_adjustment_enabled and accumulated_length > estimated_length:
                    # 使用实际长度的 1.2 倍作为新估算，留出余量
                    estimated_length = int(accumulated_length * 1.2)
                
                # 发送内容块
                data = json.dumps({
                    "type": "content_chunk",
                    "content": chunk,
                    "accumulated_length": accumulated_length
                }, ensure_ascii=False)
                yield f"data: {data}\n\n"
                sys.stdout.flush()
                
                # 每 300 字符发送一次进度更新
                if accumulated_length - last_progress_sent >= 300:
                    progress_data = json.dumps({
                        "type": "progress",
                        "current_length": accumulated_length,
                        "estimated_total": estimated_length,
                        "percent_complete": min(100, round(accumulated_length / max(estimated_length, 1) * 100)),
                        "is_dynamic": dynamic_adjustment_enabled  # 告知前端是否使用了动态调整
                    }, ensure_ascii=False)
                    yield f"data: {progress_data}\n\n"
                    sys.stdout.flush()
                    last_progress_sent = accumulated_length

            # 正文流式结束后：先完成实体/关键词/关系提取与入库，再发送 complete（含真实 message_id 与图谱字段），
            # 否则前端在 [DONE] 后断开，无法收到后台才写入的关键词与图谱数据。
            yield _sse_enrichment_pulse("reply_stream_done")
            sys.stdout.flush()
            entities: list = []
            keywords: List[str] = []
            relations: list = []
            sources: list = []
            message_id: Optional[str] = None
            save_success = False

            try:
                yield _sse_enrichment_pulse("extract_entities")
                sys.stdout.flush()
                entities = await llm_service.extract_entities(full_content)
                yield _sse_enrichment_pulse("extract_keywords")
                sys.stdout.flush()
                keywords = await llm_service.extract_keywords(full_content)
                entities = dedupe_chat_entities(entities)
                yield _sse_enrichment_pulse("extract_relations")
                sys.stdout.flush()
                relations = await llm_service.extract_relations(full_content, entities)
                relations = finalize_chat_relations_for_message(full_content, entities, relations)
                yield _sse_enrichment_pulse("retrieve_sources")
                sys.stdout.flush()
                sources = await retrieve_sources_from_knowledge(db, request.content, entities)

                question_type = classify_question(request.content)
                quality_score = response_quality_evaluator.evaluate(
                    response=full_content,
                    question=request.content,
                    question_type=question_type,
                    entities=entities,
                )
                logger.info(f"📊 回答质量评分: {quality_score['total_score']} ({quality_score['level']})")
                if quality_score["total_score"] < 0.6:
                    logger.warning(f"⚠️ 回答质量较低，建议改进: {quality_score['suggestions']}")

                yield _sse_enrichment_pulse("persist_message")
                sys.stdout.flush()
                max_save_retries = 3
                for attempt in range(max_save_retries):
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
                        save_success = True
                        break
                    except Exception as db_error:
                        logger.error(
                            f"Error saving AI message (attempt {attempt + 1}/{max_save_retries}): {db_error}",
                            exc_info=True,
                        )
                        if attempt < max_save_retries - 1:
                            await asyncio.sleep(0.5 * (attempt + 1))
                        else:
                            logger.error(f"Failed to save message after {max_save_retries} attempts")

                if not save_success:
                    logger.critical("Message persistence failed after stream")
                else:
                    logger.info(f"Message saved successfully with ID: {message_id}")
            except Exception as enrichment_error:
                logger.error(f"Stream enrichment failed: {enrichment_error}", exc_info=True)

            def _dump_model(obj: Any) -> dict:
                if hasattr(obj, "model_dump"):
                    return obj.model_dump(mode="json")
                return {}

            complete_payload = {
                "type": "complete",
                "message_id": message_id or f"msg_{datetime.now(timezone.utc).timestamp()}",
                "content": full_content,
                "sources": [_dump_model(s) for s in sources] if sources else [],
                "entities": [_dump_model(e) for e in entities] if entities else [],
                "keywords": [k for k in keywords if isinstance(k, str)],
                "relations": [_dump_model(r) for r in relations] if relations else [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "role": "assistant",
                "saved_to_db": save_success,
                "is_fallback_id": not save_success,
            }
            yield f"data: {json.dumps(complete_payload, ensure_ascii=False)}\n\n"
            sys.stdout.flush()
            yield "data: [DONE]\n\n"
            sys.stdout.flush()

        except Exception as e:
            logger.error(f"Stream error: {e}", exc_info=True)
            # 生成重试 token（基于会话 ID、请求内容哈希和时间戳）
            import hashlib
            # 使用更多维度生成唯一 retry_token，确保恢复时能验证一致性
            token_source = f"{request.session_id}:{request.content}:{accumulated_length}:{datetime.now(timezone.utc).timestamp()}"
            retry_token = hashlib.sha256(token_source.encode()).hexdigest()[:16]
            
            error_data = json.dumps({
                "type": "error",
                "code": "STREAM_ERROR",
                "message": str(e),
                "recoverable": True,
                "retry_token": retry_token,
                "partial_content": full_content,
                "accumulated_length": accumulated_length,
                "session_id": request.session_id,  # 新增：会话 ID，用于恢复时验证
                "can_resume_from": accumulated_length if full_content else None  # 新增：可续传位置
            }, ensure_ascii=False)
            yield f"data: {error_data}\n\n"
            sys.stdout.flush()

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

        # 使用 UTC 时间，确保时区一致性
        hour = datetime.now(timezone.utc).hour
        # 转换为北京时间（UTC+8）
        beijing_hour = (hour + 8) % 24
        
        if 6 <= beijing_hour < 12:
            time_of_day = 'morning'
        elif 12 <= beijing_hour < 18:
            time_of_day = 'afternoon'
        elif 18 <= beijing_hour < 23:
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
        return SessionSchema(**parse_session_tags(session))
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

        # 权限检查：验证用户是否有权访问该会话
        session = await session_service.get_session(original_message.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")
        if session.user_id != user_id:
            raise HTTPException(status_code=403, detail="无权操作该消息")

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
        entities = dedupe_chat_entities(entities)
        relations = await llm_service.extract_relations(ai_response, entities)
        relations = finalize_chat_relations_for_message(ai_response, entities, relations)
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

        # 权限检查：验证用户是否有权访问该会话
        session = await session_service.get_session(original_message.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")
        if session.user_id != user_id:
            raise HTTPException(status_code=403, detail="无权操作该消息")

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
                sys.stdout.flush()

            yield _sse_enrichment_pulse("reply_stream_done")
            sys.stdout.flush()
            entities: list = []
            keywords: List[str] = []
            relations: list = []
            sources: list = []
            try:
                yield _sse_enrichment_pulse("extract_entities")
                sys.stdout.flush()
                entities = await llm_service.extract_entities(full_content)
                yield _sse_enrichment_pulse("extract_keywords")
                sys.stdout.flush()
                keywords = await llm_service.extract_keywords(full_content)
                entities = dedupe_chat_entities(entities)
                yield _sse_enrichment_pulse("extract_relations")
                sys.stdout.flush()
                relations = await llm_service.extract_relations(full_content, entities)
                relations = finalize_chat_relations_for_message(full_content, entities, relations)
                yield _sse_enrichment_pulse("retrieve_sources")
                sys.stdout.flush()
                sources = await retrieve_sources_from_knowledge(db, user_message.content, entities)
                yield _sse_enrichment_pulse("persist_message")
                sys.stdout.flush()
                await message_service.update_message(
                    message_id=message_id,
                    content=full_content,
                    sources=sources,
                    entities=entities,
                    keywords=keywords,
                    relations=relations,
                )
                logger.info(f"Message {message_id} updated successfully (stream regen)")
            except Exception as enrichment_error:
                logger.error(f"Stream regeneration enrichment failed: {enrichment_error}", exc_info=True)

            def _dump_model(obj: Any) -> dict:
                if hasattr(obj, "model_dump"):
                    return obj.model_dump(mode="json")
                return {}

            complete_payload = {
                "type": "complete",
                "message_id": message_id,
                "content": full_content,
                "sources": [_dump_model(s) for s in sources] if sources else [],
                "entities": [_dump_model(e) for e in entities] if entities else [],
                "keywords": [k for k in keywords if isinstance(k, str)],
                "relations": [_dump_model(r) for r in relations] if relations else [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "role": "assistant",
                "saved_to_db": True,
                "is_fallback_id": False,
            }
            yield f"data: {json.dumps(complete_payload, ensure_ascii=False)}\n\n"
            sys.stdout.flush()
            yield "data: [DONE]\n\n"
            sys.stdout.flush()

        except Exception as e:
            logger.error(f"Stream regeneration error: {e}")
            yield f"data: {json.dumps({
                'type': 'error',
                'code': 'STREAM_ERROR',
                'message': str(e),
                'recoverable': True
            }, ensure_ascii=False)}\n\n"
            sys.stdout.flush()

    return StreamingResponse(generate(), media_type="text/event-stream")
