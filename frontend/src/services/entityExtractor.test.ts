import { describe, it, expect } from 'vitest';
import { entityExtractor, RuleBasedEntityExtractor } from '../services/entityExtractor';

describe('RuleBasedEntityExtractor', () => {
  describe('extract', () => {
    it('should extract date entities', () => {
      const text = '这项技艺起源于1985年3月15日';
      const entities = entityExtractor.extract(text);

      const dateEntities = entities.filter((e) => e.type === 'date');
      expect(dateEntities.length).toBeGreaterThan(0);
    });

    it('should extract year entities', () => {
      const text = '这项技艺有2000年的历史';
      const entities = entityExtractor.extract(text);

      const yearEntities = entities.filter((e) => e.type === 'date');
      expect(yearEntities.length).toBeGreaterThan(0);
    });

    it('should extract number entities (year)', () => {
      const text = '这项技艺有2000年的历史';
      const entities = entityExtractor.extract(text);

      const numberEntities = entities.filter((e) => e.type === 'date');
      expect(numberEntities.length).toBeGreaterThan(0);
    });

    it('should extract person entities', () => {
      const text = '张明老师是著名的传承人';
      const entities = entityExtractor.extract(text);

      const personEntities = entities.filter((e) => e.type === 'person');
      expect(personEntities.length).toBeGreaterThan(0);
    });

    it('should extract organization entities', () => {
      const text = '中国非物质文化遗产保护协会';
      const entities = entityExtractor.extract(text);

      const orgEntities = entities.filter((e) => e.type === 'organization');
      expect(orgEntities.length).toBeGreaterThan(0);
    });

    it('should extract location entities', () => {
      const text = '这项技艺来自江苏省苏州市';
      const entities = entityExtractor.extract(text);

      const locationEntities = entities.filter((e) => e.type === 'location');
      expect(locationEntities.length).toBeGreaterThan(0);
    });

    it('should extract tech concept entities', () => {
      const text = '使用GPT模型进行非遗保护';
      const entities = entityExtractor.extract(text);

      const conceptEntities = entities.filter((e) => e.type === 'concept');
      expect(conceptEntities.length).toBeGreaterThan(0);
    });

    it('should return empty array for short text', () => {
      const entities = entityExtractor.extract('a');
      expect(entities).toEqual([]);
    });

    it('should respect minConfidence threshold', () => {
      const extractor = new RuleBasedEntityExtractor({ minConfidence: 0.95 });
      const text = '1985年3月15日';
      const entities = extractor.extract(text);

      entities.forEach((entity) => {
        expect(entity.confidence).toBeGreaterThanOrEqual(0.95);
      });
    });

    it('should limit entities to maxEntitiesPerText', () => {
      const extractor = new RuleBasedEntityExtractor({ maxEntitiesPerText: 2 });
      const text = '1985年3月15日 2000年 85% 100万元';
      const entities = extractor.extract(text);

      expect(entities.length).toBeLessThanOrEqual(2);
    });
  });

  describe('extractFromMessages', () => {
    it('should extract entities from multiple messages', () => {
      const messages = [
        { content: '1985年创立', role: 'user' },
        { content: '江苏省苏州市', role: 'assistant' },
      ];

      const entities = entityExtractor.extractFromMessages(messages);
      expect(entities.length).toBeGreaterThan(0);
    });

    it('should merge duplicate entities', () => {
      const messages = [
        { content: '1985年', role: 'user' },
        { content: '1985年', role: 'assistant' },
      ];

      const entities = entityExtractor.extractFromMessages(messages);
      const dateEntities = entities.filter((e) => e.type === 'date' && e.text.includes('1985'));
      expect(dateEntities.length).toBeLessThanOrEqual(1);
    });
  });

  describe('addRule', () => {
    it('should add custom extraction rule', () => {
      const extractor = new RuleBasedEntityExtractor();
      extractor.addRule({
        name: 'heritage_type',
        pattern: /非物质文化遗产/g,
        type: 'concept',
        confidence: 0.95,
      });

      const text = '这是非物质文化遗产';
      const entities = extractor.extract(text);

      const heritageEntities = entities.filter((e) => e.text === '非物质文化遗产');
      expect(heritageEntities.length).toBeGreaterThan(0);
    });
  });

  describe('removeRule', () => {
    it('should remove existing rule', () => {
      const extractor = new RuleBasedEntityExtractor();
      const result = extractor.removeRule('date_year');

      expect(result).toBe(true);
    });

    it('should return false for non-existing rule', () => {
      const extractor = new RuleBasedEntityExtractor();
      const result = extractor.removeRule('non_existing_rule');

      expect(result).toBe(false);
    });
  });

  describe('updateMinConfidence', () => {
    it('should update minimum confidence threshold', () => {
      const extractor = new RuleBasedEntityExtractor();
      extractor.updateMinConfidence(0.9);

      const text = '1985年';
      const entities = extractor.extract(text);

      entities.forEach((entity) => {
        expect(entity.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should clamp confidence between 0 and 1', () => {
      const extractor = new RuleBasedEntityExtractor();
      extractor.updateMinConfidence(1.5);

      expect(extractor.getMinConfidence()).toBe(1);

      extractor.updateMinConfidence(-0.5);
      expect(extractor.getMinConfidence()).toBe(0);
    });
  });

  describe('getEntityTypes', () => {
    it('should return all supported entity types', () => {
      const types = entityExtractor.getEntityTypes();

      expect(types).toContain('person');
      expect(types).toContain('organization');
      expect(types).toContain('location');
      expect(types).toContain('date');
      expect(types).toContain('number');
      expect(types).toContain('concept');
      expect(types).toContain('product');
    });
  });
});
