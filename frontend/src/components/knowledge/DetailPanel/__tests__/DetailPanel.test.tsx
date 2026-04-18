import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import DetailPanel from '../index';
import useKnowledgeGraphStore from '../../../../stores/knowledgeGraphStore';
import { knowledgeApi } from '../../../../api/knowledge';

vi.mock('../../../../stores/knowledgeGraphStore');
vi.mock('../../../../api/knowledge');
vi.mock('../../../common/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

interface Entity {
  id: string;
  name: string;
  type: string;
  description?: string;
  region?: string;
  period?: string;
  importance: number;
  coordinates?: { lat: number; lng: number };
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  images?: string[];
  tags?: string[];
}

const mockEntity: Entity = {
  id: 'test-entity-1',
  name: '景泰蓝',
  type: 'technique',
  description:
    '景泰蓝是中国著名的传统手工艺品，又称"铜胎掐丝珐琅"。它起源于元代，盛行于明朝景泰年间，因其在明朝景泰年间盛行且工艺成熟，故得名"景泰蓝"。',
  region: '北京',
  period: '明清',
  importance: 0.95,
  coordinates: { lat: 39.9042, lng: 116.4074 },
  metadata: {
    history: '起源于元代，盛行于明清',
    features: '色彩鲜艳，图案精美',
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
};

const mockRelationships = [
  {
    id: 'rel-1',
    source_id: 'test-entity-1',
    target_id: 'entity-2',
    relation_type: '传承',
    weight: 1.0,
  },
];

const mockRelatedEntities = [
  {
    ...mockEntity,
    id: 'entity-2',
    name: '张三',
    type: 'inheritor',
  },
];

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('DetailPanel', () => {
  const mockSetSelectedNode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useKnowledgeGraphStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedNode: null,
      detailPanelCollapsed: false,
      setSelectedNode: mockSetSelectedNode,
    });
    (knowledgeApi.getEntityDetail as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      entity: mockEntity,
      relationships: mockRelationships,
      related_entities: mockRelatedEntities,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not render when selectedNode is null', () => {
    renderWithRouter(<DetailPanel />);
    expect(screen.queryByText('景泰蓝')).not.toBeInTheDocument();
  });

  it('should render entity details when selectedNode is set', async () => {
    (useKnowledgeGraphStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedNode: 'test-entity-1',
      detailPanelCollapsed: false,
      setSelectedNode: mockSetSelectedNode,
    });

    renderWithRouter(<DetailPanel />);

    await waitFor(() => {
      expect(screen.getByText('景泰蓝')).toBeInTheDocument();
    });
  });

  it('should render entity type badge', async () => {
    (useKnowledgeGraphStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedNode: 'test-entity-1',
      detailPanelCollapsed: false,
      setSelectedNode: mockSetSelectedNode,
    });

    renderWithRouter(<DetailPanel />);

    await waitFor(() => {
      expect(screen.getByText('技艺')).toBeInTheDocument();
    });
  });

  it('should call setSelectedNode when close button is clicked', async () => {
    (useKnowledgeGraphStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedNode: 'test-entity-1',
      detailPanelCollapsed: false,
      setSelectedNode: mockSetSelectedNode,
    });

    renderWithRouter(<DetailPanel />);

    await waitFor(() => {
      expect(screen.getByText('景泰蓝')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(closeButton);

    expect(mockSetSelectedNode).toHaveBeenCalledWith(null);
  });

  it('should render region information', async () => {
    (useKnowledgeGraphStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedNode: 'test-entity-1',
      detailPanelCollapsed: false,
      setSelectedNode: mockSetSelectedNode,
    });

    renderWithRouter(<DetailPanel />);

    await waitFor(() => {
      expect(screen.getByText('北京')).toBeInTheDocument();
    });
  });

  it('should render period information', async () => {
    (useKnowledgeGraphStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedNode: 'test-entity-1',
      detailPanelCollapsed: false,
      setSelectedNode: mockSetSelectedNode,
    });

    renderWithRouter(<DetailPanel />);

    await waitFor(() => {
      expect(screen.getByText('明清')).toBeInTheDocument();
    });
  });

  it('should render importance percentage', async () => {
    (useKnowledgeGraphStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedNode: 'test-entity-1',
      detailPanelCollapsed: false,
      setSelectedNode: mockSetSelectedNode,
    });

    renderWithRouter(<DetailPanel />);

    await waitFor(() => {
      expect(screen.getByText('95%')).toBeInTheDocument();
    });
  });
});
