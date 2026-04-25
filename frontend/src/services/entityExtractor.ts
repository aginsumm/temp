interface ExtractedEntity {
  text: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'number' | 'concept' | 'product';
  confidence: number;
  startIndex: number;
  endIndex: number;
}

interface ExtractionRule {
  name: string;
  pattern: RegExp;
  type: ExtractedEntity['type'];
  confidence: number;
  transform?: (match: string) => string;
}

const EXTRACTION_RULES: ExtractionRule[] = [
  {
    name: 'date_year_month_day',
    pattern: /\b(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日]?\b/g,
    type: 'date',
    confidence: 0.95,
  },
  {
    name: 'date_year_month',
    pattern: /\b(\d{4})[年/-](\d{1,2})[月]?\b/g,
    type: 'date',
    confidence: 0.9,
  },
  {
    name: 'date_year',
    pattern: /\b(19|20)\d{2}年?\b/g,
    type: 'date',
    confidence: 0.85,
  },
  {
    name: 'percentage',
    pattern: /\b(\d+\.?\d*)%\b/g,
    type: 'number',
    confidence: 0.95,
  },
  {
    name: 'currency_cny',
    pattern: /\b(\d+\.?\d*)[万亿元]?元\b/g,
    type: 'number',
    confidence: 0.9,
  },
  {
    name: 'currency_usd',
    pattern: /\$[\d,]+\.?\d*/g,
    type: 'number',
    confidence: 0.9,
  },
  {
    name: 'phone_china',
    pattern: /\b1[3-9]\d{9}\b/g,
    type: 'concept',
    confidence: 0.95,
  },
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    type: 'concept',
    confidence: 0.95,
  },
  {
    name: 'url',
    pattern: /\bhttps?:\/\/[^\s]+\b/g,
    type: 'concept',
    confidence: 0.95,
  },
  {
    name: 'chinese_name',
    pattern: /[\u4e00-\u9fa5]{2,4}(?:先生|女士|同学|老师|教授|博士|经理|总|部长|局长)/g,
    type: 'person',
    confidence: 0.8,
  },
  {
    name: 'organization_suffix',
    pattern: /[\u4e00-\u9fa5]+(?:公司|集团|学校|大学|医院|研究院|研究所|局|部|委员会|协会|学会)/g,
    type: 'organization',
    confidence: 0.85,
  },
  {
    name: 'location_province_city',
    pattern: /[\u4e00-\u9fa5]+(?:省|市|县|区|镇|村)/g,
    type: 'location',
    confidence: 0.85,
  },
  {
    name: 'country_name',
    pattern:
      /\b(?:中国|美国|英国|法国|德国|日本|韩国|俄罗斯|印度|巴西|澳大利亚|加拿大|意大利|西班牙|荷兰|瑞士|瑞典|挪威|丹麦|芬兰|波兰|土耳其|沙特阿拉伯|伊朗|以色列|新加坡|马来西亚|泰国|越南|印度尼西亚|菲律宾|墨西哥|阿根廷|智利|哥伦比亚|南非|埃及|尼日利亚|肯尼亚)\b/g,
    type: 'location',
    confidence: 0.9,
  },
  {
    name: 'tech_concept',
    pattern:
      /\b(?:人工智能|机器学习|深度学习|自然语言处理|计算机视觉|语音识别|知识图谱|神经网络|大语言模型|Transformer|BERT|GPT|CNN|RNN|LSTM|强化学习|迁移学习|联邦学习|边缘计算|云计算|区块链|物联网|5G|6G|量子计算|元宇宙|Web3)\b/g,
    type: 'concept',
    confidence: 0.85,
  },
  {
    name: 'product_name',
    pattern: /[\u4e00-\u9fa5A-Za-z0-9]+(?:版|系统|平台|应用|软件|工具|框架|引擎|服务)/g,
    type: 'product',
    confidence: 0.75,
  },
];

class RuleBasedEntityExtractor {
  private rules: ExtractionRule[];
  private minConfidence: number;
  private maxEntitiesPerText: number;

  constructor(options?: {
    rules?: ExtractionRule[];
    minConfidence?: number;
    maxEntitiesPerText?: number;
  }) {
    this.rules = options?.rules || EXTRACTION_RULES;
    this.minConfidence = options?.minConfidence || 0.7;
    this.maxEntitiesPerText = options?.maxEntitiesPerText || 50;
  }

  extract(text: string): ExtractedEntity[] {
    if (!text || text.length < 2) return [];

    const entities: ExtractedEntity[] = [];

    for (const rule of this.rules) {
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      let match;

      while ((match = regex.exec(text)) !== null) {
        const extractedText = rule.transform ? rule.transform(match[0]) : match[0];

        if (extractedText.length < 2) continue;

        entities.push({
          text: extractedText,
          type: rule.type,
          confidence: rule.confidence,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    const filteredEntities = entities
      .filter((e) => e.confidence >= this.minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.maxEntitiesPerText);

    return this.removeOverlappingEntities(filteredEntities);
  }

  extractFromMessages(messages: Array<{ content: string; role: string }>): ExtractedEntity[] {
    const allEntities: ExtractedEntity[] = [];

    for (const message of messages) {
      const entities = this.extract(message.content);
      allEntities.push(...entities);
    }

    return this.mergeDuplicateEntities(allEntities);
  }

  private removeOverlappingEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    if (entities.length === 0) return [];

    const sorted = [...entities].sort((a, b) => {
      if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
      return b.confidence - a.confidence;
    });

    const result: ExtractedEntity[] = [];
    let lastEndIndex = -1;

    for (const entity of sorted) {
      if (entity.startIndex >= lastEndIndex) {
        result.push(entity);
        lastEndIndex = entity.endIndex;
      }
    }

    return result;
  }

  private mergeDuplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const entityMap = new Map<string, ExtractedEntity>();

    for (const entity of entities) {
      const key = `${entity.type}:${entity.text.toLowerCase()}`;

      if (entityMap.has(key)) {
        const existing = entityMap.get(key)!;
        if (entity.confidence > existing.confidence) {
          entityMap.set(key, entity);
        }
      } else {
        entityMap.set(key, entity);
      }
    }

    return Array.from(entityMap.values());
  }

  getEntityTypes(): ExtractedEntity['type'][] {
    return ['person', 'organization', 'location', 'date', 'number', 'concept', 'product'];
  }

  addRule(rule: ExtractionRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleName: string): boolean {
    const index = this.rules.findIndex((r) => r.name === ruleName);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  updateMinConfidence(confidence: number): void {
    this.minConfidence = Math.max(0, Math.min(1, confidence));
  }

  getMinConfidence(): number {
    return this.minConfidence;
  }
}

export const entityExtractor = new RuleBasedEntityExtractor();

export { RuleBasedEntityExtractor, type ExtractedEntity, type ExtractionRule };
