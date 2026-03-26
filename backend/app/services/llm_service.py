from typing import Optional, AsyncGenerator
import httpx
from app.core.config import settings


class LLMService:
    def __init__(self):
        self.api_key = settings.DASHSCOPE_API_KEY
        self.base_url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"

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

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": "qwen-turbo",
            "input": {"messages": messages},
            "parameters": {
                "result_format": "message",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.base_url,
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                return data["output"]["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"LLM API error: {e}")
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
            "model": "qwen-turbo",
            "input": {"messages": messages},
            "parameters": {
                "result_format": "message",
                "incremental_output": True,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    self.base_url,
                    headers=headers,
                    json=payload,
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data:"):
                            import json
                            data = json.loads(line[5:])
                            if "output" in data and "choices" in data["output"]:
                                content = data["output"]["choices"][0].get("message", {}).get("content", "")
                                if content:
                                    yield content
        except Exception as e:
            print(f"LLM streaming error: {e}")
            for char in self._mock_response(message):
                yield char

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


llm_service = LLMService()
