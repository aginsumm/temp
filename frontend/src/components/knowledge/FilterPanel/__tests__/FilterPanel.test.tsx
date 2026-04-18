import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import FilterPanel from '../index';

const mockRegions = ['北京', '苏州', '杭州', '景德镇'];
const mockPeriods = ['古代', '明清', '近代', '现代'];

vi.mock('../../../api/knowledge', () => ({
  knowledgeApi: {
    getRegions: vi.fn().mockResolvedValue(mockRegions),
    getPeriods: vi.fn().mockResolvedValue(mockPeriods),
  },
}));

vi.mock('../../../stores/knowledgeGraphStore', () => ({
  default: vi.fn(() => ({
    region: [],
    period: [],
    setRegion: vi.fn(),
    setPeriod: vi.fn(),
    filterPanelCollapsed: false,
    toggleFilterPanel: vi.fn(),
  })),
  __esModule: true,
}));

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('FilterPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render filter panel title', async () => {
    renderWithRouter(<FilterPanel />);
    await waitFor(() => {
      expect(screen.getByText('筛选条件')).toBeInTheDocument();
    });
  });

  it('should render region filter section', async () => {
    renderWithRouter(<FilterPanel />);
    await waitFor(() => {
      expect(screen.getByText('地域')).toBeInTheDocument();
    });
  });

  it('should render period filter section', async () => {
    renderWithRouter(<FilterPanel />);
    await waitFor(() => {
      expect(screen.getByText('时期')).toBeInTheDocument();
    });
  });

  it('should render clear filter button', async () => {
    renderWithRouter(<FilterPanel />);
    await waitFor(() => {
      expect(screen.getByText('清除筛选')).toBeInTheDocument();
    });
  });

  it('should toggle region section', async () => {
    renderWithRouter(<FilterPanel />);
    await waitFor(() => {
      expect(screen.getByText('地域')).toBeInTheDocument();
    });

    const regionButton = screen.getByText('地域').closest('button');
    fireEvent.click(regionButton!);
  });

  it('should toggle period section', async () => {
    renderWithRouter(<FilterPanel />);
    await waitFor(() => {
      expect(screen.getByText('时期')).toBeInTheDocument();
    });

    const periodButton = screen.getByText('时期').closest('button');
    fireEvent.click(periodButton!);
  });
});

describe('FilterPanel Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render filter panel', async () => {
    renderWithRouter(<FilterPanel />);
    await waitFor(() => {
      expect(screen.getByText('筛选条件')).toBeInTheDocument();
    });

    expect(screen.getByText('地域')).toBeInTheDocument();
    expect(screen.getByText('时期')).toBeInTheDocument();
  });

  it('should display filter title', async () => {
    renderWithRouter(<FilterPanel />);
    await waitFor(() => {
      expect(screen.getByText('筛选条件')).toBeInTheDocument();
    });

    expect(screen.getByText('按地域和时期筛选')).toBeInTheDocument();
  });
});
