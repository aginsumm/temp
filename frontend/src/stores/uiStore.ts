import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type FontSize = 'small' | 'medium' | 'large';

interface UIState {
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
  sidebarWidth: number;
  rightPanelWidth: number;
  fontSize: FontSize;
  showSourcePanel: boolean;
  showSettings: boolean;
  apiConnected: boolean;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleRightPanel: () => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setFontSize: (size: FontSize) => void;
  toggleSourcePanel: () => void;
  toggleSettings: () => void;
  setApiConnected: (connected: boolean) => void;
}

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 600;
const MIN_RIGHT_PANEL_WIDTH = 220;
const MAX_RIGHT_PANEL_WIDTH = 800;
const DEFAULT_SIDEBAR_WIDTH = 260;
const DEFAULT_RIGHT_PANEL_WIDTH = 320;

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      rightPanelCollapsed: false,
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      rightPanelWidth: DEFAULT_RIGHT_PANEL_WIDTH,
      fontSize: 'medium',
      showSourcePanel: false,
      showSettings: false,
      apiConnected: true,

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setSidebarCollapsed: (collapsed) => {
        set({ sidebarCollapsed: collapsed });
      },

      toggleRightPanel: () => {
        set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed }));
      },

      setRightPanelCollapsed: (collapsed) => {
        set({ rightPanelCollapsed: collapsed });
      },

      setSidebarWidth: (width) => {
        const clampedWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
        set({ sidebarWidth: clampedWidth });
      },

      setRightPanelWidth: (width) => {
        const clampedWidth = Math.min(
          MAX_RIGHT_PANEL_WIDTH,
          Math.max(MIN_RIGHT_PANEL_WIDTH, width)
        );
        set({ rightPanelWidth: clampedWidth });
      },

      setFontSize: (fontSize) => {
        set({ fontSize });
        const sizeMap = {
          small: '14px',
          medium: '16px',
          large: '18px',
        };
        document.documentElement.style.fontSize = sizeMap[fontSize];
      },

      toggleSourcePanel: () => {
        set((state) => ({ showSourcePanel: !state.showSourcePanel }));
      },

      toggleSettings: () => {
        set((state) => ({ showSettings: !state.showSettings }));
      },

      setApiConnected: (connected) => {
        set({ apiConnected: connected });
      },
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        rightPanelWidth: state.rightPanelWidth,
        fontSize: state.fontSize,
      }),
    }
  )
);

export { MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH, MIN_RIGHT_PANEL_WIDTH, MAX_RIGHT_PANEL_WIDTH };
