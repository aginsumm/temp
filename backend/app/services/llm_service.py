from typing import Optional, AsyncGenerator, List
import httpx
import json
import re
import asyncio
import random
import hashlib
from datetime import datetime, timezone
from enum import Enum
from app.core.config import settings
from app.schemas.chat import Entity, EntityType, Relation
from app.services.dynamic_prompt import classify_question, classify_multiple_questions, generate_dynamic_system_prompt, build_enhanced_user_prompt, analyze_user_emotion, calculate_confidence_score, check_content_safety


def generate_entity_id(name: str, entity_type: str) -> str:
    """生成一致的实体 ID（基于名称和类型的哈希）"""
    key = f"{name.lower().strip()}_{entity_type}"
    hash_value = hashlib.md5(key.encode()).hexdigest()[:12]
    return f"ent_{hash_value}"


# ========== 精简版 System Prompt（优化 token 消耗）==========
NONHERITAGE_SYSTEM_PROMPT = """你是非遗小博士，专业、热情、通俗易懂的非遗文化专家。

核心要求：
1. 准确：历史年代、人名、地名必须准确，不确定时明确说明
2. 通俗：避免学术化，多讲故事，联系现代生活
3. 结构化：使用 Markdown 格式（## 标题、**加粗**、列表）
4. 安全：不编造事实，不贬低任何文化，保持客观中立

回答风格：像朋友交流，适度使用语气词，展现对非遗的热爱
回答长度：800-1200 字
回答结构：开场（简要）→ 主体（分点阐述）→ 延伸（相关知识）→ 结尾（互动）

拒绝回答：与非遗无关的话题、敏感政治话题、商业推广"""


# ========== 竞赛级实体提取 Prompt ==========
ENTITY_EXTRACTION_SYSTEM_PROMPT = """你是一位专业的非遗知识图谱构建专家，擅长从文本中精准提取非遗相关实体。

【任务目标】
从给定文本中识别所有与非物质文化遗产相关的实体，并以结构化JSON格式输出。

【实体类型定义】
1. inheritor（传承人）：掌握非遗技艺的个人或群体代表
   - 示例：国家级传承人、省级传承人、民间艺人
   - 特征：通常带有"传承人"、"大师"、"艺人"等称谓

2. technique（技艺）：非遗项目的核心工艺或技术
   - 示例：刺绣、雕刻、剪纸、陶艺、编织
   - 特征：动词性名词，表示一种技能或方法

3. work（作品）：具体的非遗作品或代表性物件
   - 示例：《清明上河图》刺绣、某件具体瓷器
   - 特征：具体名称，通常带有书名号或特定称谓

4. pattern（纹样）：装饰性图案或符号
   - 示例：龙凤纹、云纹、回纹、吉祥图案
   - 特征：描述图案样式或纹饰

5. region（地区）：地理区域或地点
   - 示例：省份、城市、县镇、具体村落
   - 特征：行政区划名称或地理标识

6. period（时期）：历史年代或时间段
   - 示例：朝代、年份、世纪、历史时期
   - 特征：时间相关词汇

7. material（材料）：制作原料或材质
   - 示例：丝绸、竹子、木材、泥土、金属
   - 特征：物质名词，表示原材料

【提取规则】
✅ 必须提取：
- 明确的非遗项目名称
- 具体的传承人姓名
- 核心工艺技法
- 代表作品名称
- 发源地/流行地区
- 起源/兴盛时期

❌ 禁止提取：
- 过于通用的词汇（如"文化"、"传统"）
- 没有具体指代的代词
- 与非遗无关的现代商业品牌
- 重复出现的同一实体（合并为一个）

【相关性评分标准】
- 0.90-1.00：核心实体，直接描述主题
- 0.80-0.89：重要实体，与主题密切相关
- 0.70-0.79：相关实体，提供背景信息
- 0.60-0.69：边缘实体，弱相关
- <0.60：不提取

【输出格式要求】
{
  "entities": [
    {
      "id": "ent_序号",
      "name": "实体名称（简洁准确）",
      "type": "实体类型（严格使用7种类型之一）",
      "description": "简短描述（20-50字，包含关键特征）",
      "relevance": 0.00-1.00
    }
  ]
}

【质量检查清单】
□ 所有实体名称是否准确无歧义
□ 实体类型分类是否正确
□ 描述是否简洁且信息完整
□ 相关性评分是否合理
□ 是否遗漏重要实体
□ 是否包含无关实体"""

ENTITY_EXTRACTION_FEW_SHOT = """
【示例 1：综合技艺类】
文本："武汉木雕是湖北地区的传统工艺，起源于明代，代表性传承人有张三和李四。他们擅长浮雕和圆雕技法，代表作品有黄鹤楼木雕。"

正确输出：
{
  "entities": [
    {"id": "ent_1", "name": "武汉木雕", "type": "technique", "description": "湖北地区传统雕刻工艺，起源于明代，具有悠久历史", "relevance": 0.95},
    {"id": "ent_2", "name": "张三", "type": "inheritor", "description": "武汉木雕代表性传承人，掌握核心雕刻技艺", "relevance": 0.88},
    {"id": "ent_3", "name": "李四", "type": "inheritor", "description": "武汉木雕代表性传承人，与张三共同推动技艺传承", "relevance": 0.88},
    {"id": "ent_4", "name": "浮雕", "type": "technique", "description": "在平面上雕刻凸起图案的技法，武汉木雕核心技艺之一", "relevance": 0.85},
    {"id": "ent_5", "name": "圆雕", "type": "technique", "description": "立体雕刻技法，可多角度观赏，武汉木雕核心技艺之一", "relevance": 0.85},
    {"id": "ent_6", "name": "黄鹤楼木雕", "type": "work", "description": "武汉木雕代表作品，以黄鹤楼为题材的雕刻作品", "relevance": 0.90},
    {"id": "ent_7", "name": "明代", "type": "period", "description": "武汉木雕起源时期，距今已有数百年历史", "relevance": 0.78},
    {"id": "ent_8", "name": "湖北", "type": "region", "description": "武汉木雕发源地，具有深厚的雕刻文化传统", "relevance": 0.82}
  ]
}

【示例 2：刺绣类】
文本："苏绣以针法细腻、色彩雅致著称，主要产于江苏苏州地区。四大名绣包括苏绣、湘绣、粤绣和蜀绣。"

正确输出：
{
  "entities": [
    {"id": "ent_1", "name": "苏绣", "type": "technique", "description": "江苏苏州地区传统刺绣技艺，以针法细腻、色彩雅致著称，中国四大名绣之一", "relevance": 0.95},
    {"id": "ent_2", "name": "苏州", "type": "region", "description": "苏绣主要产地，江苏省地级市，素有'绣娘之乡'美誉", "relevance": 0.88},
    {"id": "ent_3", "name": "江苏", "type": "region", "description": "苏绣所在省份，中国东部沿海经济文化发达省份", "relevance": 0.80},
    {"id": "ent_4", "name": "湘绣", "type": "technique", "description": "湖南地区传统刺绣技艺，中国四大名绣之一，以狮虎题材见长", "relevance": 0.75},
    {"id": "ent_5", "name": "粤绣", "type": "technique", "description": "广东地区传统刺绣技艺，中国四大名绣之一，以金碧辉煌著称", "relevance": 0.75},
    {"id": "ent_6", "name": "蜀绣", "type": "technique", "description": "四川地区传统刺绣技艺，中国四大名绣之一，以鲤鱼题材闻名", "relevance": 0.75}
  ]
}

【示例 3：边界案例（应排除的实体）】
文本："这项传统技艺非常重要，代表了中国文化的精髓，需要好好保护。"

正确输出：
{
  "entities": []
}
说明：文本中没有具体可提取的实体，"传统技艺"、"中国文化"过于笼统，不符合提取标准。

现在请从以下文本中提取实体：
"""


