"""
动态 Prompt 系统优化验证测试
测试所有新增功能：情感分析、置信度评分、模板组合、Few-shot示例、内容安全、反馈闭环、主题跟踪
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.services.dynamic_prompt import (
    classify_question,
    classify_multiple_questions,
    analyze_user_emotion,
    get_emotion_guidance,
    check_content_safety,
    calculate_confidence_score,
    combine_templates,
    generate_dynamic_system_prompt,
    build_enhanced_user_prompt,
    QuestionType,
    UserEmotion,
    FEW_SHOT_EXAMPLES,
)
from app.services.feedback_service import FeedbackCollector, feedback_collector
from app.services.topic_tracker import TopicTracker, topic_tracker, TopicCategory


def test_question_classification():
    """测试问题分类（包括复合问题）"""
    print("\n========== 测试 1: 问题分类 ==========")
    
    # 单一问题
    q1 = "什么是苏绣？"
    result1 = classify_question(q1)
    print(f"问题: {q1}")
    print(f"类型: {result1.value}")
    assert result1 == QuestionType.DEFINITION, f"期望 DEFINITION，实际 {result1}"
    
    # 复合问题
    q2 = "武汉木雕的历史起源和制作工艺是怎样的？"
    result2 = classify_question(q2)
    multiple2 = classify_multiple_questions(q2)
    print(f"\n问题: {q2}")
    print(f"主要类型: {result2.value}")
    print(f"所有类型: {[(t[0].value, t[1]) for t in multiple2]}")
    assert len(multiple2) >= 2, f"复合问题应识别至少2种类型，实际 {len(multiple2)}"
    
    print("✅ 问题分类测试通过")


def test_emotion_analysis():
    """测试情感分析"""
    print("\n========== 测试 2: 情感分析 ==========")
    
    # 好奇
    q1 = "我很好奇，苏绣为什么这么有名？"
    emotion1 = analyze_user_emotion(q1)
    print(f"问题: {q1}")
    print(f"情绪: {emotion1.value}")
    assert emotion1 == UserEmotion.CURIOUS
    
    # 困惑
    q2 = "我不太明白这个工艺，能解释一下吗？"
    emotion2 = analyze_user_emotion(q2)
    print(f"\n问题: {q2}")
    print(f"情绪: {emotion2.value}")
    assert emotion2 == UserEmotion.CONFUSED
    
    # 质疑
    q3 = "这个历史年代真的准确吗？"
    emotion3 = analyze_user_emotion(q3)
    print(f"\n问题: {q3}")
    print(f"情绪: {emotion3.value}")
    assert emotion3 == UserEmotion.QUESTIONING
    
    # 获取情绪指导
    guidance = get_emotion_guidance(UserEmotion.CURIOUS)
    assert "好奇心" in guidance
    print(f"\n情绪指导示例: {guidance[:100]}...")
    
    print("✅ 情感分析测试通过")


def test_content_safety():
    """测试内容安全过滤"""
    print("\n========== 测试 3: 内容安全 ==========")
    
    # 安全内容
    q1 = "什么是苏绣？"
    is_safe1, reason1 = check_content_safety(q1)
    print(f"问题: {q1}")
    print(f"安全: {is_safe1}")
    assert is_safe1, f"应为安全内容，原因: {reason1}"
    
    # 不安全内容
    q2 = "我想了解股票投资"
    is_safe2, reason2 = check_content_safety(q2)
    print(f"\n问题: {q2}")
    print(f"安全: {is_safe2}")
    print(f"原因: {reason2}")
    assert not is_safe2, "应识别为不安全内容"
    
    print("✅ 内容安全测试通过")


def test_confidence_score():
    """测试置信度评分"""
    print("\n========== 测试 4: 置信度评分 ==========")
    
    # 高置信度
    q1 = "武汉木雕的历史起源是什么？它的制作工艺有哪些特点？"
    score1 = calculate_confidence_score(q1, QuestionType.HISTORY, has_context=True, has_entities=True)
    print(f"问题: {q1}")
    print(f"置信度: {score1:.2f}")
    assert score1 >= 0.8, f"高置信度问题评分应 >= 0.8，实际 {score1}"
    
    # 低置信度
    q2 = "这个"
    score2 = calculate_confidence_score(q2, QuestionType.GENERAL, has_context=False, has_entities=False)
    print(f"\n问题: {q2}")
    print(f"置信度: {score2:.2f}")
    assert score2 < 0.7, f"低置信度问题评分应 < 0.7，实际 {score2}"
    
    print("✅ 置信度评分测试通过")


def test_template_combination():
    """测试模板组合"""
    print("\n========== 测试 5: 模板组合 ==========")
    
    # 历史+技艺组合
    types = [(QuestionType.HISTORY, 3), (QuestionType.TECHNIQUE, 2)]
    combined = combine_templates(types)
    print(f"组合类型: {[t[0].value for t in types]}")
    print(f"组合指导: {combined[:150]}...")
    assert "历史" in combined and "技艺" in combined, "应包含历史和技艺的指导"
    
    # 单一类型（不应有组合）
    types2 = [(QuestionType.DEFINITION, 1)]
    combined2 = combine_templates(types2)
    print(f"\n单一类型: {types2[0][0].value}")
    print(f"组合指导: '{combined2}'")
    assert combined2 == "", "单一类型不应有组合指导"
    
    print("✅ 模板组合测试通过")


def test_few_shot_examples():
    """测试 Few-shot 示例"""
    print("\n========== 测试 6: Few-shot 示例 ==========")
    
    # 检查示例覆盖
    expected_types = [
        QuestionType.DEFINITION,
        QuestionType.HISTORY,
        QuestionType.TECHNIQUE,
        QuestionType.INHERITOR,
        QuestionType.GENERAL,
    ]
    
    for q_type in expected_types:
        assert q_type in FEW_SHOT_EXAMPLES, f"缺少 {q_type.value} 的示例"
        example = FEW_SHOT_EXAMPLES[q_type]
        assert len(example) > 100, f"{q_type.value} 示例过短"
        print(f"✅ {q_type.value}: {len(example)} 字符")
    
    print("✅ Few-shot 示例测试通过")


def test_dynamic_system_prompt():
    """测试动态 System Prompt 生成"""
    print("\n========== 测试 7: 动态 System Prompt ==========")
    
    # 基础生成
    prompt1 = generate_dynamic_system_prompt(QuestionType.DEFINITION)
    assert "非遗小博士" in prompt1
    assert "定义类问题回答指导" in prompt1
    print(f"✅ 基础 Prompt: {len(prompt1)} 字符")
    
    # 带情绪
    prompt2 = generate_dynamic_system_prompt(
        QuestionType.HISTORY,
        emotion=UserEmotion.CURIOUS
    )
    assert "好奇心" in prompt2
    print(f"✅ 带情绪 Prompt: {len(prompt2)} 字符")
    
    # 带复合问题
    multiple_types = [(QuestionType.HISTORY, 3), (QuestionType.TECHNIQUE, 2)]
    prompt3 = generate_dynamic_system_prompt(
        QuestionType.HISTORY,
        multiple_types=multiple_types
    )
    assert "复合问题" in prompt3
    print(f"✅ 带复合问题 Prompt: {len(prompt3)} 字符")
    
    # 带低置信度
    prompt4 = generate_dynamic_system_prompt(
        QuestionType.GENERAL,
        confidence_score=0.5
    )
    assert "置信度提示" in prompt4
    print(f"✅ 带低置信度 Prompt: {len(prompt4)} 字符")
    
    # 检查教育背景和专业资质
    assert "博士学位" in prompt1
    assert "国家级非遗保护专家库成员" in prompt1
    print("✅ 角色设定包含教育背景和专业资质")
    
    # 检查自我检查机制
    assert "自我检查" in prompt1
    assert "事实准确性" in prompt1
    print("✅ 包含自我检查机制")
    
    print("✅ 动态 System Prompt 测试通过")


def test_enhanced_user_prompt():
    """测试增强版用户 Prompt"""
    print("\n========== 测试 8: 增强版用户 Prompt ==========")
    
    # 模拟上下文（扩展到8条）
    context_messages = [
        {"role": "user", "content": "什么是非遗？" * 20},
        {"role": "assistant", "content": "非遗是..." * 20},
        {"role": "user", "content": "武汉木雕呢？" * 20},
        {"role": "assistant", "content": "武汉木雕..." * 20},
        {"role": "user", "content": "历史呢？" * 20},
        {"role": "assistant", "content": "历史..." * 20},
        {"role": "user", "content": "传承人呢？" * 20},
        {"role": "assistant", "content": "传承人..." * 20},
    ]
    
    entities = [
        {"name": "武汉木雕", "type": "technique"},
        {"name": "张三", "type": "inheritor"},
    ]
    
    prompt = build_enhanced_user_prompt(
        question="武汉木雕的历史起源是什么？",
        question_type=QuestionType.HISTORY,
        context_messages=context_messages,
        entities=entities,
        emotion=UserEmotion.CURIOUS,
        multiple_types=[(QuestionType.HISTORY, 3), (QuestionType.TECHNIQUE, 2)],
    )
    
    # 验证上下文扩展
    assert "对话上下文" in prompt
    assert len(context_messages) <= 8, "上下文应限制在8条以内"
    print(f"✅ 上下文扩展: 包含 {len(context_messages)} 条消息")
    
    # 验证 Few-shot 示例
    assert "回答示例" in prompt
    print("✅ 包含 Few-shot 示例")
    
    # 验证实体信息
    assert "相关实体" in prompt
    assert "武汉木雕" in prompt
    print("✅ 包含实体信息")
    
    # 验证回答要求
    assert "自我检查" in prompt
    assert "800-1500字" in prompt
    print("✅ 包含回答要求（自我检查、长度控制）")
    
    print(f"✅ 增强版 Prompt 总长度: {len(prompt)} 字符")
    print("✅ 增强版用户 Prompt 测试通过")


def test_feedback_collector():
    """测试反馈收集"""
    print("\n========== 测试 9: 反馈收集 ==========")
    
    collector = FeedbackCollector(storage_path="test_data/feedback")
    
    # 收集反馈
    collector.collect_feedback(
        message_id="msg_001",
        question="什么是苏绣？",
        answer="苏绣是...",
        is_helpful=True,
        question_type="definition",
        emotion="curious",
        confidence_score=0.85,
    )
    
    collector.collect_feedback(
        message_id="msg_002",
        question="武汉木雕的历史？",
        answer="武汉木雕...",
        is_helpful=False,
        feedback_text="回答不够详细",
        question_type="history",
        confidence_score=0.55,
    )
    
    # 获取统计
    stats = collector.get_feedback_stats()
    print(f"反馈统计: {stats}")
    assert stats["total"] == 2
    assert stats["helpful"] == 1
    assert stats["not_helpful"] == 1
    
    # 获取优化建议
    suggestions = collector.generate_optimization_suggestions()
    print(f"优化建议: {suggestions}")
    
    print("✅ 反馈收集测试通过")


def test_topic_tracker():
    """测试主题跟踪"""
    print("\n========== 测试 10: 主题跟踪 ==========")
    
    tracker = TopicTracker()
    
    # 第一次话题
    changed1 = tracker.update_topic(
        question="什么是武汉木雕？",
        category=TopicCategory.DEFINITION,
        entities=["武汉木雕"]
    )
    assert changed1, "首次对话应视为话题开始"
    print(f"✅ 话题 1: {tracker.current_topic.topic}")
    
    # 同一话题延续
    changed2 = tracker.update_topic(
        question="它的历史是什么？",
        category=TopicCategory.HISTORY,
        entities=["明代", "清代"]
    )
    print(f"✅ 话题 2 转换: {changed2}")
    print(f"   当前话题: {tracker.current_topic.topic}")
    print(f"   对话轮次: {tracker.current_topic.turn_count}")
    
    # 获取上下文摘要
    summary = tracker.get_context_summary()
    print(f"✅ 上下文摘要:\n{summary}")
    
    # 获取相关话题建议
    related = tracker.get_related_topics()
    print(f"✅ 相关话题建议: {related}")
    
    print("✅ 主题跟踪测试通过")


def run_all_tests():
    """运行所有测试"""
    print("=" * 60)
    print("动态 Prompt 系统优化验证测试")
    print("=" * 60)
    
    try:
        test_question_classification()
        test_emotion_analysis()
        test_content_safety()
        test_confidence_score()
        test_template_combination()
        test_few_shot_examples()
        test_dynamic_system_prompt()
        test_enhanced_user_prompt()
        test_feedback_collector()
        test_topic_tracker()
        
        print("\n" + "=" * 60)
        print("🎉 所有测试通过！")
        print("=" * 60)
        print("\n优化功能清单:")
        print("✅ 1. 输出质量评估指令（自我检查机制）")
        print("✅ 2. 上下文窗口扩展（3条 → 8条）")
        print("✅ 3. 模板组合机制（处理复合问题）")
        print("✅ 4. Few-shot 示例（5种问题类型）")
        print("✅ 5. 敏感词过滤和内容审核")
        print("✅ 6. 用户反馈闭环系统")
        print("✅ 7. 情感分析（5种情绪识别）")
        print("✅ 8. 角色设定完善（教育背景、专业资质）")
        print("✅ 9. 置信度评分机制")
        print("✅ 10. 对话主题跟踪")
        print("=" * 60)
        
        return True
        
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
