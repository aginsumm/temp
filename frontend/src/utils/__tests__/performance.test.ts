import { describe, it, expect, vi, beforeEach } from 'vitest';
import { debounce, throttle, processInChunks } from '../../utils/performance';

describe('Performance Utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('debounce', () => {
    it('should delay function execution', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      vi.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to function', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('test', 123);
      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith('test', 123);
    });
  });

  describe('throttle', () => {
    it('should limit function calls', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to function', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('test', 456);
      expect(mockFn).toHaveBeenCalledWith('test', 456);
    });
  });

  describe('processInChunks', () => {
    it('should process array in chunks', async () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const processor = (chunk: number[]) => chunk.map((n) => n * 2);

      const result = await processInChunks(array, processor, 3);

      expect(result).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    });

    it('should handle empty array', async () => {
      const array: number[] = [];
      const processor = (chunk: number[]) => chunk.map((n) => n * 2);

      const result = await processInChunks(array, processor, 3);

      expect(result).toEqual([]);
    });

    it('should handle single item', async () => {
      const array = [1];
      const processor = (chunk: number[]) => chunk.map((n) => n * 2);

      const result = await processInChunks(array, processor, 3);

      expect(result).toEqual([2]);
    });
  });
});
