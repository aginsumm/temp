import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import KnowledgeGraph from '../index';
import useKnowledgeGraphStore from '../../../../stores/knowledgeGraphStore';
import { knowledgeApi } from '../../../../api/knowledge';

vi.mock('../../../../stores/knowledgeGraphStore', () => ({
  default: vi.fn(() => ({
    selectedNode: null,
    highlightedNodes: [],
    layoutType: 'force',
    setSelectedNode: vi.fn(),
    setHighlightedNodes: vi.fn(),
    setLayoutType: vi.fn(),
    setGraphData: vi.fn(),
    graphData: null,
  })),
}));

vi.mock('../../../../api/knowledge', () => ({
  knowledgeApi: {
    getGraphData: vi.fn(),
  },
}));

vi.mock('../../../common/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockGraphData = {
  nodes: [
    { id: '1', name: '景泰蓝', category: 'technique', value: 95 },
    { id: '2', name: '张三', category: 'inheritor', value: 90 },
    { id: '3', name: '掐丝珐琅瓶', category: 'work', value: 80 },
  ],
  edges: [
    { source: '1', target: '2', relationType: '传承' },
    { source: '1', target: '3', relationType: '产出' },
  ],
  categories: [
    { name: 'technique' },
    { name: 'inheritor' },
    { name: 'work' },
  ],
};

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('KnowledgeGraph', () => {
  const mockSetSelectedNode = vi.fn();
  const mockSetHighlightedNodes = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useKnowledgeGraphStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedNode: null,
      highlightedNodes: [],
      layoutType: 'force',
      setSelectedNode: mockSetSelectedNode,
      setHighlightedNodes: mockSetHighlightedNodes,
    });
    (knowledgeApi.getGraphData as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockGraphData);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render graph container', async () => {
    renderWithRouter(<KnowledgeGraph />);

    await waitFor(() => {
      expect(screen.getByText('知识图谱')).toBeInTheDocument();
    });
  });

  it('should fetch graph data on mount', async () => {
    renderWithRouter(<KnowledgeGraph />);

    await waitFor(() => {
      expect(knowledgeApi.getGraphData).toHaveBeenCalled();
    });
  });

  it('should show loading state initially', () => {
    (knowledgeApi.getGraphData as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithRouter(<KnowledgeGraph />);

    expect(screen.getByText('知识图谱')).toBeInTheDocument();
  });

  it('should render toolbar buttons', async () => {
    renderWithRouter(<KnowledgeGraph />);

    await waitFor(() => {
      expect(screen.getByText('知识图谱')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should render search input', async () => {
    renderWithRouter(<KnowledgeGraph />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('搜索节点...')).toBeInTheDocument();
    });
  });

  it('should render filter button', async () => {
    renderWithRouter(<KnowledgeGraph />);

    await waitFor(() => {
      expect(screen.getByText('筛选')).toBeInTheDocument();
    });
  });

  it('should render layout selector', async () => {
    renderWithRouter(<KnowledgeGraph />);

    await waitFor(() => {
      expect(screen.getByText('力导向')).toBeInTheDocument();
    });
  });

  it('should handle API error gracefully', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (knowledgeApi.getGraphData as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('API Error')
    );

    renderWithRouter(<KnowledgeGraph />);

    await waitFor(() => {
      expect(screen.getByText('知识图谱')).toBeInTheDocument();
    });

    consoleWarnSpy.mockRestore();
  });
});
