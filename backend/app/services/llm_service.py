from typing import Optional, AsyncGenerator, List
import httpx
import json
import re
import asyncio
from datetime import datetime
from app.core.config import settings
from app.schemas.chat import Entity, EntityType, Relation


class LLMService:
    def __init__(self):
        self.api_key = settings.DASHSCOPE_API_KEY
        self.base_url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
        
        # 降级策略配置
        self.max_retries = 3
        self.retry_delays = [1, 2, 4]  # 指数退避
        self.timeout_seconds = 60.0
        self.fallback_enabled = True
        
        # 备用模型
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

    def _get_current_model(self) -> str:
        """获取当前使用的模型"""
        if self.current_model_index >= len(self.fallback_models):
            return self.fallback_models[-1]
        return self.fallback_models[self.current_model_index]

    def _switch_to_fallback(self):
        """切换到备用模型"""
        self.current_model_index += 1
        if self.current_model_index < len(self.fallback_models):
            print(f"Switching to fallback model: {self.fallback_models[self.current_model_index]}")

    def _reset_model(self):
        """重置模型到主模型"""
        self.current_model_index = 0
        self.is_degraded = False
        self.degraded_since = None

    def _record_error(self):
        """记录错误"""
        self.error_counts["total"] += 1
        self.error_counts["consecutive"] += 1
        self.error_counts["last_error_time"] = datetime.utcnow()
        
        # 连续错误 3 次后进入降级状态（降低阈值）
        if self.error_counts["consecutive"] >= 3:
            if not self.is_degraded:
                self.is_degraded = True
                self.degraded_since = datetime.utcnow()
                print("LLM service entering degraded state")

    def _record_success(self):
        """记录成功"""
        # 重置连续错误计数
        was_degraded = self.is_degraded
        self.error_counts["consecutive"] = 0
        
        # 如果之前处于降级状态，重置回主模型
        if self.is_degraded:
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
            return self._mock_response(args[0] if args else "")
        
        raise last_exception

    async def chat(
        self,
        message: str,
        context: Optional[list[dict]] = None,
        stream: bool = False,
    ) -> str:
        if not self.api_key:
            return self._mock_response(message)

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
                    return result
            except Exception as e:
                # 让外层的 _execute_with_retry 处理错误记录
                raise

        try:
            return await self._execute_with_retry(_do_chat)
        except Exception as e:
            print(f"LLM API error after retries: {e}")
            return self._mock_response(message)

    async def chat_stream(
        self,
        message: str,
        context: Optional[list[dict]] = None,
    ) -> AsyncGenerator[str, None]:
        if not self.api_key:
            for char in self._mock_response(message):
                yield char
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
            # 降级到 mock 响应
            for char in self._mock_response(message):
                yield char

    async def extract_entities(self, text: str) -> List[Entity]:
        if not self.api_key:
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
                    return entities
        except Exception as e:
            print(f"Entity extraction error: {e}")

        return self._mock_entities(text)

    async def extract_keywords(self, text: str) -> List[str]:
        if not self.api_key:
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
        except Exception as e:
            print(f"Keyword extraction error: {e}")

        return self._mock_keywords(text)

    async def extract_relations(
        self, 
        text: str, 
        entities: List[Entity]
    ) -> List[Relation]:
        if not entities or len(entities) < 2:
            return []

        if not self.api_key:
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
                    return relations
        except Exception as e:
            print(f"Relation extraction error: {e}")

        return self._mock_relations(entities)

    def _mock_response(self, message: str) -> str:
        return f"""武汉木雕作为湖北地区重要的传统工艺，具有多种代表性的雕刻技法，主要包括：

## 🎨 主要技法分类

**1. 浮雕技法**
浮雕是在平面上雕刻出凸起图案的技法，武汉木雕的浮雕以层次丰富、线条流畅著称。代表作有《黄鹤楼》浮雕屏风等。

**2. 圆雕技法**
圆雕是立体雕刻技法，可以从多个角度观赏。武汉木雕的圆雕作品造型生动，神态逼真。代表作有《观音像》、《寿星》等。

**3. 镂空雕技法**
镂空雕是在雕刻中穿透材料形成透空效果的技法，武汉木雕的镂空雕工艺精湛，层次分明。代表作有《龙凤呈祥》屏风等。

**4. 透雕技法**
透雕是介于浮雕和圆雕之间的技法，具有立体感和空间感。武汉木雕的透雕作品结构精巧，虚实相生。

## 📚 参考资料
• 《湖北地方志》卷三，工艺篇，第128-135页
• 武汉木雕传承人访谈记录，2023年
• 《中国传统工艺全集》木雕卷，第45-52页"""

    def _mock_entities(self, text: str) -> List[Entity]:
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
        return ["木雕", "浮雕", "圆雕", "镂空雕", "黄鹤楼", "武汉", "传统工艺", "雕刻技法"]

    def _mock_relations(self, entities: List[Entity]) -> List[Relation]:
        entity_map = {e.name: e.id for e in entities}
        relations = []
        
        mock_relation_data = [
            ("武汉木雕", "武汉", "origin", 0.9),
            ("浮雕技法", "武汉木雕", "related_to", 0.85),
            ("圆雕技法", "武汉木雕", "related_to", 0.85),
            ("镂空雕", "武汉木雕", "related_to", 0.85),
            ("黄鹤楼", "武汉", "located_in", 0.8),
            ("黄鹤楼", "浮雕技法", "creates", 0.75),
        ]
        
        for i, (source_name, target_name, rel_type, confidence) in enumerate(mock_relation_data):
            source_id = entity_map.get(source_name)
            target_id = entity_map.get(target_name)
            
            if source_id and target_id:
                relations.append(Relation(
                    id=f"relation_{i}",
                    source=source_id,
                    target=target_id,
                    type=rel_type,
                    confidence=confidence,
                ))
        
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
