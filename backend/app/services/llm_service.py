from typing import Optional, AsyncGenerator, List
import httpx
import json
import re
import asyncio
import random
from datetime import datetime, timezone
from enum import Enum
from app.core.config import settings
from app.schemas.chat import Entity, EntityType, Relation


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
        self.primary_model = "qwen-max"
        self.fallback_models = ["qwen-turbo", "qwen-plus"]
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
            print("⚠️ API Key 未配置，使用本地响应")
            return generate_fallback_response(message)

        messages = context or []
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
            return await self._execute_with_retry(_do_chat)
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
        if not self.api_key:
            # 降级：无 API Key 时分块返回本地响应
            print("⚠️ API Key 未配置，使用流式本地响应")
            fallback = generate_fallback_response(message)
            chunk_size = 50
            for i in range(0, len(fallback), chunk_size):
                yield fallback[i:i + chunk_size]
                await asyncio.sleep(0.05)
            return

        messages = context or []
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
        except Exception as e:
            print(f"LLM streaming error: {e}")
            self._record_error()
            # 降级：分块返回 fallback 响应
            print("⚠️ 流式降级到本地响应")
            fallback = generate_fallback_response(message)
            chunk_size = 50
            for i in range(0, len(fallback), chunk_size):
                yield fallback[i:i + chunk_size]
                await asyncio.sleep(0.05)  # 模拟打字速度

    async def extract_entities(self, text: str) -> List[Entity]:
        if not self.api_key:
            print("⚠️ API Key 未配置，使用 Mock 实体提取")
            return self._mock_entities(text)

        try:
            prompt = f"""从以下文本中识别非遗相关实体，并以 JSON 格式输出。

实体类型包括：
- inheritor: 传承人
- technique: 技艺
- work: 作品
- pattern: 纹样
- region: 地区
- period: 时期
- material: 材料

输出格式：
{{
  "entities": [
    {{
      "id": "唯一标识",
      "name": "实体名称",
      "type": "实体类型",
      "description": "简短描述",
      "relevance": 0.0-1.0
    }}
  ]
}}

文本：
{text[:2000]}

请输出 JSON："""

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "model": "qwen-turbo",
                "input": {"messages": [{"role": "user", "content": prompt}]},
                "parameters": {
                    "result_format": "message",
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
                
                print(f"\n=== AI 返回的原始内容 ===")
                print(content[:500])
                
                json_match = re.search(r'\{[\s\S]*\}', content)
                if json_match:
                    result = json.loads(json_match.group())
                    entities = []
                    
                    for i, e in enumerate(result.get("entities", [])):
                        entity_type = e.get("type", "technique")
                        if entity_type not in ["inheritor", "technique", "work", "pattern", "region", "period", "material"]:
                            entity_type = "technique"
                        
                        entities.append(Entity(
                            id=e.get("id", f"entity_{i}_{hash(e.get('name', ''))}"),
                            name=e.get("name", ""),
                            type=EntityType(entity_type),
                            description=e.get("description"),
                            relevance=e.get("relevance", 0.8),
                        ))
                    print(f"\n提取的实体 ID: {[e.id for e in entities[:5]]}")
                    return entities
                else:
                    print("⚠️ AI 返回内容中未找到 JSON，使用 Mock 实体")
                    return self._mock_entities(text)
        except httpx.HTTPStatusError as e:
            print(f"⚠️ 实体提取 HTTP 错误: {e}, 使用 Mock 实体降级")
            return self._mock_entities(text)
        except httpx.TimeoutException as e:
            print(f"⚠️ 实体提取超时: {e}, 使用 Mock 实体降级")
            return self._mock_entities(text)
        except json.JSONDecodeError as e:
            print(f"⚠️ 实体提取 JSON 解析失败: {e}, 使用 Mock 实体降级")
            return self._mock_entities(text)
        except Exception as e:
            print(f"⚠️ 实体提取异常: {e}, 使用 Mock 实体降级")
            return self._mock_entities(text)

    async def extract_keywords(self, text: str) -> List[str]:
        if not self.api_key:
            print("⚠️ API Key 未配置，使用 Mock 关键词提取")
            return self._mock_keywords(text)

        try:
            prompt = f"""从以下文本中提取 5-10 个关键词或短语。

要求：
1. 每个关键词长度 2-8 个字
2. 优先提取核心概念、特色术语
3. 避免过于通用的词汇
4. 按重要性排序

输出格式（JSON 数组）：
["关键词1", "关键词2", ...]

文本：
{text[:1500]}

请输出关键词："""

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "model": "qwen-turbo",
                "input": {"messages": [{"role": "user", "content": prompt}]},
                "parameters": {
                    "result_format": "message",
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
            
            prompt = f"""分析以下实体之间的关系，构建知识图谱。

可用关系类型：
- inherits: 传承（传承人 → 技艺）
- origin: 发源地（地区 → 技艺）
- creates: 用于制作（技艺 → 作品）
- flourished_in: 兴盛于（技艺 → 时期）
- located_in: 位于（地区 → 地区）
- uses_material: 使用材料（技艺 → 材料）
- has_pattern: 包含纹样（作品 → 纹样）
- related_to: 相关

实体列表：
{entity_list}

文本上下文：
{text[:1500]}

输出格式（JSON）：
{{
  "relations": [
    {{
      "source": "源实体名称",
      "target": "目标实体名称",
      "type": "关系类型",
      "confidence": 0.0-1.0
    }}
  ]
}}

请输出关系："""

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "model": "qwen-turbo",
                "input": {"messages": [{"role": "user", "content": prompt}]},
                "parameters": {
                    "result_format": "message",
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
        return [
            Entity(
                id="entity_1",
                name="武汉木雕",
                type=EntityType.technique,
                description="湖北地区传统雕刻工艺",
                relevance=0.95,
            ),
            Entity(
                id="entity_2",
                name="浮雕技法",
                type=EntityType.technique,
                description="在平面上雕刻凸起图案的技法",
                relevance=0.88,
            ),
            Entity(
                id="entity_3",
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
        返回：{"entity_types": [], "regions": [], "periods": [], "keywords": []}
        """
        if not self.api_key:
            return self._mock_query_analysis(query)
        
        try:
            prompt = f"""分析以下查询的意图，提取关键信息：

查询：{query}

请分析并返回以下信息（JSON 格式）：
{{
  "entity_types": ["可能的实体类型"],
  "regions": ["提到的地区"],
  "periods": ["提到的时期"],
  "keywords": ["关键词"],
  "intent": "查询意图描述"
}}

只返回 JSON，不要其他内容："""

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            payload = {
                "model": "qwen-turbo",
                "input": {"messages": [{"role": "user", "content": prompt}]},
                "parameters": {
                    "result_format": "message",
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
