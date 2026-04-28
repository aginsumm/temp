"""
对话主题跟踪系统
跟踪对话主题变化，提供上下文连贯性
"""
from typing import Optional, List, Dict
from datetime import datetime, timezone
from enum import Enum


class TopicCategory(Enum):
    """主题分类"""
    DEFINITION = "definition"
    HISTORY = "history"
    TECHNIQUE = "technique"
    INHERITOR = "inheritor"
    REGION = "region"
    PROTECTION = "protection"
    APPLICATION = "application"
    STORY = "story"
    COMPARISON = "comparison"
    GENERAL = "general"


class TopicTurn:
    """话题轮次"""
    def __init__(
        self,
        topic: str,
        category: TopicCategory,
        entities: Optional[List[str]] = None,
        timestamp: Optional[str] = None,
    ):
        self.topic = topic
        self.category = category
        self.entities = entities or []
        self.timestamp = timestamp or datetime.now(timezone.utc).isoformat()
        self.turn_count = 1
    
    def to_dict(self) -> dict:
        return {
            "topic": self.topic,
            "category": self.category.value,
            "entities": self.entities,
            "timestamp": self.timestamp,
            "turn_count": self.turn_count,
        }


class TopicTracker:
    """主题跟踪器"""
    
    def __init__(self, max_history: int = 10):
        self.max_history = max_history
        self.topic_history: List[TopicTurn] = []
        self.current_topic: Optional[TopicTurn] = None
        self.conversation_context: Dict = {
            "main_entities": [],
            "mentioned_regions": [],
            "mentioned_periods": [],
            "user_interests": [],
        }
    
    def update_topic(
        self,
        question: str,
        category: TopicCategory,
        entities: Optional[List[str]] = None,
    ) -> bool:
        """
        更新对话主题
        
        Args:
            question: 用户问题
            category: 主题分类
            entities: 相关实体
            
        Returns:
            bool: 是否发生了话题转换
        """
        # 提取主要话题（问题中的关键词）
        topic_keywords = self._extract_topic_keywords(question)
        
        # 判断是否发生话题转换
        topic_changed = self._is_topic_changed(topic_keywords, category)
        
        if topic_changed or self.current_topic is None:
            # 保存旧话题到历史
            if self.current_topic:
                self.topic_history.append(self.current_topic)
                if len(self.topic_history) > self.max_history:
                    self.topic_history = self.topic_history[-self.max_history:]
            
            # 创建新话题
            self.current_topic = TopicTurn(
                topic=topic_keywords,
                category=category,
                entities=entities or [],
            )
        else:
            # 同一话题，增加轮次
            self.current_topic.turn_count += 1
            if entities:
                for entity in entities:
                    if entity not in self.current_topic.entities:
                        self.current_topic.entities.append(entity)
        
        # 更新对话上下文
        self._update_context(entities, category)
        
        return topic_changed
    
    def _extract_topic_keywords(self, question: str) -> str:
        """提取话题关键词"""
        # 简单实现：提取问题中的名词短语
        # 实际应用中可以使用NLP工具
        keywords = []
        
        # 移除疑问词
        stop_words = ["什么", "怎么", "为什么", "哪些", "谁", "哪里", "如何"]
        for word in stop_words:
            question = question.replace(word, "")
        
        # 提取关键词（简单分词）
        heritage_keywords = ["非遗", "传承", "技艺", "工艺", "历史", "文化", "木雕", "刺绣", "陶瓷"]
        for kw in heritage_keywords:
            if kw in question:
                keywords.append(kw)
        
        return " ".join(keywords) if keywords else question[:20]
    
    def _is_topic_changed(self, new_keywords: str, new_category: TopicCategory) -> bool:
        """判断是否发生话题转换"""
        if not self.current_topic:
            return True
        
        # 类别不同
        if self.current_topic.category != new_category:
            return True
        
        # 关键词完全不同
        new_kw_set = set(new_keywords.split())
        old_kw_set = set(self.current_topic.topic.split())
        
        # 如果没有共同关键词，认为话题转换
        return len(new_kw_set & old_kw_set) == 0
    
    def _update_context(self, entities: Optional[List[str]], category: TopicCategory):
        """更新对话上下文"""
        if not entities:
            return
        
        for entity in entities:
            # 根据实体类型更新上下文
            if "传承人" in entity or "大师" in entity:
                if entity not in self.conversation_context["main_entities"]:
                    self.conversation_context["main_entities"].append(entity)
            
            if any(region in entity for region in ["武汉", "湖北", "苏州", "江苏"]):
                if entity not in self.conversation_context["mentioned_regions"]:
                    self.conversation_context["mentioned_regions"].append(entity)
            
            if any(period in entity for period in ["明代", "清代", "民国"]):
                if entity not in self.conversation_context["mentioned_periods"]:
                    self.conversation_context["mentioned_periods"].append(entity)
        
        # 限制上下文长度
        for key in self.conversation_context:
            if len(self.conversation_context[key]) > 20:
                self.conversation_context[key] = self.conversation_context[key][-20:]
    
    def get_context_summary(self) -> str:
        """获取上下文摘要"""
        summary_parts = []
        
        if self.current_topic:
            summary_parts.append(f"当前话题：{self.current_topic.topic}")
            summary_parts.append(f"话题类别：{self.current_topic.category.value}")
            summary_parts.append(f"对话轮次：{self.current_topic.turn_count}")
        
        if self.conversation_context["main_entities"]:
            summary_parts.append(f"主要实体：{', '.join(self.conversation_context['main_entities'][-5:])}")
        
        if self.conversation_context["mentioned_regions"]:
            summary_parts.append(f"提及地区：{', '.join(self.conversation_context['mentioned_regions'][-3:])}")
        
        return "\n".join(summary_parts)
    
    def get_topic_history(self) -> List[Dict]:
        """获取话题历史"""
        return [turn.to_dict() for turn in self.topic_history]
    
    def get_related_topics(self) -> List[str]:
        """获取相关话题建议"""
        if not self.current_topic:
            return []
        
        # 基于当前话题推荐相关话题
        related = []
        category = self.current_topic.category
        
        relation_map = {
            TopicCategory.HISTORY: [TopicCategory.TECHNIQUE, TopicCategory.INHERITOR],
            TopicCategory.TECHNIQUE: [TopicCategory.HISTORY, TopicCategory.APPLICATION],
            TopicCategory.INHERITOR: [TopicCategory.STORY, TopicCategory.TECHNIQUE],
            TopicCategory.REGION: [TopicCategory.TECHNIQUE, TopicCategory.HISTORY],
        }
        
        related_categories = relation_map.get(category, [])
        for rel_cat in related_categories:
            related.append(f"了解{rel_cat.value}相关内容")
        
        return related
    
    def reset(self):
        """重置跟踪器"""
        self.topic_history = []
        self.current_topic = None
        self.conversation_context = {
            "main_entities": [],
            "mentioned_regions": [],
            "mentioned_periods": [],
            "user_interests": [],
        }


# 单例
topic_tracker = TopicTracker()
