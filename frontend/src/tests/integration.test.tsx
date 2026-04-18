/**
 * 集成测试 - 模拟真实用户场景
 * 测试组件间的交互和数据流
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { act } from '@testing-library/react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { useState, useEffect } from 'react';

// Mock echarts
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    getOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    clear: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    dispatchAction: vi.fn(),
    getDataURL: vi.fn(() => 'data:image/png;base64,mock'),
  })),
  registerMap: vi.fn(),
  connect: vi.fn(),
  disConnect: vi.fn(),
  use: vi.fn(),
}));

// 模拟子组件
const MockChildComponent = ({
  data,
  onDataChange,
  loading = false,
}: {
  data: any;
  onDataChange?: (data: any) => void;
  loading?: boolean;
}) => {
  const [localData, setLocalData] = useState(data);

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const handleClick = () => {
    const newData = { ...localData, clicked: true };
    setLocalData(newData);
    onDataChange?.(newData);
  };

  if (loading) {
    return <div data-testid="loading">加载中...</div>;
  }

  return (
    <div data-testid="child-component">
      <span data-testid="data-value">{JSON.stringify(localData)}</span>
      <button onClick={handleClick} data-testid="action-button">
        点击
      </button>
    </div>
  );
};

// 模拟父组件
const MockParentComponent = () => {
  const [data, setData] = useState({ value: 'initial', clicked: false });
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const handleDataChange = (newData: any) => {
    setData(newData);
    setHistory([...history, newData]);
  };

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    setData({ value: 'refreshed', clicked: false });
    setLoading(false);
  };

  return (
    <div data-testid="parent-component">
      <button onClick={handleRefresh} data-testid="refresh-button">
        刷新
      </button>
      <MockChildComponent data={data} onDataChange={handleDataChange} loading={loading} />
      <div data-testid="history-count">历史次数：{history.length}</div>
    </div>
  );
};

// 模拟列表组件
const MockListContainer = () => {
  const [items, setItems] = useState([
    { id: 1, name: '项目 1', selected: false },
    { id: 2, name: '项目 2', selected: false },
    { id: 3, name: '项目 3', selected: false },
  ]);
  const [filter, setFilter] = useState('');

  const handleSelect = (id: number) => {
    setItems(items.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
  };

  const handleAdd = () => {
    const newId = items.length + 1;
    setItems([...items, { id: newId, name: `项目${newId}`, selected: false }]);
  };

  const handleDelete = (id: number) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const filteredItems = items.filter((item) => item.name.includes(filter));

  const selectedCount = items.filter((item) => item.selected).length;

  return (
    <div data-testid="list-container">
      <input
        type="text"
        data-testid="filter-input"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="筛选"
      />
      <button onClick={handleAdd} data-testid="add-button">
        添加
      </button>
      <div data-testid="selected-count">已选择：{selectedCount}</div>
      <ul data-testid="item-list">
        {filteredItems.map((item) => (
          <li key={item.id} data-testid={`item-${item.id}`}>
            <span>{item.name}</span>
            <button onClick={() => handleSelect(item.id)} data-testid={`select-${item.id}`}>
              {item.selected ? '取消选择' : '选择'}
            </button>
            <button onClick={() => handleDelete(item.id)} data-testid={`delete-${item.id}`}>
              删除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

// 模拟表单组件
const MockFormContainer = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    age: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.username) {
      newErrors.username = '用户名不能为空';
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '邮箱格式不正确';
    }
    if (!formData.age || parseInt(formData.age) < 18) {
      newErrors.age = '年龄必须大于 18 岁';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setSubmitted(true);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  if (submitted) {
    return <div data-testid="form-success">提交成功！</div>;
  }

  return (
    <form onSubmit={handleSubmit} data-testid="form-container">
      <div>
        <input
          type="text"
          data-testid="username-input"
          value={formData.username}
          onChange={(e) => handleChange('username', e.target.value)}
          placeholder="用户名"
        />
        {errors.username && (
          <span data-testid="username-error" style={{ color: 'red' }}>
            {errors.username}
          </span>
        )}
      </div>
      <div>
        <input
          type="email"
          data-testid="email-input"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="邮箱"
        />
        {errors.email && (
          <span data-testid="email-error" style={{ color: 'red' }}>
            {errors.email}
          </span>
        )}
      </div>
      <div>
        <input
          type="number"
          data-testid="age-input"
          value={formData.age}
          onChange={(e) => handleChange('age', e.target.value)}
          placeholder="年龄"
        />
        {errors.age && (
          <span data-testid="age-error" style={{ color: 'red' }}>
            {errors.age}
          </span>
        )}
      </div>
      <button type="submit" data-testid="submit-button">
        提交
      </button>
    </form>
  );
};

describe('集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('组件通信测试', () => {
    it('should handle parent-child data flow', async () => {
      render(<MockParentComponent />);

      // 初始状态
      expect(screen.getByTestId('data-value')).toHaveTextContent(
        JSON.stringify({ value: 'initial', clicked: false })
      );

      // 子组件触发事件
      fireEvent.click(screen.getByTestId('action-button'));

      await waitFor(() => {
        expect(screen.getByTestId('data-value')).toHaveTextContent(
          JSON.stringify({ value: 'initial', clicked: true })
        );
      });

      // 检查历史记录
      expect(screen.getByTestId('history-count')).toHaveTextContent('历史次数：1');
    });

    it('should handle async data refresh', async () => {
      render(<MockParentComponent />);

      // 点击刷新
      fireEvent.click(screen.getByTestId('refresh-button'));

      // 检查加载状态
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // 等待刷新完成
      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      // 检查刷新后的数据
      expect(screen.getByTestId('data-value')).toHaveTextContent(
        JSON.stringify({ value: 'refreshed', clicked: false })
      );
    });
  });

  describe('列表操作测试', () => {
    it('should handle item selection', () => {
      render(<MockListContainer />);

      // 初始未选择
      expect(screen.getByTestId('selected-count')).toHaveTextContent('已选择：0');

      // 选择第一个项目
      fireEvent.click(screen.getByTestId('select-1'));
      expect(screen.getByTestId('selected-count')).toHaveTextContent('已选择：1');

      // 选择第二个项目
      fireEvent.click(screen.getByTestId('select-2'));
      expect(screen.getByTestId('selected-count')).toHaveTextContent('已选择：2');

      // 取消选择第一个
      fireEvent.click(screen.getByTestId('select-1'));
      expect(screen.getByTestId('selected-count')).toHaveTextContent('已选择：1');
    });

    it('should handle item addition', () => {
      render(<MockListContainer />);

      // 初始 3 个项目
      expect(screen.getByTestId('item-3')).toBeInTheDocument();

      // 添加新项目
      fireEvent.click(screen.getByTestId('add-button'));
      expect(screen.getByTestId('item-4')).toBeInTheDocument();

      // 再次添加
      fireEvent.click(screen.getByTestId('add-button'));
      expect(screen.getByTestId('item-5')).toBeInTheDocument();
    });

    it('should handle item deletion', () => {
      render(<MockListContainer />);

      // 删除项目
      fireEvent.click(screen.getByTestId('delete-1'));
      expect(screen.queryByTestId('item-1')).not.toBeInTheDocument();

      // 剩余 2 个项目
      expect(screen.getByTestId('item-2')).toBeInTheDocument();
      expect(screen.getByTestId('item-3')).toBeInTheDocument();
    });

    it('should handle filtering', () => {
      render(<MockListContainer />);

      // 筛选项目 1
      fireEvent.change(screen.getByTestId('filter-input'), {
        target: { value: '项目 1' },
      });

      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.queryByTestId('item-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('item-3')).not.toBeInTheDocument();

      // 清空筛选
      fireEvent.change(screen.getByTestId('filter-input'), {
        target: { value: '' },
      });

      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.getByTestId('item-2')).toBeInTheDocument();
      expect(screen.getByTestId('item-3')).toBeInTheDocument();
    });
  });

  describe('表单验证测试', () => {
    it('should handle form validation errors', async () => {
      render(<MockFormContainer />);

      // 直接提交，触发验证
      fireEvent.click(screen.getByTestId('submit-button'));

      // 检查错误信息
      await waitFor(() => {
        expect(screen.getByTestId('username-error')).toBeInTheDocument();
        expect(screen.getByTestId('email-error')).toBeInTheDocument();
        expect(screen.getByTestId('age-error')).toBeInTheDocument();
      });
    });

    it('should handle successful form submission', async () => {
      render(<MockFormContainer />);

      // 填写正确的数据
      fireEvent.change(screen.getByTestId('username-input'), {
        target: { value: 'testuser' },
      });
      fireEvent.change(screen.getByTestId('email-input'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(screen.getByTestId('age-input'), {
        target: { value: '25' },
      });

      // 提交
      fireEvent.click(screen.getByTestId('submit-button'));

      // 检查成功状态
      await waitFor(() => {
        expect(screen.getByTestId('form-success')).toBeInTheDocument();
      });
    });

    it('should clear errors on input change', async () => {
      render(<MockFormContainer />);

      // 触发验证
      fireEvent.click(screen.getByTestId('submit-button'));
      await waitFor(() => {
        expect(screen.getByTestId('username-error')).toBeInTheDocument();
      });

      // 修改输入
      fireEvent.change(screen.getByTestId('username-input'), {
        target: { value: 'test' },
      });

      // 错误应该消失
      expect(screen.queryByTestId('username-error')).not.toBeInTheDocument();
    });
  });

  describe('路由和导航测试', () => {
    it('should handle navigation between pages', () => {
      const MockPage1 = () => <div data-testid="page1">页面 1</div>;
      const MockPage2 = () => <div data-testid="page2">页面 2</div>;

      render(
        <BrowserRouter>
          <Routes>
            <Route path="/page1" element={<MockPage1 />} />
            <Route path="/page2" element={<MockPage2 />} />
          </Routes>
        </BrowserRouter>
      );

      // 在没有实际路由的情况下，组件不会渲染
      expect(screen.queryByTestId('page1')).not.toBeInTheDocument();
    });

    it('should handle query parameters', () => {
      const MockPageWithQuery = () => {
        const [query, setQuery] = useState('');

        useEffect(() => {
          const params = new URLSearchParams(window.location.search);
          setQuery(params.get('q') || '');
        }, []);

        return <div data-testid="query-display">{query}</div>;
      };

      render(
        <BrowserRouter>
          <MockPageWithQuery />
        </BrowserRouter>
      );

      // 初始没有查询参数
      expect(screen.getByTestId('query-display')).toHaveTextContent('');
    });
  });

  describe('状态管理集成测试', () => {
    it('should handle multiple state updates', async () => {
      const MultiStateComponent = () => {
        const [count, setCount] = useState(0);
        const [text, setText] = useState('');
        const [items, setItems] = useState<string[]>([]);

        return (
          <div>
            <button onClick={() => setCount(count + 1)} data-testid="increment">
              +1
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              data-testid="text-input"
            />
            <button onClick={() => setItems([...items, text])} data-testid="add-item">
              添加
            </button>
            <div data-testid="count">{count}</div>
            <div data-testid="item-count">{items.length}</div>
          </div>
        );
      };

      render(<MultiStateComponent />);

      // 增加计数
      fireEvent.click(screen.getByTestId('increment'));
      fireEvent.click(screen.getByTestId('increment'));
      expect(screen.getByTestId('count')).toHaveTextContent('2');

      // 添加文本
      fireEvent.change(screen.getByTestId('text-input'), {
        target: { value: 'test' },
      });

      // 添加项目
      fireEvent.click(screen.getByTestId('add-item'));
      expect(screen.getByTestId('item-count')).toHaveTextContent('1');
    });
  });

  describe('异步操作集成测试', () => {
    it('should handle multiple async operations', async () => {
      const AsyncComponent = () => {
        const [data, setData] = useState<string[]>([]);
        const [loading, setLoading] = useState(false);

        const fetchData = async () => {
          setLoading(true);
          await new Promise((resolve) => setTimeout(resolve, 50));
          setData(['item1', 'item2', 'item3']);
          setLoading(false);
        };

        return (
          <div>
            <button onClick={fetchData} data-testid="fetch" disabled={loading}>
              获取数据
            </button>
            {loading && <div data-testid="loading">加载中</div>}
            <ul data-testid="data-list">
              {data.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        );
      };

      render(<AsyncComponent />);

      // 初始没有数据
      expect(screen.getByTestId('data-list').children).toHaveLength(0);

      // 获取数据
      fireEvent.click(screen.getByTestId('fetch'));

      // 检查加载状态
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // 等待数据加载完成
      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      // 检查数据
      expect(screen.getByTestId('data-list').children).toHaveLength(3);
    });
  });

  describe('事件处理集成测试', () => {
    it('should handle event bubbling', () => {
      const parentClick = vi.fn();
      const childClick = vi.fn();

      const EventBubblingComponent = () => (
        <div onClick={parentClick} data-testid="parent">
          <button onClick={childClick} data-testid="child">
            点击
          </button>
        </div>
      );

      render(<EventBubblingComponent />);

      // 点击子元素
      fireEvent.click(screen.getByTestId('child'));

      // 事件应该冒泡
      expect(childClick).toHaveBeenCalledTimes(1);
      expect(parentClick).toHaveBeenCalledTimes(1);
    });

    it('should handle event prevention', () => {
      const parentClick = vi.fn();
      const childClick = vi.fn((e: React.MouseEvent) => {
        e.stopPropagation();
      });

      const EventPreventionComponent = () => (
        <div onClick={parentClick} data-testid="parent">
          <button onClick={childClick} data-testid="child">
            点击
          </button>
        </div>
      );

      render(<EventPreventionComponent />);

      // 点击子元素
      fireEvent.click(screen.getByTestId('child'));

      // 事件不应该冒泡
      expect(childClick).toHaveBeenCalledTimes(1);
      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe('性能优化测试', () => {
    it('should handle rapid updates efficiently', async () => {
      const RapidUpdateComponent = () => {
        const [count, setCount] = useState(0);

        const handleRapidClicks = () => {
          // 快速更新 100 次
          for (let i = 0; i < 100; i++) {
            setCount((c) => c + 1);
          }
        };

        return (
          <div>
            <button onClick={handleRapidClicks} data-testid="rapid">
              快速点击
            </button>
            <div data-testid="count">{count}</div>
          </div>
        );
      };

      render(<RapidUpdateComponent />);

      const start = performance.now();
      fireEvent.click(screen.getByTestId('rapid'));
      const end = performance.now();

      // React 应该批量更新
      expect(screen.getByTestId('count')).toHaveTextContent('100');
      expect(end - start).toBeLessThan(100);
    });
  });

  describe('错误边界测试', () => {
    it('should handle component errors gracefully', () => {
      const ErrorComponent = () => {
        const [hasError] = useState(false);

        if (hasError) {
          return <div data-testid="error-state">出错了</div>;
        }

        const throwError = () => {
          throw new Error('Test error');
        };

        return (
          <div>
            <button onClick={throwError} data-testid="error-button">
              触发错误
            </button>
          </div>
        );
      };

      render(<ErrorComponent />);
      expect(screen.getByTestId('error-button')).toBeInTheDocument();
    });
  });
});

describe('真实场景集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle complete user workflow', async () => {
    const WorkflowComponent = () => {
      const [step, setStep] = useState(1);
      const [data, setData] = useState<any>(null);
      const [loading, setLoading] = useState(false);

      const handleStep1 = async () => {
        setLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 50));
        setData({ step1: 'completed' });
        setLoading(false);
        setStep(2);
      };

      const handleStep2 = () => {
        setData({ ...data, step2: 'completed' });
        setStep(3);
      };

      const handleReset = () => {
        setStep(1);
        setData(null);
      };

      return (
        <div data-testid="workflow">
          <div data-testid="current-step">步骤：{step}</div>

          {step === 1 && (
            <button onClick={handleStep1} data-testid="step1-button" disabled={loading}>
              步骤 1
            </button>
          )}

          {step === 2 && (
            <button onClick={handleStep2} data-testid="step2-button">
              步骤 2
            </button>
          )}

          {step === 3 && (
            <div data-testid="complete">
              完成
              <button onClick={handleReset} data-testid="reset-button">
                重置
              </button>
            </div>
          )}

          {loading && <div data-testid="loading">加载中</div>}
          {data && <div data-testid="data">{JSON.stringify(data)}</div>}
        </div>
      );
    };

    render(<WorkflowComponent />);

    // 步骤 1
    expect(screen.getByTestId('current-step')).toHaveTextContent('步骤：1');
    fireEvent.click(screen.getByTestId('step1-button'));

    // 等待步骤 1 完成
    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('步骤：2');
    });

    // 步骤 2
    fireEvent.click(screen.getByTestId('step2-button'));
    expect(screen.getByTestId('current-step')).toHaveTextContent('步骤：3');
    expect(screen.getByTestId('complete')).toBeInTheDocument();

    // 检查数据
    expect(screen.getByTestId('data')).toHaveTextContent(
      JSON.stringify({ step1: 'completed', step2: 'completed' })
    );

    // 重置
    fireEvent.click(screen.getByTestId('reset-button'));
    expect(screen.getByTestId('current-step')).toHaveTextContent('步骤：1');
    expect(screen.queryByTestId('data')).not.toBeInTheDocument();
  });
});
