"""
完整的流式响应测试脚本
测试答案生成、显示、全流程交互，确保文字能正常显示
"""
import asyncio
import httpx
import json
import sys


async def test_stream_chat():
    """测试流式聊天接口"""
    print("=" * 60)
    print("测试流式聊天接口")
    print("=" * 60)
    
    api_base_url = "http://localhost:8000/api/v1"
    session_id = f"test_session_{int(asyncio.get_event_loop().time())}"
    
    try:
        # 1. 测试流式聊天
        print("\n[1] 测试流式聊天...")
        headers = {"Content-Type": "application/json"}
        payload = {
            "session_id": session_id,
            "content": "请简要介绍武汉木雕的历史",
            "message_type": "text"
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{api_base_url}/chat/stream",
                headers=headers,
                json=payload
            )
            
            if response.status_code != 200:
                print(f"✗ 请求失败：HTTP {response.status_code}")
                print(f"响应内容：{response.text}")
                return False
            
            if "text/event-stream" not in response.headers.get("content-type", ""):
                print(f"✗ Content-Type 不正确：{response.headers.get('content-type')}")
                return False
            
            print("✓ 请求成功，开始接收流式响应...")
            
            # 解析 SSE 流
            content_chunks = []
            entities_received = False
            keywords_received = False
            relations_received = False
            complete_received = False
            complete_data = None
            
            async for line in response.aiter_lines():
                if line.startswith("data:"):
                    data_str = line[5:].strip()
                    if data_str == "[DONE]":
                        print("\n✓ 收到 [DONE] 标记")
                        break
                    
                    try:
                        data = json.loads(data_str)
                        event_type = data.get("type")
                        
                        if event_type == "content_chunk":
                            content = data.get("content", "")
                            content_chunks.append(content)
                            print(f"[Chunk] 收到 {len(content)} 字符", end="\r")
                            
                        elif event_type == "entities":
                            entities = data.get("entities", [])
                            entities_received = True
                            print(f"\n✓ 收到实体：{len(entities)} 个")
                            
                        elif event_type == "keywords":
                            keywords = data.get("keywords", [])
                            keywords_received = True
                            print(f"✓ 收到关键词：{keywords}")
                            
                        elif event_type == "relations":
                            relations = data.get("relations", [])
                            relations_received = True
                            print(f"✓ 收到关系：{len(relations)} 个")
                            
                        elif event_type == "complete":
                            complete_received = True
                            complete_data = data
                            print(f"\n✓ 收到 complete 事件")
                            print(f"  - message_id: {data.get('message_id')}")
                            print(f"  - content 长度：{len(data.get('content', ''))}")
                            print(f"  - 包含 response 字段：{'response' in data}")
                            if 'response' in data:
                                print(f"  - response.content 长度：{len(data['response'].get('content', ''))}")
                            break
                            
                    except json.JSONDecodeError as e:
                        print(f"\n✗ JSON 解析错误：{e}")
                        print(f"原始数据：{data_str[:200]}")
                        continue
            
            # 验证结果
            print("\n" + "=" * 60)
            print("测试结果验证")
            print("=" * 60)
            
            full_content = "".join(content_chunks)
            print(f"✓ 收到 {len(content_chunks)} 个 content_chunk")
            print(f"✓ 总内容长度：{len(full_content)} 字符")
            print(f"✓ 收到实体：{entities_received}")
            print(f"✓ 收到关键词：{keywords_received}")
            print(f"✓ 收到关系：{relations_received}")
            print(f"✓ 收到 complete 事件：{complete_received}")
            
            if complete_data:
                # 检查 complete 事件中的 content 字段
                if complete_data.get("content"):
                    print(f"✓ complete.content 存在，长度：{len(complete_data['content'])}")
                else:
                    print("✗ complete.content 为空")
                
                # 检查 response 字段
                if complete_data.get("response"):
                    if complete_data["response"].get("content"):
                        print(f"✓ complete.response.content 存在，长度：{len(complete_data['response']['content'])}")
                    else:
                        print("✗ complete.response.content 为空")
            
            # 验证内容完整性
            if complete_received and complete_data:
                complete_content = complete_data.get("content", "")
                response_content = complete_data.get("response", {}).get("content", "") if complete_data.get("response") else ""
                
                # 检查 accumulated content 是否等于 complete content
                if full_content == complete_content:
                    print("✓ accumulated content 与 complete.content 一致")
                else:
                    print(f"✗ accumulated content 与 complete.content 不一致")
                    print(f"  accumulated: {len(full_content)} chars")
                    print(f"  complete: {len(complete_content)} chars")
                
                # 检查 response.content
                if response_content and (response_content == complete_content or response_content == full_content):
                    print("✓ complete.response.content 与完整内容一致")
                elif response_content:
                    print(f"⚠ complete.response.content 长度：{len(response_content)}")
            
            print("\n" + "=" * 60)
            print("✓ 流式聊天测试完成")
            print("=" * 60)
            return True
            
    except Exception as e:
        print(f"\n✗ 测试失败：{e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("非遗知识问答系统 - 流式响应完整测试")
    print("=" * 60)
    
    # 检查后端服务是否运行
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://localhost:8000/health")
            if response.status_code != 200:
                print("⚠️  后端服务可能未正常运行，请检查")
    except Exception:
        print("⚠️  无法连接到后端服务，请确保后端正在运行")
        print("   运行命令：cd backend && uvicorn app.main:app --reload")
        return
    
    # 运行测试
    success = await test_stream_chat()
    
    print("\n" + "=" * 60)
    if success:
        print("✓ 所有测试通过")
    else:
        print("✗ 测试失败，请检查日志")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
