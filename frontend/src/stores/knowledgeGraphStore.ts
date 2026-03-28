import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewMode = 'graph' | 'list' | 'map' | 'timeline';
type LayoutType = 'force' | 'circular' | 'hierarchical';
type SortBy = 'relevance' | 'name' | 'date';

interface GraphState {
  viewMode: ViewMode;
  selectedNode: string | null;
  highlightedNodes: string[];
  layoutType: LayoutType;
  zoomLevel: number;
  filterPanelCollapsed: boolean;
  detailPanelCollapsed: boolean;
}

interface FilterState {
  category: string;
  keyword: string;
  region: string[];
  period: string[];
  sortBy: SortBy;
}

interface KnowledgeGraphStore extends GraphState, FilterState {
  setViewMode: (mode: ViewMode) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setHighlightedNodes: (nodeIds: string[]) => void;
  setLayoutType: (type: LayoutType) => void;
  setZoomLevel: (level: number) => void;
  toggleFilterPanel: () => void;
  toggleDetailPanel: () => void;

  setCategory: (category: string) => void;
  setKeyword: (keyword: string) => void;
  setRegion: (region: string[]) => void;
  setPeriod: (period: string[]) => void;
  setSortBy: (sortBy: SortBy) => void;

  resetFilter: () => void;
}

const useKnowledgeGraphStore = create<KnowledgeGraphStore>()(
  persist(
    (set) => ({
      viewMode: 'graph',
      selectedNode: null,
      highlightedNodes: [],
      layoutType: 'force',
      zoomLevel: 1,
      filterPanelCollapsed: false,
      detailPanelCollapsed: false,
      category: 'all',
      keyword: '',
      region: [],
      period: [],
      sortBy: 'relevance',

      setViewMode: (mode) => set({ viewMode: mode }),

      setSelectedNode: (nodeId) => set({ selectedNode: nodeId }),

      setHighlightedNodes: (nodeIds) => set({ highlightedNodes: nodeIds }),

      setLayoutType: (type) => set({ layoutType: type }),

      setZoomLevel: (level) => set({ zoomLevel: level }),

      toggleFilterPanel: () =>
        set((state) => ({
          filterPanelCollapsed: !state.filterPanelCollapsed,
        })),

      toggleDetailPanel: () =>
        set((state) => ({
          detailPanelCollapsed: !state.detailPanelCollapsed,
        })),

      setCategory: (category) => set({ category }),

      setKeyword: (keyword) => set({ keyword }),

      setRegion: (region) => set({ region }),

      setPeriod: (period) => set({ period }),

      setSortBy: (sortBy) => set({ sortBy }),

      resetFilter: () =>
        set({
          category: 'all',
          keyword: '',
          region: [],
          period: [],
          sortBy: 'relevance',
        }),
    }),
    {
      name: 'knowledge-graph-storage',
      partialize: (state) => ({
        viewMode: state.viewMode,
        layoutType: state.layoutType,
        filterPanelCollapsed: state.filterPanelCollapsed,
        detailPanelCollapsed: state.detailPanelCollapsed,
      }),
    }
  )
);

export default useKnowledgeGraphStore;
