import { describe, it, expect, beforeEach } from 'vitest';
import { inputHistoryService, InputHistoryService } from '../services/inputHistoryService';

describe('InputHistoryService', () => {
  beforeEach(() => {
    inputHistoryService.clearHistory();
    localStorage.clear();
  });

  describe('addInput', () => {
    it('should add a new history item', () => {
      inputHistoryService.addInput('test message');

      const items = inputHistoryService.getAllHistory();
      expect(items.length).toBe(1);
      expect(items[0].text).toBe('test message');
    });

    it('should not add short inputs', () => {
      inputHistoryService.addInput('a');

      const items = inputHistoryService.getAllHistory();
      expect(items.length).toBe(0);
    });

    it('should deduplicate identical messages (case insensitive)', () => {
      inputHistoryService.addInput('test message');
      inputHistoryService.addInput('Test Message');

      const items = inputHistoryService.getAllHistory();
      expect(items.length).toBe(1);
      expect(items[0].usageCount).toBe(2);
    });

    it('should increment usage count for duplicate messages', () => {
      inputHistoryService.addInput('test message');
      inputHistoryService.addInput('test message');

      const items = inputHistoryService.getAllHistory();
      expect(items[0].usageCount).toBe(2);
    });

    it('should respect maxItems limit', () => {
      const service = new InputHistoryService();

      for (let i = 0; i < 60; i++) {
        service.addInput(`message ${i}`);
      }

      const items = service.getAllHistory();
      expect(items.length).toBe(50);
    });
  });

  describe('getRecentHistory', () => {
    it('should return most recent items first', () => {
      inputHistoryService.addInput('first');
      inputHistoryService.addInput('second');
      inputHistoryService.addInput('third');

      const recent = inputHistoryService.getRecentHistory(2);

      expect(recent.length).toBe(2);
      expect(recent[0].text).toBe('third');
      expect(recent[1].text).toBe('second');
    });

    it('should return all items when limit exceeds count', () => {
      inputHistoryService.addInput('first');
      inputHistoryService.addInput('second');

      const recent = inputHistoryService.getRecentHistory(10);

      expect(recent.length).toBe(2);
    });
  });

  describe('getFrequentHistory', () => {
    it('should return items sorted by usage count', () => {
      inputHistoryService.addInput('low usage');
      inputHistoryService.addInput('high usage');
      inputHistoryService.addInput('high usage');

      const frequent = inputHistoryService.getFrequentHistory(2);

      expect(frequent[0].text).toBe('high usage');
      expect(frequent[0].usageCount).toBe(2);
    });
  });

  describe('searchHistory', () => {
    it('should find items containing search term', () => {
      inputHistoryService.addInput('hello world');
      inputHistoryService.addInput('hello there');
      inputHistoryService.addInput('goodbye');

      const results = inputHistoryService.searchHistory('hello');

      expect(results.length).toBe(2);
    });

    it('should be case insensitive', () => {
      inputHistoryService.addInput('Hello World');

      const results = inputHistoryService.searchHistory('hello');

      expect(results.length).toBe(1);
    });

    it('should prioritize items starting with query', () => {
      inputHistoryService.addInput('world hello');
      inputHistoryService.addInput('hello world');

      const results = inputHistoryService.searchHistory('hello');

      expect(results[0].text).toBe('hello world');
    });

    it('should return all items when query is empty', () => {
      inputHistoryService.addInput('item 1');
      inputHistoryService.addInput('item 2');

      const results = inputHistoryService.searchHistory('');

      expect(results.length).toBe(2);
    });
  });

  describe('getItemById', () => {
    it('should return item by id', () => {
      inputHistoryService.addInput('test message');
      const items = inputHistoryService.getAllHistory();
      const item = inputHistoryService.getItemById(items[0].id);

      expect(item?.text).toBe('test message');
    });

    it('should return null for non-existing id', () => {
      const item = inputHistoryService.getItemById('non-existing');
      expect(item).toBeNull();
    });
  });

  describe('deleteItem', () => {
    it('should delete item by id', () => {
      inputHistoryService.addInput('to delete');
      const items = inputHistoryService.getAllHistory();
      const deleted = inputHistoryService.deleteItem(items[0].id);

      expect(deleted).toBe(true);
      expect(inputHistoryService.getAllHistory().length).toBe(0);
    });

    it('should return false for non-existing id', () => {
      const deleted = inputHistoryService.deleteItem('non-existing');
      expect(deleted).toBe(false);
    });
  });

  describe('clearHistory', () => {
    it('should remove all history items', () => {
      inputHistoryService.addInput('item 1');
      inputHistoryService.addInput('item 2');

      inputHistoryService.clearHistory();

      expect(inputHistoryService.getAllHistory().length).toBe(0);
    });
  });

  describe('persistence', () => {
    it('should save to localStorage', () => {
      inputHistoryService.addInput('persistent item');

      const saved = localStorage.getItem('chat_input_history');
      expect(saved).toBeDefined();
    });

    it('should load from localStorage on initialization', () => {
      const service1 = new InputHistoryService();
      service1.addInput('save me');

      const service2 = new InputHistoryService();
      const items = service2.getAllHistory();

      expect(items.some((item) => item.text === 'save me')).toBe(true);
    });
  });

  describe('exportHistory and importHistory', () => {
    it('should export history as JSON', () => {
      inputHistoryService.addInput('item 1');
      inputHistoryService.addInput('item 2');

      const exported = inputHistoryService.exportHistory();
      const parsed = JSON.parse(exported);

      expect(parsed.length).toBe(2);
    });

    it('should import history from JSON', () => {
      const data = JSON.stringify([
        { id: '1', text: 'imported 1', timestamp: Date.now(), usageCount: 1 },
        { id: '2', text: 'imported 2', timestamp: Date.now(), usageCount: 1 },
      ]);

      const success = inputHistoryService.importHistory(data);

      expect(success).toBe(true);
      expect(inputHistoryService.getAllHistory().length).toBe(2);
    });

    it('should return false for invalid JSON', () => {
      const success = inputHistoryService.importHistory('invalid json');
      expect(success).toBe(false);
    });

    it('should return false for non-array JSON', () => {
      const success = inputHistoryService.importHistory('{"key": "value"}');
      expect(success).toBe(false);
    });
  });
});
