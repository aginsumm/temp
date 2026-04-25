"""
智能推荐问题生成器
基于上下文、实体和用户历史生成个性化推荐问题
"""

import random
from typing import List, Dict, Optional
from datetime import datetime, timedelta

class SmartQuestionGenerator:
    """智能问题生成器"""
    
    # 问题模板库
    TEMPLATES = {
        'history': [
            "{entity} 的历史起源是什么？",
            "{entity} 有哪些重要的发展阶段？",
            "{entity} 在哪个朝代最为兴盛？",
            "{entity} 的创始人是谁？",
        ],
        'technique': [
            "{entity} 的核心技艺有哪些？",
            "如何学习 {entity}？",
            "{entity} 的制作流程是怎样的？",
            "{entity} 需要哪些工具和材料？",
        ],
        'inheritor': [
            "谁是 {entity} 的代表性传承人？",
            "{entity} 是如何传承的？",
            "{entity} 收徒的标准是什么？",
            "如何联系 {entity} 学习？",
        ],
        'region': [
            "{entity} 地区有哪些特色非遗项目？",
            "{entity} 的地理环境对非遗有什么影响？",
            "去 {entity} 能体验哪些非遗活动？",
            "{entity} 的非遗保护政策如何？",
        ],
        'work': [
            "{entity} 有哪些代表作品？",
            "{entity} 的艺术特色是什么？",
            "{entity} 的制作工艺有何独特之处？",
            "如何欣赏 {entity}？",
        ],
        'comparison': [
            "{entity1} 和 {entity2} 有什么区别？",
            "{entity1} 与 {entity2} 哪个更难学？",
            "{entity1} 和 {entity2} 可以一起使用吗？",
        ],
        'application': [
            "如何在现代生活中应用 {entity}？",
            "{entity} 有哪些创新应用？",
            "{entity} 的市场前景如何？",
            "如何将 {entity} 与科技结合？",
        ],
        'protection': [
            "{entity} 面临哪些传承困境？",
            "如何保护濒危的 {entity}？",
            "{entity} 的数字化保护有哪些方式？",
            "年轻人对 {entity} 的态度如何？",
        ],
    }
    
    # 时间相关的推荐问题
    TIME_BASED_QUESTIONS = {
        'morning': [
            "早上好！想了解哪些非遗知识开始新的一天？",
            "清晨时光，不妨了解一门传统技艺？",
        ],
        'afternoon': [
            "下午好！想探索哪些非遗文化？",
            "午后闲暇，来了解一项传统工艺？",
        ],
        'evening': [
            "晚上好！想深入了解哪些非遗故事？",
            "夜晚静谧，来聆听传承人的故事？",
        ],
        'night': [
            "夜深了，还在研究非遗文化吗？",
            "深夜学习，注意休息哦~",
        ],
    }
    
    # 热门问题（基于统计）
    POPULAR_QUESTIONS = [
        "什么是非物质文化遗产？",
        "如何成为非遗传承人？",
        "中国有哪些世界级非遗项目？",
        "非遗保护有哪些重要意义？",
        "传统技艺如何与现代生活结合？",
        "非遗传承面临哪些挑战？",
        "武汉木雕有哪些代表性技法？",
        "汉绣的基本针法有哪些？",
        "湖北有哪些非遗传承人？",
        "黄鹤楼的历史传说有哪些？",
    ]
    
    def __init__(self):
        self.question_history: Dict[str, int] = {}  # 记录问题被问的次数
        self.last_recommendations: List[str] = []  # 上一次的推荐
        
    def generate_recommendations(
        self,
        entities: Optional[List[Dict]] = None,
        keywords: Optional[List[str]] = None,
        context: Optional[str] = None,
        time_of_day: Optional[str] = None,
        limit: int = 6
    ) -> List[Dict[str, str]]:
        """
        生成个性化推荐问题
        
        Args:
            entities: 实体列表，每个实体包含 name 和 type
            keywords: 关键词列表
            context: 上下文内容
            time_of_day: 时间段 (morning/afternoon/evening/night)
            limit: 返回问题数量
            
        Returns:
            推荐问题列表
        """
        questions = []
        
        # 1. 基于实体生成问题（优先级最高）
        if entities:
            entity_questions = self._generate_from_entities(entities, limit // 2)
            questions.extend(entity_questions)
        
        # 2. 基于关键词生成问题
        if keywords and len(questions) < limit:
            keyword_questions = self._generate_from_keywords(keywords, limit - len(questions))
            questions.extend(keyword_questions)
        
        # 3. 添加时间相关的问候问题
        if time_of_day and len(questions) < limit:
            time_questions = self._get_time_based_questions(time_of_day)
            questions.extend(time_questions)
        
        # 4. 补充热门问题
        while len(questions) < limit:
            popular = random.choice(self.POPULAR_QUESTIONS)
            if popular not in questions:
                questions.append(popular)
        
        # 5. 去重并限制数量
        unique_questions = self._deduplicate(questions)
        return [
            {"id": f"rec_{i}_{hash(q) % 10000}", "question": q}
            for i, q in enumerate(unique_questions[:limit])
        ]
    
    def _generate_from_entities(
        self,
        entities: List[Dict],
        limit: int
    ) -> List[str]:
        """基于实体生成问题"""
        questions = []
        
        # 按类型分组实体
        entities_by_type: Dict[str, List[str]] = {}
        for entity in entities:
            entity_type = entity.get('type', 'technique')
            entity_name = entity.get('name', '')
            if entity_name:
                if entity_type not in entities_by_type:
                    entities_by_type[entity_type] = []
                entities_by_type[entity_type].append(entity_name)
        
        # 为每种类型的实体生成问题
        for entity_type, names in entities_by_type.items():
            templates = self.TEMPLATES.get(entity_type, self.TEMPLATES['technique'])
            
            for name in names[:2]:  # 每个实体最多生成 2 个问题
                template = random.choice(templates)
                question = template.format(entity=name)
                if question not in questions:
                    questions.append(question)
                    
                if len(questions) >= limit:
                    return questions
        
        # 如果有多个实体，生成对比类问题
        all_names = [name for names in entities_by_type.values() for name in names]
        if len(all_names) >= 2:
            comparison_entities = random.sample(all_names, 2)
            comparison_template = random.choice(self.TEMPLATES['comparison'])
            comparison_question = comparison_template.format(
                entity1=comparison_entities[0],
                entity2=comparison_entities[1]
            )
            questions.append(comparison_question)
        
        return questions
    
    def _generate_from_keywords(
        self,
        keywords: List[str],
        limit: int
    ) -> List[str]:
        """基于关键词生成问题"""
        questions = []
        
        general_templates = [
            "什么是{keyword}？",
            "{keyword} 有哪些特点？",
            "如何了解 {keyword}？",
            "{keyword} 的历史是什么？",
        ]
        
        for keyword in keywords[:limit]:
            template = random.choice(general_templates)
            question = template.format(keyword=keyword)
            if question not in questions:
                questions.append(question)
        
        return questions
    
    def _get_time_based_questions(self, time_of_day: str) -> List[str]:
        """获取基于时间的推荐问题"""
        questions = self.TIME_BASED_QUESTIONS.get(time_of_day, [])
        return random.sample(questions, min(2, len(questions)))
    
    def _deduplicate(self, questions: List[str]) -> List[str]:
        """去重，优先保留多样性"""
        seen = set()
        unique = []
        
        for q in questions:
            # 简单的去重逻辑
            if q not in seen:
                seen.add(q)
                unique.append(q)
        
        return unique
    
    def get_popular_questions(self, limit: int = 10) -> List[str]:
        """获取热门问题"""
        return random.sample(self.POPULAR_QUESTIONS, min(limit, len(self.POPULAR_QUESTIONS)))
    
    def get_question_categories(self) -> Dict[str, List[str]]:
        """获取问题分类模板"""
        return {
            '技艺探索': self.TEMPLATES['technique'],
            '历史文化': self.TEMPLATES['history'],
            '传承人物': self.TEMPLATES['inheritor'],
            '地域特色': self.TEMPLATES['region'],
            '作品欣赏': self.TEMPLATES['work'],
            '对比分析': self.TEMPLATES['comparison'],
            '应用创新': self.TEMPLATES['application'],
            '保护传承': self.TEMPLATES['protection'],
        }


# 单例
question_generator = SmartQuestionGenerator()
