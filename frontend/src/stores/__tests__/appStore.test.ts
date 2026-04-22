import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';

describe('AppStore', () => {
  beforeEach(() => {
    // 重置 store 到初始状态
    useAppStore.setState({
      sidebarCollapsed: false,
      rightPanelCollapsed: false,
      theme: 'light',
      fontSize: 'medium',
      currentUserId: null,
      isOnline: true,
      networkMode: 'online',
      sharedGraphData: null,
    });
  });

  describe('UI State', () => {
    it('should toggle sidebar collapsed', () => {
      useAppStore.getState().setSidebarCollapsed(true);
      expect(useAppStore.getState().sidebarCollapsed).toBe(true);

      useAppStore.getState().setSidebarCollapsed(false);
      expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    });

    it('should toggle right panel collapsed', () => {
      useAppStore.getState().setRightPanelCollapsed(true);
      expect(useAppStore.getState().rightPanelCollapsed).toBe(true);

      useAppStore.getState().setRightPanelCollapsed(false);
      expect(useAppStore.getState().rightPanelCollapsed).toBe(false);
    });

    it('should set theme', () => {
      useAppStore.getState().setTheme('dark');
      expect(useAppStore.getState().theme).toBe('dark');

      useAppStore.getState().setTheme('light');
      expect(useAppStore.getState().theme).toBe('light');
    });

    it('should set font size', () => {
      useAppStore.getState().setFontSize('small');
      expect(useAppStore.getState().fontSize).toBe('small');

      useAppStore.getState().setFontSize('large');
      expect(useAppStore.getState().fontSize).toBe('large');
    });
  });

  describe('Data State', () => {
    it('should set current user ID', () => {
      useAppStore.getState().setCurrentUserId('user-123');
      expect(useAppStore.getState().currentUserId).toBe('user-123');

      useAppStore.getState().setCurrentUserId(null);
      expect(useAppStore.getState().currentUserId).toBeNull();
    });

    it('should set online status', () => {
      useAppStore.getState().setOnline(false);
      expect(useAppStore.getState().isOnline).toBe(false);

      useAppStore.getState().setOnline(true);
      expect(useAppStore.getState().isOnline).toBe(true);
    });

    it('should set network mode', () => {
      useAppStore.getState().setNetworkMode('offline');
      expect(useAppStore.getState().networkMode).toBe('offline');

      useAppStore.getState().setNetworkMode('online');
      expect(useAppStore.getState().networkMode).toBe('online');
    });
  });

  describe('Shared Graph Data', () => {
    it('should update shared graph data', () => {
      const testData = {
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' as const }],
        relations: [{ source: '1', target: '2', type: 'inherits' as const }],
        keywords: ['keyword1'],
      };

      useAppStore.getState().updateSharedGraphData(testData);

      const state = useAppStore.getState().sharedGraphData;
      expect(state).toBeTruthy();
      expect(state?.entities.length).toBe(1);
      expect(state?.relations.length).toBe(1);
      expect(state?.keywords).toContain('keyword1');
    });

    it('should merge graph data', () => {
      const initialData = {
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' as const }],
        relations: [],
        keywords: ['keyword1'],
      };

      useAppStore.getState().updateSharedGraphData(initialData);

      const additionalData = {
        entities: [{ id: '2', name: 'Entity2', type: 'technique' as const }],
        relations: [{ source: '1', target: '2', type: 'inherits' as const }],
        keywords: ['keyword2'],
      };

      useAppStore.getState().updateSharedGraphData(additionalData);

      const state = useAppStore.getState().sharedGraphData;
      expect(state?.entities.length).toBe(2);
      expect(state?.relations.length).toBe(1);
      expect(state?.keywords).toContain('keyword1');
      expect(state?.keywords).toContain('keyword2');
    });

    it('should deduplicate entities', () => {
      const data1 = {
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' as const }],
      };

      const data2 = {
        entities: [{ id: '1', name: 'Entity1 Updated', type: 'inheritor' as const }],
      };

      useAppStore.getState().updateSharedGraphData(data1);
      useAppStore.getState().updateSharedGraphData(data2);

      const state = useAppStore.getState().sharedGraphData;
      expect(state?.entities.length).toBe(1);
      expect(state?.entities[0].name).toBe('Entity1 Updated');
    });

    it('should clear graph data', () => {
      useAppStore.getState().updateSharedGraphData({
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' as const }],
        relations: [],
        keywords: [],
      });

      useAppStore.getState().clearSharedGraphData();

      expect(useAppStore.getState().sharedGraphData).toBeNull();
    });

    it('should update lastUpdated timestamp', () => {
      const beforeUpdate = Date.now();

      useAppStore.getState().updateSharedGraphData({
        entities: [],
        relations: [],
        keywords: [],
      });

      const afterUpdate = Date.now();
      const state = useAppStore.getState().sharedGraphData;

      expect(state?.lastUpdated).toBeGreaterThanOrEqual(beforeUpdate);
      expect(state?.lastUpdated).toBeLessThanOrEqual(afterUpdate);
    });
  });

  describe('Persistence', () => {
    it('should persist UI state to localStorage', () => {
      useAppStore.getState().setTheme('dark');
      useAppStore.getState().setFontSize('large');
      useAppStore.getState().setSidebarCollapsed(true);

      const stored = localStorage.getItem('heritage-app-storage');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.theme).toBe('dark');
      expect(parsed.state.fontSize).toBe('large');
      expect(parsed.state.sidebarCollapsed).toBe(true);
    });
  });
});
