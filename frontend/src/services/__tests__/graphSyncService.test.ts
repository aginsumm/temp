import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GraphSyncService, SyncEventType, SyncSource } from '../graphSyncService';
import { graphDataHub } from '../graphDataHub';

describe('GraphSyncService', () => {
  let service: GraphSyncService;

  beforeEach(() => {
    service = GraphSyncService.getInstance();
    graphDataHub.clear();
    // 重置监听器
    (service as unknown as { listeners: Map<string, Set<() => void>> }).listeners.clear();
  });

  afterEach(() => {
    // 不清除，避免影响其他测试
    // service.destroy();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = GraphSyncService.getInstance();
      const instance2 = GraphSyncService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Listener Management', () => {
    it('should add and remove listeners', () => {
      const mockListener = vi.fn();
      const cleanup = service.addListener('test-module', mockListener);

      expect(() => {
        service.updateFromChat([], [], []);
      }).not.toThrow();

      cleanup();

      service.updateFromChat([], [], []);
      expect(mockListener).toHaveBeenCalledTimes(1);
    });

    it('should notify all listeners for a module', () => {
      const mockListener1 = vi.fn();
      const mockListener2 = vi.fn();

      service.addListener('test-module', mockListener1);
      service.addListener('test-module', mockListener2);

      service.updateFromChat([], [], []);

      expect(mockListener1).toHaveBeenCalled();
      expect(mockListener2).toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = () => {
        throw new Error('Test error');
      };

      service.addListener('test-module', errorListener);

      expect(() => {
        service.updateFromChat([], [], []);
      }).not.toThrow();
    });
  });

  describe('updateFromChat', () => {
    it('should update graph data from Chat module', () => {
      const entities = [{ id: '1', name: 'Entity1', type: 'inheritor' as const }];
      const relations: { id: string; source: string; target: string; type: string }[] = [];
      const keywords = ['keyword1'];

      service.updateFromChat(entities, relations, keywords, 'session-1', 'message-1');

      const state = graphDataHub.getCurrentState();
      expect(state).toBeTruthy();
      expect(state?.entities).toEqual(entities);
      expect(state?.source).toBe('chat');
      expect(state?.sessionId).toBe('session-1');
    });

    it('should dispatch custom event', () => {
      const mockDispatchEvent = vi.spyOn(window, 'dispatchEvent');

      service.updateFromChat([], [], []);

      expect(mockDispatchEvent).toHaveBeenCalled();
      const event = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('chatGraphUpdate');

      mockDispatchEvent.mockRestore();
    });
  });

  describe('updateFromKnowledge', () => {
    it('should update graph data from Knowledge module', () => {
      const entities = [{ id: '1', name: 'Entity1', type: 'inheritor' as const }];
      const relations: { id: string; source: string; target: string; type: string }[] = [];
      const keywords = ['keyword1'];

      service.updateFromKnowledge(entities, relations, keywords);

      const state = graphDataHub.getCurrentState();
      expect(state).toBeTruthy();
      expect(state?.entities).toEqual(entities);
      expect(state?.source).toBe('knowledge');
    });

    it('should dispatch custom event', () => {
      const mockDispatchEvent = vi.spyOn(window, 'dispatchEvent');

      service.updateFromKnowledge([], [], []);

      expect(mockDispatchEvent).toHaveBeenCalled();
      const event = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('knowledgeGraphUpdate');

      mockDispatchEvent.mockRestore();
    });
  });

  describe('updateFromSnapshot', () => {
    it('should update graph data from snapshot', () => {
      const entities = [{ id: '1', name: 'Entity1', type: 'inheritor' as const }];
      const relations: { id: string; source: string; target: string; type: string }[] = [];
      const keywords = ['keyword1'];

      service.updateFromSnapshot(entities, relations, keywords, 'session-1', 'message-1');

      const state = graphDataHub.getCurrentState();
      expect(state).toBeTruthy();
      expect(state?.source).toBe('snapshot');
      expect(state?.sessionId).toBe('session-1');
    });

    it('should dispatch loadSnapshot event', () => {
      const mockDispatchEvent = vi.spyOn(window, 'dispatchEvent');

      service.updateFromSnapshot([], [], [], 'session-1', 'message-1');

      expect(mockDispatchEvent).toHaveBeenCalled();
      const event = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('loadSnapshot');
      expect(event.detail.snapshot.session_id).toBe('session-1');

      mockDispatchEvent.mockRestore();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to graph updates', () => {
      const mockCallback = vi.fn();

      const unsubscribe = service.subscribe('test-module', mockCallback);

      service.updateFromChat([{ id: '1', name: 'Entity1', type: 'inheritor' as const }], [], []);

      expect(mockCallback).toHaveBeenCalled();
      expect(mockCallback.mock.calls[0][0].entities.length).toBe(1);

      unsubscribe();
    });

    it('should filter out updates from the same module', () => {
      const mockCallback = vi.fn();

      // 使用 'chat' 作为 moduleId，这样会被过滤
      const unsubscribe = service.subscribe('chat', mockCallback);

      service.updateFromChat([], [], []);

      expect(mockCallback).not.toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('getCurrentState', () => {
    it('should return current graph state', () => {
      const entities = [{ id: '1', name: 'Entity1', type: 'inheritor' as const }];

      service.updateFromChat(entities, [], []);

      const state = service.getCurrentState();
      expect(state).toBeTruthy();
      expect(state?.entities).toEqual(entities);
    });

    it('should return null when no state', () => {
      const state = service.getCurrentState();
      expect(state).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear graph data', () => {
      service.updateFromChat([{ id: '1', name: 'Entity1', type: 'inheritor' as const }], [], []);

      service.clear();

      const state = service.getCurrentState();
      expect(state).toBeNull();
    });

    it('should notify listeners of clear event', () => {
      const mockListener = vi.fn();
      service.addListener('test-module', mockListener);

      service.clear();

      expect(mockListener).toHaveBeenCalled();
      expect(mockListener.mock.calls[0][0].type).toBe(SyncEventType.CLEAR);
    });
  });

  describe('Event Types', () => {
    it('should use correct event types', () => {
      expect(SyncEventType.UPDATE).toBe('UPDATE');
      expect(SyncEventType.SNAPSHOT).toBe('SNAPSHOT');
      expect(SyncEventType.CLEAR).toBe('CLEAR');
      expect(SyncEventType.MERGE).toBe('MERGE');
    });
  });

  describe('Sync Sources', () => {
    it('should use correct sync sources', () => {
      expect(SyncSource.CHAT).toBe('chat');
      expect(SyncSource.KNOWLEDGE).toBe('knowledge');
      expect(SyncSource.SNAPSHOT).toBe('snapshot');
    });
  });
});
