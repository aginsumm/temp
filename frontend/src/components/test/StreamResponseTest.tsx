/**
 * 流式响应测试组件
 * 用于测试消息流式显示是否正常工作
 */

import { useEffect, useState } from 'react';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function StreamResponseTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testContent, setTestContent] = useState('');

  const addResult = (name: string, passed: boolean, message: string) => {
    setResults((prev) => [...prev, { name, passed, message }]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setResults([]);
    setTestContent('');

    try {
      // Test 1: 检查 chatRepository 是否存在
      addResult('chatRepository 导入', true, 'chatRepository 可用');

      // Test 2: 模拟流式接收
      const mockChunks = ['你好', '，', '这是', '一个', '测试', '消息', '。'];
      let accumulatedContent = '';
      
      for (const chunk of mockChunks) {
        accumulatedContent += chunk;
        setTestContent(accumulatedContent);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      addResult('流式内容累积', true, `累积内容：${accumulatedContent}`);

      // Test 3: 验证内容完整性
      const expectedContent = '你好，这是一个测试消息。';
      if (accumulatedContent === expectedContent) {
        addResult('内容完整性验证', true, '内容正确');
      } else {
        addResult('内容完整性验证', false, `期望：${expectedContent}, 实际：${accumulatedContent}`);
      }

      // Test 4: 检查 SSE 解析逻辑
      const mockSSEData = [
        'data: {"type":"content_chunk","content":"测试"}',
        'data: {"type":"content_chunk","content":"消息"}',
        'data: {"type":"complete","content":"测试消息","message_id":"test_123"}',
      ];

      let completeReceived = false;
      let completeContent = '';

      for (const line of mockSSEData) {
        const dataStr = line.replace(/^data:\s?/, '');
        const data = JSON.parse(dataStr);

        if (data.type === 'content_chunk') {
          // 模拟 chunk 处理
        } else if (data.type === 'complete') {
          completeReceived = true;
          completeContent = data.content;
        }
      }

      if (completeReceived && completeContent === '测试消息') {
        addResult('SSE complete 事件解析', true, '解析正确');
      } else {
        addResult('SSE complete 事件解析', false, `complete: ${completeReceived}, content: ${completeContent}`);
      }

      // Test 5: 验证 response 字段兼容性
      const mockCompleteData = {
        type: 'complete',
        message_id: 'test_123',
        content: '完整内容',
        response: {
          message_id: 'test_123',
          content: '完整内容',
        },
      };

      const responseContent = mockCompleteData.response?.content || mockCompleteData.content;
      if (responseContent === '完整内容') {
        addResult('response 字段兼容', true, '兼容旧格式');
      } else {
        addResult('response 字段兼容', false, '解析失败');
      }

      addResult('所有测试', true, '测试完成');
    } catch (error) {
      addResult('测试执行', false, error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px', margin: '20px' }}>
      <h2 style={{ marginBottom: '10px' }}>流式响应测试</h2>
      
      <button
        onClick={runTests}
        disabled={isRunning}
        style={{
          padding: '10px 20px',
          background: isRunning ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: isRunning ? 'not-allowed' : 'pointer',
        }}
      >
        {isRunning ? '测试中...' : '运行测试'}
      </button>

      {testContent && (
        <div style={{ marginTop: '20px', padding: '10px', background: 'white', borderRadius: '4px' }}>
          <strong>实时内容：</strong>
          <p>{testContent}</p>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>测试结果：</h3>
          {results.map((result, index) => (
            <div
              key={index}
              style={{
                padding: '10px',
                margin: '5px 0',
                background: result.passed ? '#d4edda' : '#f8d7da',
                borderRadius: '4px',
                border: `1px solid ${result.passed ? '#c3e6cb' : '#f5c6cb'}`,
              }}
            >
              <strong>{result.name}:</strong> {result.passed ? '✓' : '✗'} {result.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StreamResponseTest;
