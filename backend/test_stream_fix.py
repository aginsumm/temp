#!/usr/bin/env python3
"""
测试流式输出修复
验证 flush 是否正确执行
"""

import asyncio
import httpx
import json

BASE_URL = '${import.meta.env.VITE_API_URL}'
API_PREFIX = "/api/v1"


async def test_stream_flush():
    """测试流式输出是否及时 flush"""
    print("=" * 60)
    print("测试流式输出 flush 修复")
    print("=" * 60)
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            print("\n发送流式请求...")
            async with client.stream(
                "POST",
                f"{BASE_URL}{API_PREFIX}/chat/stream",
                json={
                    "session_id": "test_stream_flush_001",
                    "content": "你好，请介绍一下非物质文化遗产",
                    "message_type": "text"
                }
            ) as response:
                print(f"响应状态码：{response.status_code}")
                print(f"响应头：{response.headers.get('content-type')}")
                
                chunk_count = 0
                first_chunk_time = None
                
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        try:
                            data = json.loads(line[5:])
                            chunk_count += 1
                            
                            if first_chunk_time is None:
                                import time
                                first_chunk_time = time.time()
                                print(f"\n✓ 收到第一个 chunk (耗时：{(first_chunk_time - start_time)*1000:.2f}ms)")
                            
                            if data.get("type") == "content_chunk":
                                content = data.get("content", "")
                                print(f"[Chunk {chunk_count}] 长度：{len(content)} - 内容：{content[:50]}...")
                            elif data.get("type") == "entities":
                                print(f"\n✓ 收到实体：{len(data.get('entities', []))} 个")
                            elif data.get("type") == "keywords":
                                print(f"✓ 收到关键词：{data.get('keywords', [])}")
                            elif data.get("type") == "complete":
                                print(f"\n✓ 流式传输完成")
                                print(f"总 chunk 数：{chunk_count}")
                                break
                        except json.JSONDecodeError as e:
                            print(f"JSON 解析错误：{e}")
                            continue
            
            print("\n✓ 测试完成")
            return True
            
        except Exception as e:
            print(f"\n✗ 测试失败：{e}")
            import traceback
            traceback.print_exc()
            return False


if __name__ == "__main__":
    start_time = asyncio.get_event_loop().time()
    result = asyncio.run(test_stream_flush())
    end_time = asyncio.get_event_loop().time()
    
    print(f"\n总耗时：{(end_time - start_time):.2f}秒")
    print(f"测试结果：{'通过' if result else '失败'}")
