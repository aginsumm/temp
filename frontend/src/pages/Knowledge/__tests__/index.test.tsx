import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

vi.mock('../../../api/knowledge', () => ({
  knowledgeApi: {
    getGraphData: vi.fn().mockResolvedValue({
      nodes: [
        { id: '1', name: '景泰蓝', category: 'technique', value: 95 },
        { id: '2', name: '张三', category: 'inheritor', value: 90 },
      ],
      edges: [{ source: '1', target: '2', relation: '传承' }],
      categories: [
        { name: 'technique', color: '#3B82F6' },
        { name: 'inheritor', color: '#10B981' },
      ],
    }),
    search: vi.fn().mockResolvedValue({
      results: [{ id: '1', name: '景泰蓝', type: 'technique', importance: 0.95 }],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    }),
    getCategories: vi.fn().mockResolvedValue([
      { value: 'technique', label: '技艺', color: '#3B82F6' },
      { value: 'inheritor', label: '传承人', color: '#10B981' },
    ]),
    getRegions: vi.fn().mockResolvedValue(['北京', '苏州']),
    getPeriods: vi.fn().mockResolvedValue(['明清', '现代']),
    getEntity: vi.fn().mockResolvedValue({
      id: '1',
      name: '景泰蓝',
      type: 'technique',
      description: '传统工艺',
      importance: 0.95,
    }),
    getStats: vi.fn().mockResolvedValue({
      total_entities: 100,
      total_relationships: 200,
      entities_by_type: { technique: 50, inheritor: 30 },
    }),
    getSearchHistory: vi.fn().mockResolvedValue([]),
    saveSearchHistory: vi.fn().mockResolvedValue(undefined),
    deleteSearchHistory: vi.fn().mockResolvedValue(undefined),
    clearSearchHistory: vi.fn().mockResolvedValue(undefined),
    getEntityRelations: vi.fn().mockResolvedValue([]),
    addFavorite: vi.fn().mockResolvedValue({}),
    removeFavorite: vi.fn().mockResolvedValue(undefined),
    checkFavorite: vi.fn().mockResolvedValue({ is_favorite: false }),
    submitFeedback: vi.fn().mockResolvedValue({}),
    exportData: vi.fn().mockResolvedValue(new Blob(['test'])),
    importData: vi.fn().mockResolvedValue({ success: true, imported: 1, errors: [] }),
  },
}));

vi.mock('../../../api/snapshot', () => ({
  snapshotService: {
    listSnapshots: vi.fn().mockResolvedValue({ snapshots: [], total: 0 }),
    getSnapshot: vi.fn().mockResolvedValue(null),
    saveSnapshot: vi.fn().mockResolvedValue({ id: '1' }),
    deleteSnapshot: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../stores/knowledgeGraphStore', () => ({
  default: vi.fn(() => ({
    viewMode: 'graph',
    setViewMode: vi.fn(),
    selectedNode: null,
    setSelectedNode: vi.fn(),
    category: [],
    region: [],
    period: [],
    setCategory: vi.fn(),
    setRegion: vi.fn(),
    setPeriod: vi.fn(),
    keyword: '',
    setKeyword: vi.fn(),
    graphData: { nodes: [], edges: [], categories: [] },
    setGraphData: vi.fn(),
    searchResults: [],
    setSearchResults: vi.fn(),
    loading: false,
    setLoading: vi.fn(),
  })),
}));

vi.mock('../../../components/common/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('../../../utils/snapshotHandler', () => ({
  loadSnapshot: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../../services/graphSyncService', () => ({
  graphSyncService: {
    updateFromKnowledge: vi.fn(),
  },
}));

import KnowledgePage from '../index';

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('KnowledgePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render page title', async () => {
    renderWithRouter(<KnowledgePage />);

    await waitFor(() => {
      expect(screen.getByText('非遗知识图谱')).toBeInTheDocument();
    });
  });

  it('should render view mode toggle buttons', async () => {
    renderWithRouter(<KnowledgePage />);

    await waitFor(() => {
      expect(screen.getByText('图谱视图')).toBeInTheDocument();
      expect(screen.getByText('列表视图')).toBeInTheDocument();
    });
  });
});
