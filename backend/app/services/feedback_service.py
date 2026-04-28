"""
用户反馈闭环系统
收集用户反馈用于优化Prompt模板和回答质量
"""
from typing import Optional, Dict, List
from datetime import datetime, timezone
import json
import os


class FeedbackEntry:
    """反馈记录"""
    def __init__(
        self,
        message_id: str,
        question: str,
        answer: str,
        is_helpful: bool,
        feedback_text: Optional[str] = None,
        question_type: Optional[str] = None,
        emotion: Optional[str] = None,
        confidence_score: Optional[float] = None,
    ):
        self.message_id = message_id
        self.question = question
        self.answer = answer
        self.is_helpful = is_helpful
        self.feedback_text = feedback_text
        self.question_type = question_type
        self.emotion = emotion
        self.confidence_score = confidence_score
        self.timestamp = datetime.now(timezone.utc).isoformat()
    
    def to_dict(self) -> dict:
        return {
            "message_id": self.message_id,
            "question": self.question,
            "answer": self.answer[:200],  # 只保存摘要
            "is_helpful": self.is_helpful,
            "feedback_text": self.feedback_text,
            "question_type": self.question_type,
            "emotion": self.emotion,
            "confidence_score": self.confidence_score,
            "timestamp": self.timestamp,
        }


class FeedbackCollector:
    """反馈收集器"""
    
    def __init__(self, storage_path: str = "data/feedback"):
        self.storage_path = storage_path
        self.feedback_list: List[FeedbackEntry] = []
        self._ensure_storage()
    
    def _ensure_storage(self):
        """确保存储目录存在"""
        os.makedirs(self.storage_path, exist_ok=True)
    
    def collect_feedback(
        self,
        message_id: str,
        question: str,
        answer: str,
        is_helpful: bool,
        feedback_text: Optional[str] = None,
        question_type: Optional[str] = None,
        emotion: Optional[str] = None,
        confidence_score: Optional[float] = None,
    ):
        """
        收集用户反馈
        
        Args:
            message_id: 消息ID
            question: 用户问题
            answer: AI回答
            is_helpful: 是否有帮助
            feedback_text: 反馈文本
            question_type: 问题类型
            emotion: 用户情绪
            confidence_score: 置信度评分
        """
        entry = FeedbackEntry(
            message_id=message_id,
            question=question,
            answer=answer,
            is_helpful=is_helpful,
            feedback_text=feedback_text,
            question_type=question_type,
            emotion=emotion,
            confidence_score=confidence_score,
        )
        
        self.feedback_list.append(entry)
        self._save_feedback(entry)
        
        print(f"📝 收集反馈: message_id={message_id}, helpful={is_helpful}")
    
    def _save_feedback(self, entry: FeedbackEntry):
        """保存反馈到文件"""
        feedback_file = os.path.join(self.storage_path, "feedback.jsonl")
        with open(feedback_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry.to_dict(), ensure_ascii=False) + "\n")
    
    def get_feedback_stats(self) -> Dict:
        """获取反馈统计"""
        if not self.feedback_list:
            return {
                "total": 0,
                "helpful": 0,
                "not_helpful": 0,
                "helpful_rate": 0.0,
            }
        
        total = len(self.feedback_list)
        helpful = sum(1 for f in self.feedback_list if f.is_helpful)
        
        return {
            "total": total,
            "helpful": helpful,
            "not_helpful": total - helpful,
            "helpful_rate": helpful / total if total > 0 else 0.0,
        }
    
    def get_feedback_by_type(self) -> Dict[str, Dict]:
        """按问题类型统计反馈"""
        type_stats = {}
        
        for feedback in self.feedback_list:
            if feedback.question_type:
                if feedback.question_type not in type_stats:
                    type_stats[feedback.question_type] = {
                        "total": 0,
                        "helpful": 0,
                        "not_helpful": 0,
                    }
                
                type_stats[feedback.question_type]["total"] += 1
                if feedback.is_helpful:
                    type_stats[feedback.question_type]["helpful"] += 1
                else:
                    type_stats[feedback.question_type]["not_helpful"] += 1
        
        # 计算有帮助率
        for type_name, stats in type_stats.items():
            stats["helpful_rate"] = stats["helpful"] / stats["total"] if stats["total"] > 0 else 0.0
        
        return type_stats
    
    def get_low_confidence_feedbacks(self, threshold: float = 0.6) -> List[FeedbackEntry]:
        """获取低置信度反馈"""
        return [
            f for f in self.feedback_list
            if f.confidence_score is not None and f.confidence_score < threshold
        ]
    
    def get_negative_feedbacks(self) -> List[FeedbackEntry]:
        """获取负面反馈"""
        return [f for f in self.feedback_list if not f.is_helpful]
    
    def generate_optimization_suggestions(self) -> List[str]:
        """生成优化建议"""
        suggestions = []
        stats = self.get_feedback_stats()
        
        # 总体有帮助率
        if stats["total"] > 10 and stats["helpful_rate"] < 0.7:
            suggestions.append(f"总体有帮助率较低 ({stats['helpful_rate']:.1%})，建议优化回答质量")
        
        # 按类型分析
        type_stats = self.get_feedback_by_type()
        for type_name, type_stat in type_stats.items():
            if type_stat["total"] >= 5 and type_stat["helpful_rate"] < 0.6:
                suggestions.append(f"{type_name}类型回答质量较低 ({type_stat['helpful_rate']:.1%})，建议优化该类型模板")
        
        # 低置信度分析
        low_conf_feedbacks = self.get_low_confidence_feedbacks()
        if len(low_conf_feedbacks) > 5:
            negative_count = sum(1 for f in low_conf_feedbacks if not f.is_helpful)
            if negative_count / len(low_conf_feedbacks) > 0.5:
                suggestions.append("低置信度问题的负面反馈较多，建议增加不确定性提示")
        
        return suggestions


# 单例
feedback_collector = FeedbackCollector()
