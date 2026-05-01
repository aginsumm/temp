#!/usr/bin/env python3
"""
动态知识图谱生成系统 - 功能验证测试脚本
测试范围：
1. API 端点可用性
2. 实体识别功能
3. 关键词提取功能
4. 关系推断功能
5. 图谱快照功能
6. SSE 流式接口
"""

import asyncio
import httpx
import json
from typing import Optional

BASE_URL = '${import.meta.env.VITE_API_URL}'
API_PREFIX = "/api/v1"


class TestClient:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
        self.token: Optional[str] = None

    async def setup(self):
        """初始化测试环境"""
        print("=" * 60)
        print("动态知识图谱生成系统 - 功能验证测试")
        print("=" * 60)

    async def test_health_check(self):
        """测试健康检查接口"""
        print("\n[测试 1] 健康检查...")
        try:
            response = await self.client.get(f"{self.base_url}/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            print("✓ 健康检查通过")
            return True
        except Exception as e:
            print(f"✗ 健康检查失败：{e}")
            return False

    async def test_root_endpoint(self):
        """测试根接口"""
        print("\n[测试 2] 根接口...")
        try:
            response = await self.client.get(f"{self.base_url}/")
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            print(f"✓ 根接口返回：{data['message']}")
            return True
        except Exception as e:
            print(f"✗ 根接口失败：{e}")
            return False

    async def test_chat_stream(self):
        """测试流式聊天接口"""
        print("\n[测试 3] 流式聊天接口...")
        try:
            session_id = "test_session_001"
            
            response = await self.client.post(
                f"{self.base_url}{API_PREFIX}/chat/stream",
                json={
                    "session_id": session_id,
                    "content": "武汉木雕有哪些主要技法？",
                    "message_type": "text"
                }
            )
            
            assert response.status_code == 200
            assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
            
            content_received = False
            entities_received = False
            keywords_received = False
            
            async for line in response.aiter_lines():
                if line.startswith("data:"):
                    data = json.loads(line[5:])
                    if data.get("type") == "content_chunk":
                        content_received = True
                    elif data.get("type") == "entities":
                        entities_received = True
                        print(f"  收到实体：{len(data.get('entities', []))} 个")
                    elif data.get("type") == "keywords":
                        keywords_received = True
                        print(f"  收到关键词：{data.get('keywords', [])}")
                    elif data.get("type") == "complete":
                        print(f"  流式传输完成")
                        break
            
            if content_received and entities_received and keywords_received:
                print("✓ 流式聊天接口通过")
                return True
            else:
                print(f"✗ 流式聊天接口不完整：content={content_received}, entities={entities_received}, keywords={keywords_received}")
                return False
                
        except Exception as e:
            print(f"✗ 流式聊天接口失败：{e}")
            return False

    async def test_chat_message(self):
        """测试普通聊天接口"""
        print("\n[测试 4] 普通聊天接口...")
        try:
            session_id = "test_session_002"
            
            response = await self.client.post(
                f"{self.base_url}{API_PREFIX}/chat/message",
                json={
                    "session_id": session_id,
                    "content": "请介绍黄鹤楼木雕作品",
                    "message_type": "text"
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert "message_id" in data
            assert "content" in data
            assert "entities" in data
            assert "keywords" in data
            
            print(f"  消息 ID: {data['message_id']}")
            print(f"  实体数量：{len(data.get('entities', []))}")
            print(f"  关键词数量：{len(data.get('keywords', []))}")
            
            if data.get('entities'):
                print(f"  示例实体：{data['entities'][0]['name']} ({data['entities'][0]['type']})")
            
            print("✓ 普通聊天接口通过")
            return True
            
        except Exception as e:
            print(f"✗ 普通聊天接口失败：{e}")
            return False

    async def test_graph_snapshot(self):
        """测试图谱快照接口"""
        print("\n[测试 5] 图谱快照接口...")
        try:
            snapshot_data = {
                "session_id": "test_session_001",
                "message_id": "test_msg_001",
                "graph_data": {
                    "nodes": [
                        {"id": "n1", "name": "武汉木雕", "category": "technique", "value": 0.9, "symbolSize": 45},
                        {"id": "n2", "name": "黄鹤楼", "category": "work", "value": 0.8, "symbolSize": 40},
                    ],
                    "edges": [
                        {"source": "n1", "target": "n2", "value": 0.7}
                    ]
                },
                "keywords": ["木雕", "黄鹤楼", "武汉"],
                "entities": [
                    {"id": "e1", "name": "武汉木雕", "type": "technique", "description": "传统工艺"}
                ],
                "relations": [],
                "title": "测试快照"
            }
            
            response = await self.client.post(
                f"{self.base_url}{API_PREFIX}/graph/snapshot",
                json=snapshot_data
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert "id" in data
            assert data["title"] == "测试快照"
            snapshot_id = data["id"]
            
            print(f"  快照 ID: {snapshot_id}")
            
            response = await self.client.get(f"{self.base_url}{API_PREFIX}/graph/snapshot/{snapshot_id}")
            assert response.status_code == 200
            retrieved = response.json()
            assert retrieved["id"] == snapshot_id
            
            print("✓ 图谱快照接口通过")
            return True
            
        except Exception as e:
            print(f"✗ 图谱快照接口失败：{e}")
            return False

    async def test_session_graph_data(self):
        """测试会话图谱数据接口"""
        print("\n[测试 6] 会话图谱数据接口...")
        try:
            response = await self.client.get(
                f"{self.base_url}{API_PREFIX}/graph/session/test_session_001/data"
            )
            
            assert response.status_code == 200
            data = response.json()
            
            assert "nodes" in data
            assert "edges" in data
            assert "entities" in data
            assert "keywords" in data
            
            print(f"  节点数量：{len(data.get('nodes', []))}")
            print(f"  边数量：{len(data.get('edges', []))}")
            print(f"  实体数量：{len(data.get('entities', []))}")
            print(f"  关键词数量：{len(data.get('keywords', []))}")
            
            print("✓ 会话图谱数据接口通过")
            return True
            
        except Exception as e:
            print(f"✗ 会话图谱数据接口失败：{e}")
            return False

    async def test_recommendations(self):
        """测试推荐问题接口"""
        print("\n[测试 7] 推荐问题接口...")
        try:
            response = await self.client.get(f"{self.base_url}{API_PREFIX}/chat/recommendations")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "questions" in data
            questions = data["questions"]
            assert len(questions) > 0
            
            print(f"  推荐问题数量：{len(questions)}")
            for q in questions[:3]:
                print(f"    - {q['question']}")
            
            print("✓ 推荐问题接口通过")
            return True
            
        except Exception as e:
            print(f"✗ 推荐问题接口失败：{e}")
            return False

    async def cleanup(self):
        """清理测试环境"""
        print("\n" + "=" * 60)
        print("测试完成")
        print("=" * 60)
        await self.client.aclose()

    async def run_all_tests(self):
        """运行所有测试"""
        await self.setup()
        
        results = []
        
        results.append(await self.test_health_check())
        results.append(await self.test_root_endpoint())
        results.append(await self.test_chat_stream())
        results.append(await self.test_chat_message())
        results.append(await self.test_graph_snapshot())
        results.append(await self.test_session_graph_data())
        results.append(await self.test_recommendations())
        
        await self.cleanup()
        
        print(f"\n测试结果：{sum(results)}/{len(results)} 通过")
        
        if all(results):
            print("🎉 所有测试通过！")
            return True
        else:
            print("⚠️  部分测试失败")
            return False


async def main():
    """主函数"""
    test_client = TestClient()
    
    try:
        success = await test_client.run_all_tests()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n测试被中断")
        exit(1)
    except Exception as e:
        print(f"\n测试异常：{e}")
        import traceback
        traceback.print_exc()
        exit(1)


if __name__ == "__main__":
    asyncio.run(main())
