from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
import logging

from app.models.knowledge import Entity
from app.schemas.chat import Source

logger = logging.getLogger(__name__)

DEFAULT_SOURCES = [
    {
        "id": "default_1",
        "title": "《中国非物质文化遗产保护名录》",
        "content": "详细记录了国家级非遗项目的传承谱系、技艺特点和保护措施",
        "page": 128,
        "relevance": 0.85,
    },
    {
        "id": "default_2",
        "title": "《地方志·传统技艺卷》",
        "content": "记载了传统技艺的历史渊源、发展脉络和地域特色",
        "page": 56,
        "relevance": 0.75,
    },
]


async def retrieve_sources_from_knowledge(
    db: AsyncSession,
    content: str,
    entities: Optional[List] = None,
    max_sources: int = 3
) -> List[Source]:
    """
    根据用户问题和提取的实体，从知识库动态检索相关来源
    
    Args:
        db: 数据库会话
        content: 用户问题内容
        entities: 从回答中提取的实体列表
        max_sources: 最大返回来源数量
    
    Returns:
        相关来源列表
    """
    try:
        sources = []
        search_terms = []
        
        # 1. 从问题中提取关键词
        if content:
            # 简单分词：提取长度 >= 2 的中文字词
            import re
            chinese_words = re.findall(r'[\u4e00-\u9fa5]{2,8}', content)
            search_terms.extend(chinese_words[:5])  # 最多取5个关键词
        
        # 2. 从实体中提取名称
        if entities:
            entity_names = [e.name for e in entities if hasattr(e, 'name')]
            search_terms.extend(entity_names)
        
        # 3. 去重搜索词
        search_terms = list(set(search_terms))
        
        if not search_terms:
            # 无搜索词时返回默认来源
            return [Source(**s) for s in DEFAULT_SOURCES[:max_sources]]
        
        # 4. 在知识库中搜索匹配的实体
        conditions = []
        for term in search_terms[:3]:  # 最多用3个词搜索
            conditions.append(Entity.name.ilike(f"%{term}%"))
            conditions.append(Entity.description.ilike(f"%{term}%"))
        
        if conditions:
            query = select(Entity).where(or_(*conditions)).limit(max_sources * 2)
            result = await db.execute(query)
            matched_entities = result.scalars().all()
            
            # 5. 将匹配的实体转换为来源
            for idx, entity in enumerate(matched_entities[:max_sources]):
                relevance = 0.9 - (idx * 0.05)  # 递减相关度
                source = Source(
                    id=f"source_{entity.id}",
                    title=f"《{entity.name}》",
                    content=entity.description or f"关于{entity.name}的相关资料",
                    relevance=round(relevance, 2),
                )
                sources.append(source)
        
        # 6. 如果搜索结果不足，补充默认来源
        if len(sources) < max_sources:
            remaining = max_sources - len(sources)
            for default_source in DEFAULT_SOURCES[:remaining]:
                source = Source(**default_source)
                if source not in sources:
                    sources.append(source)
        
        return sources[:max_sources]
        
    except Exception as e:
        logger.error(f"Error retrieving sources: {e}")
        # 出错时返回默认来源
        return [Source(**s) for s in DEFAULT_SOURCES[:max_sources]]


async def get_default_sources(max_sources: int = 3) -> List[Source]:
    """获取默认来源列表"""
    return [Source(**s) for s in DEFAULT_SOURCES[:max_sources]]
