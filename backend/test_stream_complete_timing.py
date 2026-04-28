"""
流式响应修复验证测试
测试后端是否正确发送 [DONE] 标记并关闭流
"""
import asyncio
import httpx
import json
import time
import sys


async def test_stream_complete_timing():
    """测试流式响应完成时间"""
    print("=" * 60)
    print("流式响应完成时间测试")
    print("=" * 60)
    
    api_base_url = "http://localhost:8000/api/v1"
    session_id = f"test_stream_{int(time.time())}"
    
    test_cases = [
        ("短文本", "什么是苏绣？"),
        ("中文本", "请简要介绍武汉木雕的历史"),
        ("长文本", "请详细介绍汉绣的制作工艺流程，包括核心工艺、工艺流程、技艺特点等"),
    ]
    
    results = []
    
    for case_name, question in test_cases:
        print(f"\n{'='*60}")
        print(f"测试：{case_name}")
        print(f"问题：{question}")
        print("=" * 60)
        
        try:
            start_time = time.time()
            first_chunk_time = None
            complete_time = None
            done_received_time = None
            content_length = 0
            
            headers = {"Content-Type": "application/json"}
            payload = {
                "session_id": session_id,
                "content": question,
                "message_type": "text"
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST",
                    f"{api_base_url}/chat/stream",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status_code != 200:
                        print(f"✗ 请求失败：HTTP {response.status_code}")
                        continue
                    
                    async for line in response.aiter_lines():
                        current_time = time.time()
                        
                        if line.startswith("data: "):
                            data_str = line[6:]  # 移除 "data: " 前缀
                            
                            if data_str == "[DONE]":
                                done_received_time = current_time
                                print(f"✅ 收到 [DONE] 标记")
                                break
                            
                            try:
                                data = json.loads(data_str)
                                
                                if data.get("type") == "content_chunk":
                                    if first_chunk_time is None:
                                        first_chunk_time = current_time
                                        print(f"⏱️  第一个 chunk: {current_time - start_time:.2f}s")
                                    
                                    content = data.get("content", "")
                                    content_length += len(content)
                                    # 打印前 50 个字符作为示例
                                    if content_length <= 50:
                                        print(f"📝 内容：{content}", end="", flush=True)
                                    elif content_length == 51:
                                        print("...")
                                
                                elif data.get("type") == "complete":
                                    complete_time = current_time
                                    print(f"\n✅ 收到 complete 事件：{current_time - start_time:.2f}s")
                                    
                            except json.JSONDecodeError:
                                continue
            
            end_time = time.time()
            total_time = end_time - start_time
            
            print(f"\n{'='*60}")
            print(f"统计信息：")
            print(f"  总内容长度：{content_length} 字符")
            print(f"  第一个 chunk: {first_chunk_time - start_time if first_chunk_time else 'N/A':.2f}s")
            print(f"  complete 事件：{complete_time - start_time if complete_time else 'N/A':.2f}s")
            print(f"  [DONE] 标记：{done_received_time - start_time if done_received_time else 'N/A':.2f}s")
            print(f"  总时间：{total_time:.2f}s")
            
            # 评估
            if done_received_time:
                delay = done_received_time - complete_time if complete_time else total_time
                if delay < 0.5:
                    print(f"✅ 优秀：[DONE] 延迟 {delay:.2f}s")
                elif delay < 2:
                    print(f"🟡 良好：[DONE] 延迟 {delay:.2f}s")
                else:
                    print(f"🔴 需改进：[DONE] 延迟 {delay:.2f}s")
            else:
                print(f"🔴 未收到 [DONE] 标记")
            
            results.append({
                "case": case_name,
                "total_time": total_time,
                "content_length": content_length,
                "done_received": done_received_time is not None
            })
            
        except Exception as e:
            print(f"\n❌ 测试失败：{e}")
            results.append({
                "case": case_name,
                "error": str(e)
            })
    
    # 总结
    print(f"\n{'='*60}")
    print("测试总结")
    print("=" * 60)
    
    for result in results:
        if "error" in result:
            print(f"❌ {result['case']}: {result['error']}")
        else:
            status = "✅" if result['done_received'] else "❌"
            print(f"{status} {result['case']}: {result['total_time']:.2f}s ({result['content_length']} 字符)")
    
    print("=" * 60)
    print("测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_stream_complete_timing())
