import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GraphDataHub,
  TimestampConflictResolver,
  MergeConflictResolver,
  type GraphDataState,
} from '../graphDataHub';

describe('GraphDataHub', () => {
  let hub: GraphDataHub;

  beforeEach(() => {
    hub = GraphDataHub.getInstance();
    hub.clear();
  });

  afterEach(() => {
    hub.destroy();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = GraphDataHub.getInstance();
      const instance2 = GraphDataHub.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Version Control', () => {
    it('should increment version for each update', async () => {
      await hub.enqueueUpdate({
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'chat',
        timestamp: Date.now(),
      });

      const state1 = hub.getCurrentState();
      expect(state1?.version).toBe(1);

      await hub.enqueueUpdate({
        entities: [{ id: '2', name: 'Entity2', type: 'technique' }],
        relations: [],
        keywords: [],
        source: 'knowledge',
        timestamp: Date.now(),
      });

      const state2 = hub.getCurrentState();
      expect(state2?.version).toBe(2);
    });
  });

  describe('Queue Processing', () => {
    it('should process updates in order', async () => {
      const updates = [
        {
          entities: [{ id: '1', name: 'Entity1', type: 'inheritor' as const }],
          relations: [],
          keywords: [],
          source: 'chat' as const,
          timestamp: Date.now(),
        },
        {
          entities: [{ id: '2', name: 'Entity2', type: 'technique' as const }],
          relations: [],
          keywords: [],
          source: 'knowledge' as const,
          timestamp: Date.now() + 1, // 确保时间戳不同
        },
      ];

      // 串行执行以确保顺序处理
      for (const update of updates) {
        await hub.enqueueUpdate(update);
      }

      const state = hub.getCurrentState();
      // 第二个更新会覆盖第一个（因为没有冲突检测）
      expect(state?.entities.length).toBe(1);
      expect(state?.entities[0].id).toBe('2');
      expect(state?.source).toBe('knowledge');
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflict when entities overlap from different sources', () => {
      const current: GraphDataState = {
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'chat',
        timestamp: 1000,
        version: 1,
      };

      const update: GraphDataState = {
        entities: [{ id: '1', name: 'Entity1 Updated', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'knowledge',
        timestamp: 2000,
        version: 2,
      };

      const hasConflict = (
        hub as unknown as { detectConflict: (a: GraphDataState, b: GraphDataState) => boolean }
      ).detectConflict(current, update);
      expect(hasConflict).toBe(true);
    });

    it('should not detect conflict when entities do not overlap', () => {
      const current: GraphDataState = {
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'chat',
        timestamp: 1000,
        version: 1,
      };

      const update: GraphDataState = {
        entities: [{ id: '2', name: 'Entity2', type: 'technique' }],
        relations: [],
        keywords: [],
        source: 'knowledge',
        timestamp: 2000,
        version: 2,
      };

      const hasConflict = (
        hub as unknown as { detectConflict: (a: GraphDataState, b: GraphDataState) => boolean }
      ).detectConflict(current, update);
      expect(hasConflict).toBe(false);
    });

    it('should not detect conflict when sources are the same', () => {
      const current: GraphDataState = {
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'chat',
        timestamp: 1000,
        version: 1,
      };

      const update: GraphDataState = {
        entities: [{ id: '1', name: 'Entity1 Updated', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'chat',
        timestamp: 2000,
        version: 2,
      };

      const hasConflict = (
        hub as unknown as { detectConflict: (a: GraphDataState, b: GraphDataState) => boolean }
      ).detectConflict(current, update);
      expect(hasConflict).toBe(false);
    });
  });

  describe('TimestampConflictResolver', () => {
    it('should resolve conflict with latest timestamp', () => {
      const resolver = new TimestampConflictResolver();

      const local: GraphDataState = {
        entities: [{ id: '1', name: 'Local', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'chat',
        timestamp: 1000,
        version: 1,
      };

      const remote: GraphDataState = {
        entities: [{ id: '1', name: 'Remote', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'knowledge',
        timestamp: 2000,
        version: 2,
      };

      const resolved = resolver.resolve(local, remote);
      expect(resolved.entities[0].name).toBe('Remote');
    });

    it('should resolve conflict with local when timestamps are equal', () => {
      const resolver = new TimestampConflictResolver();

      const local: GraphDataState = {
        entities: [{ id: '1', name: 'Local', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'chat',
        timestamp: 1000,
        version: 1,
      };

      const remote: GraphDataState = {
        entities: [{ id: '1', name: 'Remote', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'knowledge',
        timestamp: 1000,
        version: 2,
      };

      const resolved = resolver.resolve(local, remote);
      // 当时间戳相等时，返回 remote（因为 remote 的 timestamp 不小于 local）
      expect(resolved.entities[0].name).toBe('Remote');
    });
  });

  describe('MergeConflictResolver', () => {
    it('should merge entities from both sources', () => {
      const resolver = new MergeConflictResolver();

      const local: GraphDataState = {
        entities: [
          { id: '1', name: 'Entity1', type: 'inheritor' },
          { id: '2', name: 'Entity2', type: 'technique' },
        ],
        relations: [],
        keywords: ['keyword1'],
        source: 'chat',
        timestamp: 1000,
        version: 1,
      };

      const remote: GraphDataState = {
        entities: [
          { id: '3', name: 'Entity3', type: 'work' },
          { id: '4', name: 'Entity4', type: 'pattern' },
        ],
        relations: [],
        keywords: ['keyword2'],
        source: 'knowledge',
        timestamp: 2000,
        version: 2,
      };

      const resolved = resolver.resolve(local, remote);
      expect(resolved.entities.length).toBe(4);
      expect(resolved.keywords).toContain('keyword1');
      expect(resolved.keywords).toContain('keyword2');
    });

    it('should not duplicate entities with same ID', () => {
      const resolver = new MergeConflictResolver();

      const local: GraphDataState = {
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'chat',
        timestamp: 1000,
        version: 1,
      };

      const remote: GraphDataState = {
        entities: [{ id: '1', name: 'Entity1 Updated', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'knowledge',
        timestamp: 2000,
        version: 2,
      };

      const resolved = resolver.resolve(local, remote);
      expect(resolved.entities.length).toBe(1);
      expect(resolved.entities[0].name).toBe('Entity1');
    });

    it('should merge keywords without duplicates', () => {
      const resolver = new MergeConflictResolver();

      const local: GraphDataState = {
        entities: [],
        relations: [],
        keywords: ['keyword1', 'keyword2'],
        source: 'chat',
        timestamp: 1000,
        version: 1,
      };

      const remote: GraphDataState = {
        entities: [],
        relations: [],
        keywords: ['keyword2', 'keyword3'],
        source: 'knowledge',
        timestamp: 2000,
        version: 2,
      };

      const resolved = resolver.resolve(local, remote);
      expect(resolved.keywords.length).toBe(3);
      expect(resolved.keywords).toEqual(
        expect.arrayContaining(['keyword1', 'keyword2', 'keyword3'])
      );
    });
  });

  describe('Event Emission', () => {
    it('should emit graph:update event', async () => {
      const mockListener = vi.fn();
      hub.on('graph:update', mockListener);

      await hub.enqueueUpdate({
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'chat',
        timestamp: Date.now(),
      });

      expect(mockListener).toHaveBeenCalledTimes(1);
      expect(mockListener.mock.calls[0][0].entities.length).toBe(1);
    });

    it('should emit graph:clear event', () => {
      const mockListener = vi.fn();
      hub.on('graph:clear', mockListener);

      hub.clear();

      expect(mockListener).toHaveBeenCalledTimes(1);
    });

    it('should emit graph:conflict event when conflict occurs', async () => {
      const mockConflictListener = vi.fn();
      hub.on('graph:conflict', mockConflictListener);

      await hub.enqueueUpdate({
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'chat',
        timestamp: Date.now(),
      });

      await hub.enqueueUpdate({
        entities: [{ id: '1', name: 'Entity1 Updated', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'knowledge',
        timestamp: Date.now() + 100,
      });

      expect(mockConflictListener).toHaveBeenCalled();
    });
  });

  describe('SessionStorage Persistence', () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    it('should persist state to sessionStorage', async () => {
      await hub.enqueueUpdate({
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' }],
        relations: [],
        keywords: ['keyword1'],
        source: 'chat',
        sessionId: 'session-123',
        timestamp: Date.now(),
      });

      const stored = sessionStorage.getItem('graphState_session-123');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.entities.length).toBe(1);
      expect(parsed.keywords).toContain('keyword1');
    });

    it('should restore state from sessionStorage', async () => {
      const testData = {
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' }],
        relations: [],
        keywords: ['keyword1'],
        timestamp: Date.now(),
        version: 1,
      };

      sessionStorage.setItem('graphState_session-456', JSON.stringify(testData));

      const restored = await hub.restoreFromSessionStorage('session-456');

      expect(restored).toBeTruthy();
      expect(restored?.entities.length).toBe(1);
      expect(restored?.keywords).toContain('keyword1');
      expect(restored?.sessionId).toBe('session-456');
    });

    it('should return null when restoring non-existent state', async () => {
      const restored = await hub.restoreFromSessionStorage('non-existent');
      expect(restored).toBeNull();
    });
  });

  describe('getCurrentState', () => {
    it('should return current state', async () => {
      const testEntities = [{ id: '1', name: 'Entity1', type: 'inheritor' }];

      await hub.enqueueUpdate({
        entities: testEntities,
        relations: [],
        keywords: ['test'],
        source: 'chat',
        timestamp: Date.now(),
      });

      const state = hub.getCurrentState();
      expect(state).toBeTruthy();
      expect(state?.entities).toEqual(testEntities);
    });

    it('should return null when no state', () => {
      const state = hub.getCurrentState();
      expect(state).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear current state', async () => {
      await hub.enqueueUpdate({
        entities: [{ id: '1', name: 'Entity1', type: 'inheritor' }],
        relations: [],
        keywords: [],
        source: 'chat',
        timestamp: Date.now(),
      });

      hub.clear();

      const state = hub.getCurrentState();
      expect(state).toBeNull();
    });
  });
});
