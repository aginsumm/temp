/**
 * API 缓存服务测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APICacheService } from '../apiCacheService';

describe('APICacheService', () => {
  let cache: APICacheService;

  beforeEach(() => {
    APICacheService.resetInstance();
    cache = APICacheService.getInstance({
      defaultTTL: 1000,
      maxSize: 5,
      cleanupInterval: 500,
    });
  });

  afterEach(() => {
    cache.destroy();
    APICacheService.resetInstance();
  });

  describe('Basic Cache Operations', () => {
    it('should set and get cache entries', () => {
      cache.set('test-key', { data: 'test-value' });
      const result = cache.get('test-key');
      expect(result).toEqual({ data: 'test-value' });
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should handle expired cache entries', async () => {
      cache.set('expiring-key', 'value', 100);
      expect(cache.get('expiring-key')).toBe('value');

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.get('expiring-key')).toBeNull();
    });

    it('should increment hit count on get', () => {
      cache.set('hit-test', 'value');

      cache.get('hit-test');
      cache.get('hit-test');
      cache.get('hit-test');

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
    });
  });

  describe('Request Deduplication', () => {
    it('should cache request results', async () => {
      const requestFn = vi.fn().mockResolvedValue({ data: 'test' });

      const result1 = await cache.request('req-1', requestFn);
      const result2 = await cache.request('req-1', requestFn);

      expect(result1).toEqual({ data: 'test' });
      expect(result2).toEqual({ data: 'test' });
      expect(requestFn).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent requests', async () => {
      const requestFn = vi.fn().mockResolvedValue({ data: 'concurrent' });

      const [result1, result2, result3] = await Promise.all([
        cache.request('concurrent-req', requestFn),
        cache.request('concurrent-req', requestFn),
        cache.request('concurrent-req', requestFn),
      ]);

      expect(result1).toEqual({ data: 'concurrent' });
      expect(result2).toEqual({ data: 'concurrent' });
      expect(result3).toEqual({ data: 'concurrent' });
      expect(requestFn).toHaveBeenCalledTimes(1);
    });

    it('should force refresh when requested', async () => {
      const requestFn = vi.fn().mockResolvedValue({ data: 'fresh' });

      await cache.request('refresh-req', requestFn);
      await cache.request('refresh-req', requestFn, { forceRefresh: true });

      expect(requestFn).toHaveBeenCalledTimes(2);
    });

    it('should disable deduplication when requested', async () => {
      const requestFn = vi.fn().mockResolvedValue({ data: 'no-dedup' });

      await cache.request('no-dedup', requestFn, { forceRefresh: true, deduplicate: false });
      await cache.request('no-dedup', requestFn, { forceRefresh: true, deduplicate: false });

      expect(requestFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate by exact key', () => {
      cache.set('key-1', 'value1');
      cache.set('key-2', 'value2');

      cache.invalidate('key-1');

      expect(cache.get('key-1')).toBeNull();
      expect(cache.get('key-2')).toBe('value2');
    });

    it('should invalidate by regex pattern', () => {
      cache.set('graph:entity:1', 'entity1');
      cache.set('graph:entity:2', 'entity2');
      cache.set('chat:message:1', 'message1');

      cache.invalidate(/^graph:/);

      expect(cache.get('graph:entity:1')).toBeNull();
      expect(cache.get('graph:entity:2')).toBeNull();
      expect(cache.get('chat:message:1')).toBe('message1');
    });

    it('should invalidate by prefix', () => {
      cache.set('prefix:key1', 'value1');
      cache.set('prefix:key2', 'value2');
      cache.set('other:key', 'value');

      cache.invalidateByPrefix('prefix:');

      expect(cache.get('prefix:key1')).toBeNull();
      expect(cache.get('prefix:key2')).toBeNull();
      expect(cache.get('other:key')).toBe('value');
    });

    it('should clear all cache', () => {
      cache.set('key-1', 'value1');
      cache.set('key-2', 'value2');

      cache.clear();

      expect(cache.get('key-1')).toBeNull();
      expect(cache.get('key-2')).toBeNull();
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least used entry when cache is full', () => {
      cache.set('key-1', 'value1');
      cache.set('key-2', 'value2');
      cache.set('key-3', 'value3');
      cache.set('key-4', 'value4');
      cache.set('key-5', 'value5');

      cache.get('key-2');
      cache.get('key-3');
      cache.get('key-5');

      cache.set('key-6', 'value6');

      expect(cache.get('key-1')).toBeNull();
      expect(cache.get('key-4')).toBe('value4');
      expect(cache.get('key-6')).toBe('value6');
    });
  });

  describe('Cache Statistics', () => {
    it('should return correct stats', () => {
      cache.set('stat-1', 'value1');
      cache.set('stat-2', 'value2');

      cache.get('stat-1');
      cache.get('stat-1');
      cache.get('stat-2');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('rate-1', 'value');

      cache.get('rate-1');
      cache.get('rate-1');
      cache.get('rate-1');

      const stats = cache.getStats();

      expect(stats.hits).toBe(3);
      expect(stats.hitRate).toBe(0.75);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = APICacheService.getInstance();
      const instance2 = APICacheService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
