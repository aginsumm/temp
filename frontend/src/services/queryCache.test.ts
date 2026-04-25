import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryCache, QueryCache } from '../services/queryCache';

describe('QueryCache', () => {
  beforeEach(async () => {
    await queryCache.clear();
  });

  describe('set and get', () => {
    it('should store and retrieve cache entries', async () => {
      await queryCache.set('test-key', { data: 'test-value' });
      const result = await queryCache.get('test-key');

      expect(result).toEqual({ data: 'test-value' });
    });

    it('should return null for non-existing keys', async () => {
      const result = await queryCache.get('non-existing');
      expect(result).toBeNull();
    });

    it('should respect custom TTL', async () => {
      vi.useFakeTimers();

      await queryCache.set('short-ttl', 'value', 1000);
      const beforeExpiry = await queryCache.get('short-ttl');
      expect(beforeExpiry).toEqual('value');

      vi.advanceTimersByTime(1500);
      const afterExpiry = await queryCache.get('short-ttl');
      expect(afterExpiry).toBeNull();

      vi.useRealTimers();
    });

    it('should use default TTL when not specified', async () => {
      vi.useFakeTimers();

      await queryCache.set('default-ttl', 'value');
      const beforeExpiry = await queryCache.get('default-ttl');
      expect(beforeExpiry).toEqual('value');

      vi.advanceTimersByTime(30 * 60 * 1000 + 1000);
      const afterExpiry = await queryCache.get('default-ttl');
      expect(afterExpiry).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('has', () => {
    it('should return true for existing keys', async () => {
      await queryCache.set('test-key', 'value');
      const exists = await queryCache.has('test-key');
      expect(exists).toBe(true);
    });

    it('should return false for non-existing keys', async () => {
      const exists = await queryCache.has('non-existing');
      expect(exists).toBe(false);
    });

    it('should return false for expired entries', async () => {
      vi.useFakeTimers();

      await queryCache.set('expiring', 'value', 1000);
      vi.advanceTimersByTime(1500);

      const exists = await queryCache.has('expiring');
      expect(exists).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('delete', () => {
    it('should remove cache entry', async () => {
      await queryCache.set('to-delete', 'value');
      await queryCache.delete('to-delete');

      const result = await queryCache.get('to-delete');
      expect(result).toBeNull();
    });

    it('should not throw for non-existing keys', async () => {
      await expect(queryCache.delete('non-existing')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all cache entries', async () => {
      await queryCache.set('key1', 'value1');
      await queryCache.set('key2', 'value2');
      await queryCache.set('key3', 'value3');

      await queryCache.clear();

      expect(await queryCache.get('key1')).toBeNull();
      expect(await queryCache.get('key2')).toBeNull();
      expect(await queryCache.get('key3')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      await queryCache.set('key1', 'value1');
      await queryCache.set('key2', 'value2');

      const stats = queryCache.getStats();

      expect(stats.memorySize).toBe(2);
      expect(typeof stats.memoryUsage).toBe('number');
      expect(stats.config).toBeDefined();
    });
  });

  describe('LRU eviction', () => {
    it('should evict entries when max size reached', async () => {
      const smallCache = new QueryCache({
        maxMemorySize: 3,
        persistToIndexedDB: false,
      });

      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3');

      const statsBefore = smallCache.getStats();
      expect(statsBefore.memorySize).toBeLessThanOrEqual(3);

      await smallCache.set('key4', 'value4');

      const statsAfter = smallCache.getStats();
      expect(statsAfter.memorySize).toBeLessThanOrEqual(3);
    });
  });
});
