"""
回答质量评分系统
评估 AI 回答的准确性、完整性、可读性、安全性
"""
from typing import Dict, List, Optional
from enum import Enum
from app.services.dynamic_prompt import QuestionType, check_content_safety
import re


class QualityDimension(str, Enum):
    """质量维度"""
    ACCURACY = "accuracy"           # 准确性
    COMPLETENESS = "completeness"   # 完整性
    READABILITY = "readability"     # 可读性
    SAFETY = "safety"               # 安全性
    STRUCTURE = "structure"         # 结构性


class QualityLevel(str, Enum):
    """质量等级"""
    EXCELLENT = "excellent"  # 优秀 (>= 0.9)
    GOOD = "good"           # 良好 (>= 0.75)
    FAIR = "fair"           # 一般 (>= 0.6)
    POOR = "poor"           # 较差 (< 0.6)


class ResponseQualityEvaluator:
    """回答质量评估器"""

    # 各问题类型的关键信息要求
    QUESTION_TYPE_REQUIREMENTS = {
        QuestionType.DEFINITION: {
            "keywords": ["定义", "概念", "是", "指", "含义"],
            "sections": ["定义", "特征", "特点"],
            "min_length": 200,
        },
        QuestionType.HISTORY: {
            "keywords": ["历史", "起源", "发展", "年代", "时期", "朝代"],
            "sections": ["历史", "起源", "发展", "渊源"],
            "min_length": 300,
        },
        QuestionType.TECHNIQUE: {
            "keywords": ["工艺", "技法", "流程", "步骤", "制作", "技艺"],
            "sections": ["工艺", "技法", "流程", "步骤"],
            "min_length": 300,
        },
        QuestionType.INHERITOR: {
            "keywords": ["传承人", "大师", "艺人", "人物", "代表"],
            "sections": ["人物", "简介", "贡献", "作品"],
            "min_length": 250,
        },
        QuestionType.COMPARISON: {
            "keywords": ["区别", "不同", "对比", "比较", "差异", "相似"],
            "sections": ["特点", "差异", "对比", "共同点"],
            "min_length": 300,
        },
        QuestionType.REGION: {
            "keywords": ["地区", "地域", "地方", "产地", "分布"],
            "sections": ["地域", "地区", "特色", "分布"],
            "min_length": 250,
        },
        QuestionType.PROTECTION: {
            "keywords": ["保护", "现状", "传承", "措施", "政策"],
            "sections": ["现状", "保护", "措施", "挑战"],
            "min_length": 300,
        },
        QuestionType.APPLICATION: {
            "keywords": ["应用", "现代", "创新", "发展", "用途"],
            "sections": ["应用", "创新", "案例", "发展"],
            "min_length": 250,
        },
        QuestionType.STORY: {
            "keywords": ["故事", "传说", "典故", "趣闻", "背后"],
            "sections": ["故事", "背景", "内涵"],
            "min_length": 250,
        },
        QuestionType.RECOMMENDATION: {
            "keywords": ["推荐", "有哪些", "列举", "介绍"],
            "sections": ["推荐", "清单", "列表"],
            "min_length": 200,
        },
        QuestionType.HOW_TO: {
            "keywords": ["如何", "怎么", "方法", "步骤", "学习"],
            "sections": ["方法", "步骤", "指南", "路径"],
            "min_length": 250,
        },
        QuestionType.GENERAL: {
            "keywords": [],
            "sections": [],
            "min_length": 150,
        },
    }

    def evaluate(
        self,
        response: str,
        question: str,
        question_type: QuestionType,
        entities: Optional[List] = None
    ) -> Dict:
        """
        评估回答质量

        Args:
            response: AI 回答内容
            question: 用户问题
            question_type: 问题类型
            entities: 提取的实体列表

        Returns:
            Dict: 评分结果
        """
        scores = {}

        # 1. 准确性评分
        scores[QualityDimension.ACCURACY] = self._evaluate_accuracy(
            response, question_type, entities
        )

        # 2. 完整性评分
        scores[QualityDimension.COMPLETENESS] = self._evaluate_completeness(
            response, question_type
        )

        # 3. 可读性评分
        scores[QualityDimension.READABILITY] = self._evaluate_readability(response)

        # 4. 安全性评分
        scores[QualityDimension.SAFETY] = self._evaluate_safety(response)

        # 5. 结构性评分
        scores[QualityDimension.STRUCTURE] = self._evaluate_structure(response)

        # 计算总分（加权平均）
        weights = {
            QualityDimension.ACCURACY: 0.30,
            QualityDimension.COMPLETENESS: 0.25,
            QualityDimension.READABILITY: 0.20,
            QualityDimension.SAFETY: 0.15,
            QualityDimension.STRUCTURE: 0.10,
        }

        total_score = sum(scores[dim] * weights[dim] for dim in scores)

        # 确定质量等级
        if total_score >= 0.9:
            level = QualityLevel.EXCELLENT
        elif total_score >= 0.75:
            level = QualityLevel.GOOD
        elif total_score >= 0.6:
            level = QualityLevel.FAIR
        else:
            level = QualityLevel.POOR

        # 生成改进建议
        suggestions = self._generate_suggestions(scores, question_type)

        return {
            "total_score": round(total_score, 2),
            "level": level.value,
            "dimensions": {dim.value: round(score, 2) for dim, score in scores.items()},
            "suggestions": suggestions,
            "metadata": {
                "response_length": len(response),
                "question_type": question_type.value,
                "has_entities": bool(entities),
            }
        }

    def _evaluate_accuracy(
        self,
        response: str,
        question_type: QuestionType,
        entities: Optional[List]
    ) -> float:
        """评估准确性"""
        score = 0.5  # 基础分

        requirements = self.QUESTION_TYPE_REQUIREMENTS.get(
            question_type,
            self.QUESTION_TYPE_REQUIREMENTS[QuestionType.GENERAL]
        )

        # 检查是否包含关键信息
        keywords = requirements["keywords"]
        if keywords:
            keyword_count = sum(1 for kw in keywords if kw in response)
            keyword_score = min(keyword_count / len(keywords), 1.0)
            score += keyword_score * 0.3

        # 检查是否包含实体
        if entities and len(entities) > 0:
            score += 0.2

        # 检查是否有具体数据（年份、数字）
        has_year = bool(re.search(r'\d{3,4}年', response))
        has_number = bool(re.search(r'\d+', response))
        if has_year or has_number:
            score += 0.1

        # 检查是否有引用来源
        has_source = any(marker in response for marker in ['《', '》', '根据', '记载'])
        if has_source:
            score += 0.1

        return min(score, 1.0)

    def _evaluate_completeness(self, response: str, question_type: QuestionType) -> float:
        """评估完整性"""
        score = 0.5  # 基础分

        requirements = self.QUESTION_TYPE_REQUIREMENTS.get(
            question_type,
            self.QUESTION_TYPE_REQUIREMENTS[QuestionType.GENERAL]
        )

        # 检查长度是否达标
        min_length = requirements["min_length"]
        if len(response) >= min_length:
            score += 0.2
        elif len(response) >= min_length * 0.7:
            score += 0.1

        # 检查是否包含必要章节
        sections = requirements["sections"]
        if sections:
            section_count = sum(1 for sec in sections if sec in response)
            section_score = min(section_count / len(sections), 1.0)
            score += section_score * 0.3

        # 检查是否有多个段落
        paragraph_count = response.count('\n\n') + 1
        if paragraph_count >= 3:
            score += 0.1
        elif paragraph_count >= 2:
            score += 0.05

        # 检查是否有列表或要点
        has_list = bool(re.search(r'[•\-\d+\.]\s', response))
        if has_list:
            score += 0.1

        return min(score, 1.0)

    def _evaluate_readability(self, response: str) -> float:
        """评估可读性"""
        score = 0.5  # 基础分

        # 1. 句子长度适中（20-50字）
        sentences = re.split(r'[。！？]', response)
        sentences = [s.strip() for s in sentences if s.strip()]
        if sentences:
            avg_length = sum(len(s) for s in sentences) / len(sentences)
            if 20 <= avg_length <= 50:
                score += 0.2
            elif 15 <= avg_length <= 60:
                score += 0.1

        # 2. 使用 Markdown 格式
        has_markdown = any(marker in response for marker in ['##', '**', '•', '-', '1.'])
        if has_markdown:
            score += 0.15

        # 3. 段落结构清晰
        paragraph_count = response.count('\n\n') + 1
        if 3 <= paragraph_count <= 8:
            score += 0.1

        # 4. 避免过长段落
        paragraphs = response.split('\n\n')
        long_paragraphs = sum(1 for p in paragraphs if len(p) > 500)
        if long_paragraphs == 0:
            score += 0.1
        elif long_paragraphs <= 1:
            score += 0.05

        # 5. 使用语气词（增强亲和力）
        tone_words = ['呢', '呀', '哦', '啦', '吧', '！']
        tone_count = sum(response.count(word) for word in tone_words)
        if 1 <= tone_count <= 5:
            score += 0.05

        return min(score, 1.0)

    def _evaluate_safety(self, response: str) -> float:
        """评估安全性"""
        score = 1.0  # 默认满分

        # 1. 内容安全检查
        is_safe, reason = check_content_safety(response)
        if not is_safe:
            score -= 0.5
            print(f"⚠️ 安全检查失败: {reason}")

        # 2. 检查是否有不确定性声明（避免编造）
        uncertain_markers = [
            "不确定", "可能", "据说", "传说", "一说", "有待考证",
            "存在争议", "不同说法", "尚无定论"
        ]
        has_uncertainty = any(marker in response for marker in uncertain_markers)
        # 如果回答中有不确定的内容但没有声明，扣分
        speculative_words = ["应该", "大概", "估计", "或许"]
        has_speculation = any(word in response for word in speculative_words)
        if has_speculation and not has_uncertainty:
            score -= 0.1

        # 3. 检查是否有贬低性语言
        negative_words = ["落后", "低级", "粗糙", "简陋", "不如"]
        negative_count = sum(response.count(word) for word in negative_words)
        if negative_count > 2:
            score -= 0.2

        # 4. 检查是否编造具体人名、地名（简单启发式）
        # 如果有具体人名但没有称谓，可能是编造
        person_pattern = re.compile(r'[\u4e00-\u9fa5]{2,3}(?![先生|女士|大师|老师|师傅])')
        suspicious_names = person_pattern.findall(response)
        if len(suspicious_names) > 5:
            score -= 0.1

        return max(score, 0.0)

    def _evaluate_structure(self, response: str) -> float:
        """评估结构性"""
        score = 0.5  # 基础分

        # 1. 有标题层级
        h2_count = response.count('##')
        h3_count = response.count('###')
        if h2_count >= 2:
            score += 0.2
        elif h2_count >= 1:
            score += 0.1

        # 2. 有列表或要点
        list_markers = ['•', '-', '1.', '2.', '3.']
        has_list = any(marker in response for marker in list_markers)
        if has_list:
            score += 0.15

        # 3. 有加粗强调
        if '**' in response:
            score += 0.1

        # 4. 有表格（对比类问题）
        if '|' in response and '---' in response:
            score += 0.1

        # 5. 结构完整（开头、主体、结尾）
        has_intro = len(response.split('\n\n')[0]) < 200  # 开头简短
        has_conclusion = any(marker in response[-200:] for marker in ['总之', '综上', '因此', '所以'])
        if has_intro and has_conclusion:
            score += 0.05

        return min(score, 1.0)

    def _generate_suggestions(
        self,
        scores: Dict[QualityDimension, float],
        question_type: QuestionType
    ) -> List[str]:
        """生成改进建议"""
        suggestions = []

        # 准确性建议
        if scores[QualityDimension.ACCURACY] < 0.7:
            suggestions.append("建议增加具体的历史年代、人名、地名等准确信息")
            suggestions.append("建议引用权威资料来源，如《中国非物质文化遗产名录》")

        # 完整性建议
        if scores[QualityDimension.COMPLETENESS] < 0.7:
            requirements = self.QUESTION_TYPE_REQUIREMENTS.get(question_type)
            if requirements:
                missing_sections = [
                    sec for sec in requirements["sections"]
                    if sec not in str(scores)
                ]
                if missing_sections:
                    suggestions.append(f"建议补充以下内容：{', '.join(missing_sections[:3])}")

        # 可读性建议
        if scores[QualityDimension.READABILITY] < 0.7:
            suggestions.append("建议使用 Markdown 格式增强可读性（标题、列表、加粗）")
            suggestions.append("建议控制句子长度在 20-50 字，避免过长句子")

        # 安全性建议
        if scores[QualityDimension.SAFETY] < 0.9:
            suggestions.append("建议对不确定的内容明确说明，避免编造事实")

        # 结构性建议
        if scores[QualityDimension.STRUCTURE] < 0.7:
            suggestions.append("建议使用清晰的章节结构（## 标题）")
            suggestions.append("建议使用列表或要点归纳关键信息")

        return suggestions[:5]  # 最多返回 5 条建议


# 单例
response_quality_evaluator = ResponseQualityEvaluator()