# ========== Few-shot 示例：关系提取 ==========
RELATION_EXTRACTION_FEW_SHOT = """
【示例】
实体列表：
- 武汉木雕 (technique)
- 张三 (inheritor)
- 浮雕 (technique)
- 黄鹤楼木雕 (work)
- 明代 (period)
- 湖北 (region)

文本："武汉木雕是湖北地区的传统工艺，起源于明代，代表性传承人有张三。他们擅长浮雕技法，代表作品有黄鹤楼木雕。"

正确输出：
{
  "relations": [
    {"source": "张三", "target": "武汉木雕", "type": "inherits", "confidence": 0.95},
    {"source": "武汉木雕", "target": "湖北", "type": "origin", "confidence": 0.92},
    {"source": "武汉木雕", "target": "明代", "type": "flourished_in", "confidence": 0.88},
    {"source": "张三", "target": "浮雕", "type": "inherits", "confidence": 0.85},
    {"source": "武汉木雕", "target": "黄鹤楼木雕", "type": "creates", "confidence": 0.90}
  ]
}

现在请分析以下实体之间的关系：
"""


HERITAGE_FALLBACK_RESPONSES = [
    "根据非遗知识库的资料，您询问的内容涉及传统技艺的核心传承。这项技艺已有数百年历史，是中华传统文化的重要组成部分。",
    "关于您的问题，从非遗保护的角度来看，这体现了先民智慧的结晶。传承人在技艺传承中扮演着关键角色，需要长期的学习和实践。",
    "这是一个很好的问题！非遗文化强调活态传承，每一代传承人都会在保持核心技艺的同时，融入时代特色。",
    "从非物质文化遗产保护的角度，这项技艺承载着深厚的历史文化底蕴。它不仅是一种技艺，更是一种文化记忆和精神传承。",
    "非遗保护工作需要全社会的共同参与。传承人、学者、政府以及每一位关注者都是非遗保护的重要力量。",
]


def generate_fallback_response(content: str) -> str:
    """生成降级响应"""
    lower_content = content.lower()
    
    if '传承人' in lower_content or '传人' in lower_content:
        return "传承人是非遗保护的核心。他们不仅掌握着精湛的技艺，更承载着文化的记忆。目前我国已建立了完善的传承人认定和保护机制，确保这些珍贵技艺得以延续。"
    
    if '历史' in lower_content or '起源' in lower_content:
        return "这项非遗技艺历史悠久，可追溯至数百年前。它凝聚了先民的智慧，在历史长河中不断发展演变，形成了独特的艺术风格。"
    
    if '工艺' in lower_content or '制作' in lower_content:
        return "该技艺的制作工艺十分讲究，需要经过多道工序，每一步都需要精心操作。传统工艺强调慢工出细活，体现了匠人精神。"
    
    return random.choice(HERITAGE_FALLBACK_RESPONSES)


def optimize_text_for_extraction(text: str, max_length: int = 3000) -> str:
    """
    优化文本长度，保留关键信息，适配 prompt 长度限制
    
    策略：
    1. 如果文本长度在限制内，直接返回
    2. 保留首尾各 40% 的内容
    3. 中间 20% 提取关键词句
    """
    if len(text) <= max_length:
        return text
    
    head_length = int(max_length * 0.4)
    tail_length = int(max_length * 0.4)
    
    head = text[:head_length]
    tail = text[-tail_length:]
    
    # 中间部分提取关键句
    middle_start = head_length
    middle_end = len(text) - tail_length
    middle_text = text[middle_start:middle_end]
    
    # 提取包含关键词的句子
    keywords = ['非遗', '传承', '技艺', '历史', '工艺', '代表', '起源', '发展', '技法', '作品']
    key_sentences = []
    
    for sentence in middle_text.replace('。', '。\n').replace('！', '！\n').replace('？', '？\n').split('\n'):
        sentence = sentence.strip()
        if len(sentence) > 10 and any(kw in sentence for kw in keywords):
            key_sentences.append(sentence)
        if len(key_sentences) >= 3:
            break
    
    middle_summary = ' '.join(key_sentences) if key_sentences else '[内容摘要]'
    
    optimized = f"{head}\n\n... {middle_summary} ...\n\n{tail}"
    
    return optimized


class LLMServiceState(Enum):
    """LLM服务状态枚举"""
    HEALTHY = "healthy"          # 服务正常
    DEGRADED = "degraded"        # 降级模式（使用备用模型）
    OFFLINE = "offline"          # 离线模式（使用 mock）
    RECOVERING = "recovering"    # 恢复中（定期探测）


class LLMErrorType(Enum):
    """LLM错误类型枚举"""
    API_KEY_MISSING = "API_KEY_MISSING"
    NETWORK_ERROR = "NETWORK_ERROR"
    TIMEOUT = "TIMEOUT"
    RATE_LIMIT = "RATE_LIMIT"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    UNKNOWN = "UNKNOWN"


