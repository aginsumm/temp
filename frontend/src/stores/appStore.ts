/**
 * 全局应用状态管理 Store
 * 统一管理 Chat 和 Knowledge 模块的共享状态
 * 提供全局 UI 状态、网络状态和图谱数据共享
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Entity, Relation } from '../types/graph';

interface SharedGraphData {
  entities: Entity[];
  relations: Relation[];
  keywords: string[];
  lastUpdated: number;
}

interface AppState {
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';

  currentUserId: string | null;
  isOnline: boolean;
  networkMode: 'online' | 'offline' | 'checking';

  sharedGraphData: SharedGraphData | null;

  setSidebarCollapsed: (collapsed: boolean) => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;

  setCurrentUserId: (userId: string | null) => void;
  setOnline: (online: boolean) => void;
  setNetworkMode: (mode: 'online' | 'offline' | 'checking') => void;

  updateSharedGraphData: (data: {
    entities?: Entity[];
    relations?: Relation[];
    keywords?: string[];
  }) => void;
  clearSharedGraphData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      rightPanelCollapsed: false,
      theme: 'light',
      fontSize: 'medium',

      currentUserId: null,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      networkMode: 'checking',

      sharedGraphData: null,

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),

      setTheme: (theme) => set({ theme }),

      setFontSize: (size) => set({ fontSize: size }),

      setCurrentUserId: (userId) => set({ currentUserId: userId }),

      setOnline: (online) => set({ isOnline: online }),

      setNetworkMode: (mode) => set({ networkMode: mode }),

      updateSharedGraphData: (data) =>
        set((state) => {
          const existingEntities = state.sharedGraphData?.entities || [];
          const existingRelations = state.sharedGraphData?.relations || [];
          const existingKeywords = state.sharedGraphData?.keywords || [];

          const newEntities = data.entities || [];
          const newRelations = data.relations || [];
          const newKeywords = data.keywords || [];

          const mergedEntities = [
            ...existingEntities.filter((ex) => !newEntities.find((e) => e.id === ex.id)),
            ...newEntities,
          ];

          const mergedRelations = [
            ...existingRelations.filter(
              (ex) =>
                !newRelations.find(
                  (r) => ex.source === r.source && ex.target === r.target && ex.type === r.type
                )
            ),
            ...newRelations,
          ];

          const mergedKeywords = [...new Set([...existingKeywords, ...newKeywords])];

          return {
            sharedGraphData: {
              entities: mergedEntities,
              relations: mergedRelations,
              keywords: mergedKeywords,
              lastUpdated: Date.now(),
            },
          };
        }),

      clearSharedGraphData: () => set({ sharedGraphData: null }),
    }),
    {
      name: 'heritage-app-storage',
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        sidebarCollapsed: state.sidebarCollapsed,
        rightPanelCollapsed: state.rightPanelCollapsed,
      }),
    }
  )
);

export default useAppStore;