class LLMService:
    def __init__(self):
        self.api_key = settings.DASHSCOPE_API_KEY
        self.base_url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
        
        # 服务状态机
        self.state = LLMServiceState.OFFLINE if not self.api_key else LLMServiceState.HEALTHY
        self.health_check_interval = 60  # 秒
        self.last_health_check = None
        self.health_check_task = None
        
        # 检查 API 配置
        if not self.api_key:
            print("⚠️  WARNING: DASHSCOPE_API_KEY not configured, using MOCK mode")
            print("📝 Set DASHSCOPE_API_KEY in .env file to enable real AI services")
        else:
            print(f"✅ LLM Service initialized with API key: {self.api_key[:8]}...")
        
        # 降级策略配置
        self.max_retries = 3
        self.retry_delays = [1, 2, 4]  # 指数退避
        self.timeout_seconds = 60.0
        self.fallback_enabled = True
        
        # 备用模型
        self.primary_model = "qwen-plus"
        self.fallback_models = ["qwen-plus", "qwen-turbo"]
        self.current_model_index = 0
        
        # 错误统计
        self.error_counts = {
            "total": 0,
            "consecutive": 0,
            "last_error_time": None,
        }
        
        # 服务状态
        self.is_degraded = False
        self.degraded_since = None
        
        # 状态转换回调
        self._state_change_callbacks = []

    def on_state_change(self, callback):
        """注册状态变化回调"""
        self._state_change_callbacks.append(callback)

    def _transition_state(self, new_state: LLMServiceState, reason: str = ""):
        """状态转换"""
        old_state = self.state
        if old_state != new_state:
            self.state = new_state
            print(f"🔄 LLM Service state transition: {old_state.value} → {new_state.value} (Reason: {reason})")
            
            # 触发回调
            for callback in self._state_change_callbacks:
                try:
                    callback(old_state, new_state, reason)
                except Exception as e:
                    print(f"Error in state change callback: {e}")

    async def start_health_check(self):
        """启动健康检查定时任务"""
        if self.health_check_task and not self.health_check_task.done():
            return  # 已经在运行
            
        self.health_check_task = asyncio.create_task(self._health_check_loop())

    async def stop_health_check(self):
        """停止健康检查定时任务"""
        if self.health_check_task:
            self.health_check_task.cancel()
            try:
                await self.health_check_task
            except asyncio.CancelledError:
                pass

    async def _health_check_loop(self):
        """健康检查循环"""
        while True:
            try:
                await asyncio.sleep(self.health_check_interval)
                await self.health_check()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Health check error: {e}")

    async def health_check(self) -> bool:
        """健康检查"""
        self.last_health_check = datetime.now(timezone.utc)
        
        if self.state == LLMServiceState.OFFLINE:
            # 尝试探测服务是否恢复
            try:
                self._transition_state(LLMServiceState.RECOVERING, "Health check initiated")
                result = await self._test_api_connection()
                if result:
                    self._transition_state(LLMServiceState.HEALTHY, "Health check passed")
                    return True
                else:
                    self._transition_state(LLMServiceState.OFFLINE, "Health check failed")
                    return False
            except Exception as e:
                print(f"Health check failed: {e}")
                self._transition_state(LLMServiceState.OFFLINE, f"Health check error: {e}")
                return False
        elif self.state == LLMServiceState.RECOVERING:
            # 恢复中的状态，定期检查是否完全恢复
            try:
                result = await self._test_api_connection()
                if result:
                    self._transition_state(LLMServiceState.HEALTHY, "Recovery complete")
                    return True
            except Exception:
                pass
            return False
        elif self.state == LLMServiceState.DEGRADED:
            # 降级状态下，检查主服务是否恢复
            try:
                result = await self._test_api_connection()
                if result:
                    self._reset_model()
                    self._transition_state(LLMServiceState.HEALTHY, "Degraded service recovered")
                    return True
            except Exception:
                pass
            return False
        
        return True  # HEALTHY状态默认返回True

    async def _test_api_connection(self) -> bool:
        """测试API连接"""
        if not self.api_key:
            return False
            
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            
            payload = {
                "model": "qwen-turbo",
                "input": {"messages": [{"role": "user", "content": "test"}]},
                "parameters": {"result_format": "message"},
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    json=payload,
                )
                return response.status_code == 200
        except Exception:
            return False

    def classify_error(self, error: Exception) -> LLMErrorType:
        """错误分类器"""
        if isinstance(error, RuntimeError) and "API_KEY" in str(error):
            return LLMErrorType.API_KEY_MISSING
        elif isinstance(error, httpx.TimeoutException):
            return LLMErrorType.TIMEOUT
        elif isinstance(error, httpx.NetworkError):
            return LLMErrorType.NETWORK_ERROR
        elif isinstance(error, httpx.HTTPStatusError):
            if error.response.status_code == 429:
                return LLMErrorType.RATE_LIMIT
            elif error.response.status_code >= 500:
                return LLMErrorType.SERVICE_UNAVAILABLE
        return LLMErrorType.UNKNOWN

    def get_user_friendly_message(self, error_type: LLMErrorType) -> str:
        """获取用户友好的错误提示"""
        messages = {
            LLMErrorType.API_KEY_MISSING: "AI服务暂未配置，已切换到智能助手模式（功能受限）",
            LLMErrorType.NETWORK_ERROR: "网络连接中断，正在尝试重新连接...",
            LLMErrorType.TIMEOUT: "响应超时，AI正在处理复杂问题，请耐心等待",
            LLMErrorType.RATE_LIMIT: "请求过于频繁，请稍后再试",
            LLMErrorType.SERVICE_UNAVAILABLE: "AI服务暂时不可用，已切换到备用模式",
            LLMErrorType.UNKNOWN: "AI服务出现异常，请稍后再试",
        }
        return messages.get(error_type, "未知错误")

    def _get_current_model(self) -> str:
        """获取当前使用的模型"""
        if self.state == LLMServiceState.OFFLINE:
            return "mock"  # 离线模式不使用真实模型
            
        if self.current_model_index >= len(self.fallback_models):
            return self.fallback_models[-1]
        return self.fallback_models[self.current_model_index]

    def _switch_to_fallback(self):
        """切换到备用模型"""
        self.current_model_index += 1
        if self.current_model_index < len(self.fallback_models):
            print(f"Switching to fallback model: {self.fallback_models[self.current_model_index]}")
            if not self.is_degraded:
                self.is_degraded = True
                self.degraded_since = datetime.now(timezone.utc)
                self._transition_state(LLMServiceState.DEGRADED, "Switched to fallback model")

    def _reset_model(self):
        """重置模型到主模型"""
        self.current_model_index = 0
        self.is_degraded = False
        self.degraded_since = None
        self._transition_state(LLMServiceState.HEALTHY, "Reset to primary model")

    def _record_error(self, error: Exception = None):
        """记录错误"""
        del error  # 参数保留用于未来扩展，当前未使用
        self.error_counts["total"] += 1
        self.error_counts["consecutive"] += 1
        self.error_counts["last_error_time"] = datetime.now(timezone.utc)
        
        # 连续错误 3 次后进入降级状态
        if self.error_counts["consecutive"] >= 3:
            if self.state == LLMServiceState.HEALTHY:
                self._switch_to_fallback()
                self._transition_state(LLMServiceState.DEGRADED, "Consecutive errors threshold reached")
        
        # 连续错误 5 次后进入离线状态
        if self.error_counts["consecutive"] >= 5:
            if self.state in [LLMServiceState.HEALTHY, LLMServiceState.DEGRADED]:
                self._transition_state(LLMServiceState.OFFLINE, "Too many consecutive errors")

    def _record_success(self):
        """记录成功"""
        was_degraded = self.is_degraded
        self.error_counts["consecutive"] = 0
        
        # 如果之前处于降级状态，重置回主模型
        if self.is_degraded and self.state == LLMServiceState.DEGRADED:
            self._reset_model()
            print("LLM service recovered from degraded state")
        
        # 每成功 10 次，减少总错误计数（防止错误计数无限累积）
        if self.error_counts["total"] > 10:
            self.error_counts["total"] = max(0, self.error_counts["total"] - 1)
        
        return was_degraded

    async def _execute_with_retry(self, func, *args, **kwargs):
        """带重试的执行"""
        last_exception = None
        
        for attempt in range(self.max_retries):
            try:
                if attempt > 0:
                    # 指数退避
                    delay = self.retry_delays[min(attempt - 1, len(self.retry_delays) - 1)]
                    print(f"Retry attempt {attempt + 1}, waiting {delay}s")
                    await asyncio.sleep(delay)
                    
                    # 切换到备用模型（只在第一次重试时切换）
                    if attempt == 1:
                        self._switch_to_fallback()
                
                result = await func(*args, **kwargs)
                
                # 成功后记录并重置模型
                if attempt > 0:  # 如果是重试后成功
                    was_degraded = self._record_success()
                    if was_degraded:
                        print(f"Successfully recovered after {attempt} retries")
                
                return result
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as e:
                last_exception = e
                self._record_error()
                print(f"Attempt {attempt + 1} failed: {str(e)}")
                
                # 如果是 5xx 错误，继续重试
                if isinstance(e, httpx.HTTPStatusError) and e.response.status_code >= 500:
                    continue
                # 其他错误直接抛出
                raise
            except Exception as e:
                last_exception = e
                self._record_error()
                print(f"Unexpected error on attempt {attempt + 1}: {str(e)}")
        
        # 所有重试都失败
        if self.fallback_enabled:
            print("All retries failed, using fallback response")
            raise RuntimeError("真实 AI 重试后仍失败，已停止降级到 mock")
        
        raise last_exception

    async def chat(
        self,
        message: str,
        context: Optional[list[dict]] = None,
        stream: bool = False,
    ) -> str:
        del stream  # 保留参数用于未来流式扩展
        if not self.api_key:
            # 降级：无 API Key 时直接返回本地响应
            print("️ API Key 未配置，使用本地响应")
            return generate_fallback_response(message)

        # ✅ 优化 4：回答长度限制常量
        MAX_RESPONSE_LENGTH = 1500

        # ✅ 竞赛级优化：动态 Prompt 系统（增强版）
        messages = context or []
        
        # 如果没有对话历史，使用动态 System Prompt
        if not context:
            # 识别问题类型（支持复合问题）
            question_type = classify_question(message)
            multiple_types = classify_multiple_questions(message)
            print(f"🎯 识别问题类型: {question_type.value}")
            if len(multiple_types) > 1:
                print(f"🔀 复合问题: {[t[0].value for t in multiple_types[:3]]}")
            
            # 分析用户情绪
            emotion = analyze_user_emotion(message)
            print(f"😊 用户情绪: {emotion.value}")
            
            # 计算置信度
            confidence = calculate_confidence_score(
                message, 
                question_type, 
                has_context=False, 
                has_entities=False
            )
            print(f"📊 置信度评分: {confidence:.2f}")
            
            # 内容安全检查
            is_safe, safety_reason = check_content_safety(message)
            if not is_safe:
                print(f"⚠️ 内容安全警告: {safety_reason}")
            
            # 生成动态 System Prompt（包含情绪、复合问题、置信度）
            dynamic_system_prompt = generate_dynamic_system_prompt(
                question_type,
                emotion=emotion,
                multiple_types=multiple_types if len(multiple_types) > 1 else None,
                confidence_score=confidence
            )
            messages.append({
                "role": "system",
                "content": dynamic_system_prompt
            })
            
            # 构建增强版用户 Prompt（包含情绪、复合问题）
            enhanced_message = build_enhanced_user_prompt(
                message, 
                question_type,
                emotion=emotion,
                multiple_types=multiple_types if len(multiple_types) > 1 else None
            )
            messages.append({"role": "user", "content": enhanced_message})
        else:
            messages.append({"role": "user", "content": message})

        async def _do_chat():
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "model": self._get_current_model(),
                "input": {"messages": messages},
                "parameters": {
                    "result_format": "message",
                },
            }

            try:
                print(f"🔵 Calling DashScope API with model: {self._get_current_model()}")
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    response = await client.post(
                        self.base_url,
                        headers=headers,
                        json=payload,
                    )
                    response.raise_for_status()
                    data = response.json()
                    self._record_success()
                    result = data["output"]["choices"][0]["message"]["content"]
                    print(f"✅ LLM response received ({len(result)} chars)")
                    return result
            except Exception as e:
                # 让外层的 _execute_with_retry 处理错误记录
                print(f"❌ LLM API error: {e}")
                raise

        try:
            result = await self._execute_with_retry(_do_chat)

            # ✅ 优化 4：强制回答长度限制
            if len(result) > MAX_RESPONSE_LENGTH:
                print(f"⚠️ 回答过长 ({len(result)} 字)，截断到 {MAX_RESPONSE_LENGTH} 字")
                # 找到最后一个完整句子
                truncated = result[:MAX_RESPONSE_LENGTH]
                last_period = max(
                    truncated.rfind('。'),
                    truncated.rfind('！'),
                    truncated.rfind('？')
                )
                if last_period > MAX_RESPONSE_LENGTH * 0.8:
                    result = truncated[:last_period + 1]
                else:
                    result = truncated
                result += "\n\n💡 *回答较长已截断，如需了解更多请继续提问*"

            return result
        except Exception as e:
            print(f"LLM API error after retries: {e}")
            # 降级：使用本地生成响应
            print("⚠️ 降级到本地响应")
            return generate_fallback_response(message)

    async def chat_stream(
        self,
        message: str,
        context: Optional[list[dict]] = None,
    ) -> AsyncGenerator[str, None]:
        import sys
        if not self.api_key:
            # 降级：无 API Key 时分块返回本地响应
            print("⚠️ API Key 未配置，使用流式本地响应", file=sys.stderr)
            fallback = generate_fallback_response(message)
            chunk_size = 50
            for i in range(0, len(fallback), chunk_size):
                yield fallback[i:i + chunk_size]
                await asyncio.sleep(0.05)
            return

        # ✅ 竞赛级优化：动态 Prompt 系统（增强版）
        messages = context or []
        
        # 如果没有对话历史，使用动态 System Prompt
        if not context:
            # 识别问题类型（支持复合问题）
            question_type = classify_question(message)
            multiple_types = classify_multiple_questions(message)
            print(f"🎯 识别问题类型: {question_type.value}", file=sys.stderr)
            if len(multiple_types) > 1:
                print(f"🔀 复合问题: {[t[0].value for t in multiple_types[:3]]}", file=sys.stderr)
            
            # 分析用户情绪
            emotion = analyze_user_emotion(message)
            print(f"😊 用户情绪: {emotion.value}", file=sys.stderr)
            
            # 计算置信度
            confidence = calculate_confidence_score(
                message, 
                question_type, 
                has_context=False, 
                has_entities=False
            )
            print(f"📊 置信度评分: {confidence:.2f}", file=sys.stderr)
            
            # 内容安全检查
            is_safe, safety_reason = check_content_safety(message)
            if not is_safe:
                print(f"⚠️ 内容安全警告: {safety_reason}", file=sys.stderr)
            
            # 生成动态 System Prompt（包含情绪、复合问题、置信度）
            dynamic_system_prompt = generate_dynamic_system_prompt(
                question_type,
                emotion=emotion,
                multiple_types=multiple_types if len(multiple_types) > 1 else None,
                confidence_score=confidence
            )
            messages.append({
                "role": "system",
                "content": dynamic_system_prompt
            })
            
            # 构建增强版用户 Prompt（包含情绪、复合问题）
            enhanced_message = build_enhanced_user_prompt(
                message, 
                question_type,
                emotion=emotion,
                multiple_types=multiple_types if len(multiple_types) > 1 else None
            )
            messages.append({"role": "user", "content": enhanced_message})
        else:
            messages.append({"role": "user", "content": message})

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-DashScope-SSE": "enable",
        }

        payload = {
            "model": self._get_current_model(),
            "input": {"messages": messages},
            "parameters": {
                "result_format": "message",
                "incremental_output": True,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                async with client.stream(
                    "POST",
                    self.base_url,
                    headers=headers,
                    json=payload,
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data:"):
                            data = json.loads(line[5:])
                            if "output" in data and "choices" in data["output"]:
                                content = data["output"]["choices"][0].get("message", {}).get("content", "")
                                if content:
                                    self._record_success()
                                    yield content
                                    sys.stdout.flush()
        except Exception as e:
            error_type = type(e).__name__
            print(f"LLM streaming error ({error_type}): {e}", file=sys.stderr)
            self._record_error()
            # 降级：分块返回 fallback 响应
            print(f"⚠️ 流式降级到本地响应 (model: {self._get_current_model()})", file=sys.stderr)
            fallback = generate_fallback_response(message)
            chunk_size = 50
            for i in range(0, len(fallback), chunk_size):
                yield fallback[i:i + chunk_size]
                await asyncio.sleep(0.05)  # 模拟打字速度

    async def extract_entities(self, text: str) -> List[Entity]:
        """
        提取实体（混合模式：本地 NER + AI 增强）
        优先使用本地 NER 快速提取（<100ms），AI 异步增强
        """
        # ✅ 优化 1：使用本地 NER 快速提取
        from app.services.local_ner import local_ner

        try:
            local_entities = local_ner.extract(text)
            print(f"✅ 本地 NER 提取到 {len(local_entities)} 个实体")

            # 如果本地提取结果足够，直接返回
            if len(local_entities) >= 5:
                return local_entities

            # 否则，尝试 AI 增强（但不阻塞）
            if not self.api_key:
                print("⚠️ API Key 未配置，仅使用本地 NER 结果")
                return local_entities

            # AI 增强（有超时保护）
            try:
                ai_entities = await asyncio.wait_for(
                    self._extract_entities_with_ai(text),
                    timeout=5.0  # 5 秒超时
                )

                # 合并本地和 AI 结果（去重）
                merged = self._merge_entities(local_entities, ai_entities)
                print(f"✅ 合并后共 {len(merged)} 个实体")
                return merged
            except asyncio.TimeoutError:
                print("⚠️ AI 实体提取超时，使用本地 NER 结果")
                return local_entities
            except Exception as e:
                print(f"⚠️ AI 实体提取失败: {e}，使用本地 NER 结果")
                return local_entities

        except Exception as e:
            print(f"⚠️ 本地 NER 失败: {e}，使用 Mock 实体")
            return self._mock_entities(text)

    async def _extract_entities_with_ai(self, text: str) -> List[Entity]:
        """使用 AI 提取实体（内部方法）"""
        optimized_text = optimize_text_for_extraction(text, max_length=3000)

        messages = [
            {
                "role": "system",
                "content": ENTITY_EXTRACTION_SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": f"{ENTITY_EXTRACTION_FEW_SHOT}\n\n文本：\n{optimized_text}\n\n请严格按照上述规则和格式输出 JSON："
            }
        ]

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": "qwen-turbo",
            "input": {"messages": messages},
            "parameters": {
                "result_format": "message",
                "temperature": 0.1,
            },
        }

        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                self.base_url,
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            content = data["output"]["choices"][0]["message"]["content"]

            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                result = json.loads(json_match.group())
                entities = []

                for e in result.get("entities", []):
                    entity_type = e.get("type", "technique")
                    if entity_type not in ["inheritor", "technique", "work", "pattern", "region", "period", "material"]:
                        entity_type = "technique"

                    entity_id = e.get("id") or generate_entity_id(
                        e.get("name", ""),
                        entity_type
                    )

                    entities.append(Entity(
                        id=entity_id,
                        name=e.get("name", ""),
                        type=EntityType(entity_type),
                        description=e.get("description"),
                        relevance=e.get("relevance", 0.8),
                    ))
                return entities
            else:
                return []

    def _merge_entities(self, local_entities: List[Entity], ai_entities: List[Entity]) -> List[Entity]:
        """合并本地和 AI 提取的实体（去重）"""
        seen_names = {}
        merged = []

        # 优先保留本地实体（更快更准确）
        for entity in local_entities:
            key = f"{entity.name.lower()}_{entity.type.value}"
            if key not in seen_names:
                seen_names[key] = entity
                merged.append(entity)

        # 补充 AI 实体
        for entity in ai_entities:
            key = f"{entity.name.lower()}_{entity.type.value}"
            if key not in seen_names:
                seen_names[key] = entity
                merged.append(entity)

        # 按相关性排序
        merged.sort(key=lambda e: e.relevance or 0.0, reverse=True)
        return merged[:20]  # 最多返回 20 个

    async def extract_keywords(self, text: str) -> List[str]:
        if not self.api_key:
            print("⚠️ API Key 未配置，使用 Mock 关键词提取")
            return self._mock_keywords(text)

        try:
            # ✅ 新增：优化文本长度
            optimized_text = optimize_text_for_extraction(text, max_length=2000)
            
            # ✅ 竞赛级优化：使用 System Prompt + 结构化指令
            messages = [
                {
                    "role": "system",
                    "content": """你是一位专业的非遗领域关键词提取专家。

【任务目标】
从给定文本中提取最能代表非遗主题的核心关键词。

【提取标准】
1. 领域特化：优先选择非遗专业术语（如"活态传承"、"口传心授"、"师徒制"）
2. 具体明确：避免过于宽泛的词汇（如"文化"、"传统"、"历史"）
3. 长度控制：2-8个汉字，确保简洁易记
4. 多样性：涵盖技艺类型、地理特征、历史维度、材料工艺等不同角度
5. 重要性排序：按与主题的相关性和重要性降序排列

【非遗领域核心术语库参考】
- 传承类：活态传承、口传心授、师徒传承、家族传承、代表性传承人
- 工艺类：手工制作、传统技法、核心工艺、独门绝技、匠心精神
- 保护类：非遗保护、抢救性记录、数字化保护、生产性保护
- 文化类：民俗活动、节庆仪式、民间信仰、审美价值

【去重与合并规则】
- 同义词合并：如"刺绣"和"绣艺"取最常用的"刺绣"
- 包含关系处理：如"苏绣"和"刺绣"同时保留（具体+通用）
- 数量控制：严格提取5-10个，确保质量而非数量

【输出格式】
["关键词1", "关键词2", "关键词3", ...]

【质量检查】
□ 是否包含非遗专业术语
□ 是否避免过于通用的词汇
□ 是否按重要性排序
□ 数量是否在5-10个范围内"""
                },
                {
                    "role": "user",
                    "content": f"请从以下文本中提取关键词：\n\n{optimized_text}\n\n请直接输出JSON数组格式："
                }
            ]

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "model": "qwen-turbo",
                "input": {"messages": messages},
                "parameters": {
                    "result_format": "message",
                    "temperature": 0.2,  # 较低温度确保稳定性
                },
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                content = data["output"]["choices"][0]["message"]["content"]
                
                json_match = re.search(r'\[[\s\S]*\]', content)
                if json_match:
                    keywords = json.loads(json_match.group())
                    return [k for k in keywords if isinstance(k, str)][:10]
                else:
                    print("⚠️ AI 返回内容中未找到 JSON 数组，使用 Mock 关键词")
                    return self._mock_keywords(text)
        except httpx.HTTPStatusError as e:
            print(f"⚠️ 关键词提取 HTTP 错误: {e}, 使用 Mock 关键词降级")
            return self._mock_keywords(text)
        except httpx.TimeoutException as e:
            print(f"⚠️ 关键词提取超时: {e}, 使用 Mock 关键词降级")
            return self._mock_keywords(text)
        except json.JSONDecodeError as e:
            print(f"⚠️ 关键词提取 JSON 解析失败: {e}, 使用 Mock 关键词降级")
            return self._mock_keywords(text)
        except Exception as e:
            print(f"⚠️ 关键词提取异常: {e}, 使用 Mock 关键词降级")
            return self._mock_keywords(text)

    async def extract_relations(
        self,
        text: str,
        entities: List[Entity]
    ) -> List[Relation]:
        if not entities or len(entities) < 2:
            return []

        if not self.api_key:
            print("⚠️ API Key 未配置，使用 Mock 关系提取")
            return self._mock_relations(entities)

        try:
            entity_list = "\n".join([f"- {e.name} ({e.type.value})" for e in entities])

            # ✅ 新增：优化文本长度
            optimized_text = optimize_text_for_extraction(text, max_length=2500)

            # ✅ 竞赛级优化：使用 System Prompt + 结构化指令
            messages = [
                {
                    "role": "system",
                    "content": """你是一位专业的非遗知识图谱关系抽取专家。

【任务目标】
分析给定实体之间的关系，构建准确的非遗知识图谱。

【关系类型定义】
1. inherits（传承）：传承人 → 技艺
   - 含义：传承人学习、掌握并传承某项技艺
   - 示例：张三 inherits 苏绣
   - 置信度：高（0.85-0.95）当明确提到师徒关系或传承关系

2. origin（发源地）：地区 → 技艺
   - 含义：某地区是某项技艺的发源地或主要流行地
   - 示例：苏州 origin 苏绣
   - 置信度：高（0.90-0.95）当明确提及发源地

3. creates（制作）：技艺 → 作品
   - 含义：某项技艺用于制作某件作品
   - 示例：苏绣 creates 《猫》
   - 置信度：中-高（0.80-0.90）当作品明确由该技艺制作

4. flourished_in（兴盛于）：技艺 → 时期
   - 含义：某项技艺在某个历史时期达到鼎盛
   - 示例：苏绣 flourished_in 明清时期
   - 置信度：中（0.75-0.85）基于历史记载

5. located_in（位于）：地区 → 地区 或 作品 → 地区
   - 含义：地理位置的包含关系
   - 示例：苏州 located_in 江苏
   - 置信度：高（0.90-0.95）基于行政区划

6. uses_material（使用材料）：技艺 → 材料
   - 含义：某项技艺使用特定材料
   - 示例：苏绣 uses_material 丝绸
   - 置信度：中（0.75-0.85）当明确提及材料

7. has_pattern（包含纹样）：作品 → 纹样
   - 含义：某件作品包含特定纹样
   - 示例：《龙凤呈祥》 has_pattern 龙凤纹
   - 置信度：中（0.75-0.85）当明确描述纹样

8. related_to（相关）：任意 → 任意
   - 含义：两者存在关联但关系不明确
   - 示例：苏绣 related_to 湘绣
   - 置信度：低-中（0.60-0.75）用于弱关联

【关系抽取规则】
✅ 必须抽取：
- 明确的传承关系（师徒、家族传承）
- 明确的发源地关系
- 明确的制作关系（技艺→作品）
- 明确的历史时期关联

❌ 禁止抽取：
- 推测性关系（无文本支持）
- 过于宽泛的关联
- 实体与自身的循环关系
- 重复关系（相同source+target+type只保留一个）

【置信度评分标准】
- 0.90-1.00：文本明确陈述，无歧义
- 0.80-0.89：文本强烈暗示，可合理推断
- 0.70-0.79：文本提及，需要一定推断
- 0.60-0.69：弱关联，仅作参考
- <0.60：不抽取

【复杂关系处理】
1. 多跳关系：A→B→C 拆分为 A→B 和 B→C
2. 双向关系：如"交流"拆分为两个单向 related_to
3. 层级关系：优先抽取直接关系，避免过度推断
4. 模糊关系：当不确定时使用 related_to 并降低置信度

【输出格式】
{
  "relations": [
    {
      "source": "源实体名称（必须在实体列表中）",
      "target": "目标实体名称（必须在实体列表中）",
      "type": "关系类型（8种之一）",
      "confidence": 0.00-1.00
    }
  ]
}

【质量检查清单】
□ source和target是否都在实体列表中
□ 关系类型是否符合定义
□ 置信度是否合理反映文本支持程度
□ 是否避免重复关系
□ 是否排除推测性关系"""
                },
                {
                    "role": "user",
                    "content": f"""{RELATION_EXTRACTION_FEW_SHOT}

实体列表：
{entity_list}

文本上下文：
{optimized_text}

请严格按照上述规则和格式输出关系JSON："""
                }
            ]

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "model": "qwen-turbo",
                "input": {"messages": messages},
                "parameters": {
                    "result_format": "message",
                    "temperature": 0.15,  # 较低温度确保关系抽取准确性
                },
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                content = data["output"]["choices"][0]["message"]["content"]
                
                json_match = re.search(r'\{[\s\S]*\}', content)
                if json_match:
                    result = json.loads(json_match.group())
                    relations = []
                    entity_map = {e.name: e.id for e in entities}
                    
                    print(f"\n=== AI 返回的关系数据 ===")
                    print(f"实体列表：{[(e.name, e.id) for e in entities]}")
                    print(f"AI 返回的关系：{result.get('relations', [])}")
                    
                    for i, r in enumerate(result.get("relations", [])):
                        source_name = r.get("source", "")
                        target_name = r.get("target", "")
                        
                        source_id = entity_map.get(source_name)
                        target_id = entity_map.get(target_name)
                        
                        if source_id and target_id:
                            relation_type_str = r.get("type", "related_to")
                            
                            valid_types = [
                                "inherits", "origin", "creates", "flourished_in",
                                "located_in", "uses_material", "has_pattern", "related_to"
                            ]
                            if relation_type_str not in valid_types:
                                relation_type_str = "related_to"
                            
                            from app.schemas.chat import RelationType
                            relations.append(Relation(
                                id=f"relation_{i}_{hash(source_id + target_id)}",
                                source=source_id,
                                target=target_id,
                                type=RelationType(relation_type_str),
                                confidence=r.get("confidence", 0.8),
                            ))
                        else:
                            print(f"警告：找不到实体 source={source_name} (id={source_id}), target={target_name} (id={target_id})")
                    
                    print(f"最终生成的关系数量：{len(relations)}")
                    return relations
                else:
                    print("⚠️ AI 返回内容中未找到 JSON，使用 Mock 关系")
                    return self._mock_relations(entities)
        except httpx.HTTPStatusError as e:
            print(f"⚠️ 关系提取 HTTP 错误: {e}, 使用 Mock 关系降级")
            return self._mock_relations(entities)
        except httpx.TimeoutException as e:
            print(f"⚠️ 关系提取超时: {e}, 使用 Mock 关系降级")
            return self._mock_relations(entities)
        except json.JSONDecodeError as e:
            print(f"⚠️ 关系提取 JSON 解析失败: {e}, 使用 Mock 关系降级")
            return self._mock_relations(entities)
        except Exception as e:
            print(f"⚠️ 关系提取异常: {e}, 使用 Mock 关系降级")
            return self._mock_relations(entities)

    def _mock_entities(self, text: str) -> List[Entity]:
        del text  # 保留参数用于未来动态提取
        # 使用一致的 ID 生成逻辑
        return [
            Entity(
                id=generate_entity_id("武汉木雕", "technique"),
                name="武汉木雕",
                type=EntityType.technique,
                description="湖北地区传统雕刻工艺",
                relevance=0.95,
            ),
            Entity(
                id=generate_entity_id("浮雕技法", "technique"),
                name="浮雕技法",
                type=EntityType.technique,
                description="在平面上雕刻凸起图案的技法",
                relevance=0.88,
            ),
            Entity(
                id=generate_entity_id("圆雕技法", "technique"),
                name="圆雕技法",
                type=EntityType.technique,
                description="立体雕刻技法，可多角度观赏",
                relevance=0.85,
            ),
            Entity(
                id="entity_4",
                name="黄鹤楼",
                type=EntityType.work,
                description="武汉木雕代表作品",
                relevance=0.82,
            ),
            Entity(
                id="entity_5",
                name="武汉",
                type=EntityType.region,
                description="湖北省省会，木雕技艺发源地",
                relevance=0.78,
            ),
            Entity(
                id="entity_6",
                name="镂空雕",
                type=EntityType.technique,
                description="穿透材料形成透空效果的技法",
                relevance=0.75,
            ),
        ]

    def _mock_keywords(self, text: str) -> List[str]:
        del text  # 保留参数用于未来动态提取
        return ["木雕", "浮雕", "圆雕", "镂空雕", "黄鹤楼", "武汉", "传统工艺", "雕刻技法"]

    def _mock_relations(self, entities: List[Entity]) -> List[Relation]:
        print(f"\n=== 调用 Mock Relations ===")
        print(f"传入实体：{[(e.id, e.name) for e in entities]}")
        
        entity_map = {e.name: e.id for e in entities}
        relations = []
        
        mock_relation_data = [
            ("武汉木雕", "武汉", "origin", 0.9),
            ("黄鹤楼", "武汉", "located_in", 0.8),
            ("黄鹤楼", "浮雕技法", "creates", 0.75),
        ]
        
        for i, (source_name, target_name, rel_type, confidence) in enumerate(mock_relation_data):
            source_id = entity_map.get(source_name)
            target_id = entity_map.get(target_name)
            
            print(f"查找关系：{source_name} -> {target_name}, source_id={source_id}, target_id={target_id}")
            
            if source_id and target_id:
                relations.append(Relation(
                    id=f"relation_{i}",
                    source=source_id,
                    target=target_id,
                    type=rel_type,
                    confidence=confidence,
                ))
        
        print(f"Mock 生成的关系数量：{len(relations)}")
        return relations

    async def analyze_query(self, query: str) -> dict:
        """
        分析用户查询，提取意图和过滤条件
        返回：{"entity_types": [], "regions": [], "periods": [], "keywords": [], "intent": "", "confidence": 0.0}
        """
        if not self.api_key:
            return self._mock_query_analysis(query)

        try:
            # ✅ 竞赛级优化：使用 System Prompt + 结构化指令
            messages = [
                {
                    "role": "system",
                    "content": """你是一位专业的非遗领域查询意图分析专家。

【任务目标】
分析用户查询，准确识别查询意图和关键信息，用于优化知识检索和回答生成。

【意图分类体系】
1. 知识查询（knowledge_query）
   - 特征：询问非遗项目的定义、历史、特点等
   - 示例："什么是苏绣？"、"京剧的历史起源"
   - 置信度：高

2. 传承人查询（inheritor_query）
   - 特征：询问特定传承人信息
   - 示例："苏绣有哪些著名传承人？"、"张三是谁？"
   - 置信度：高

3. 地区查询（region_query）
   - 特征：询问某地区的非遗项目
   - 示例："苏州有哪些非遗？"、"湖北的传统工艺"
   - 置信度：高

4. 比较查询（comparison_query）
   - 特征：比较两个或多个非遗项目
   - 示例："苏绣和湘绣有什么区别？"、"四大名绣对比"
   - 置信度：中-高

5. 技艺学习（learning_query）
   - 特征：询问如何学习某项技艺
   - 示例："如何学习剪纸？"、"刺绣入门方法"
   - 置信度：中

6. 保护现状（protection_query）
   - 特征：询问非遗保护情况
   - 示例："这项技艺的保护现状如何？"、"非遗保护措施"
   - 置信度：中

7. 闲聊/其他（chat/other）
   - 特征：与非遗无关或泛泛而谈
   - 示例："你好"、"今天天气怎么样"
   - 置信度：低

【实体类型识别】
从查询中提取可能的实体类型：
- inheritor：提及传承人、大师、艺人
- technique：提及技艺、工艺、技法
- work：提及作品、代表作
- region：提及地区、地点
- period：提及年代、时期
- material：提及材料、原料

【地区识别规则】
- 省份：江苏、浙江、广东等
- 城市：苏州、杭州、景德镇等
- 区县：具体区县名称

【时期识别规则】
- 朝代：唐、宋、元、明、清等
- 时期：古代、近代、现代、当代
- 世纪：20世纪、21世纪等

【关键词提取标准】
- 提取2-5个核心词汇
- 优先提取非遗专业术语
- 避免过于通用的词汇（如"文化"、"传统"）

【消歧策略】
1. 同名实体：根据上下文判断最可能的含义
2. 模糊查询：标记为多种可能意图，降低置信度
3. 多意图查询：识别主要意图和次要意图

【输出格式】
{
  "entity_types": ["inheritor", "technique", ...],
  "regions": ["苏州", "江苏"],
  "periods": ["明清", "近代"],
  "keywords": ["关键词1", "关键词2"],
  "intent": "意图分类（knowledge_query/inheritor_query/region_query/comparison_query/learning_query/protection_query/chat/other）",
  "confidence": 0.0-1.0,
  "secondary_intent": "次要意图（可选）"
}

【置信度评分】
- 0.90-1.00：查询明确，意图清晰
- 0.75-0.89：查询较明确，有少量歧义
- 0.60-0.74：查询有一定模糊性
- 0.40-0.59：查询较模糊，难以确定意图
- <0.40：无法确定意图"""
                },
                {
                    "role": "user",
                    "content": f"请分析以下查询：\n\n查询：{query}\n\n请严格按照上述格式返回JSON："
                }
            ]

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "model": "qwen-turbo",
                "input": {"messages": messages},
                "parameters": {
                    "result_format": "message",
                    "temperature": 0.1,  # 低温度确保意图识别稳定性
                },
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                content = data["output"]["choices"][0]["message"]["content"]
                
                json_match = re.search(r'\{[\s\S]*\}', content)
                if json_match:
                    return json.loads(json_match.group())
        except Exception as e:
            print(f"Query analysis error: {e}")
        
        return self._mock_query_analysis(query)

    def _mock_query_analysis(self, query: str) -> dict:
        """模拟查询分析"""
        # 简单的关键词匹配
        entity_types = []
        regions = []
        periods = []
        keywords = query.split()
        
        # 简单规则匹配
        if any(kw in query for kw in ["技艺", "工艺", "技法"]):
            entity_types.append("technique")
        if any(kw in query for kw in ["作品", "代表作", "雕刻"]):
            entity_types.append("work")
        if any(kw in query for kw in ["传承人", "人物", "大师"]):
            entity_types.append("person")
        
        if "武汉" in query:
            regions.append("武汉")
        if "湖北" in query:
            regions.append("湖北")
        
        if "明清" in query:
            periods.append("明清")
        if "现代" in query:
            periods.append("现代")
        
        return {
            "entity_types": entity_types,
            "regions": regions,
            "periods": periods,
            "keywords": keywords,
            "intent": "知识图谱搜索",
        }


llm_service = LLMService()
