export type EntityType = 'inheritor' | 'technique' | 'work' | 'pattern' | 'region' | 'period' | 'material';

export interface CategoryConfig {
  value: EntityType;
  label: string;
  color: string;
  colorVar: string;
  gradient: string[];
}

export const CATEGORY_CONFIG: CategoryConfig[] = [
  {
    value: 'inheritor',
    label: '传承人',
    color: '#8B5CF6',
    colorVar: 'var(--color-primary)',
    gradient: ['var(--color-primary)', 'var(--color-primary-hover)'],
  },
  {
    value: 'technique',
    label: '技艺',
    color: '#10B981',
    colorVar: 'var(--color-secondary)',
    gradient: ['var(--color-secondary)', 'var(--color-secondary-hover)'],
  },
  {
    value: 'work',
    label: '作品',
    color: '#F59E0B',
    colorVar: 'var(--color-accent)',
    gradient: ['var(--color-accent)', 'var(--color-accent-hover)'],
  },
  {
    value: 'pattern',
    label: '纹样',
    color: '#EF4444',
    colorVar: 'var(--color-error)',
    gradient: ['var(--color-error)', 'var(--color-error)'],
  },
  {
    value: 'region',
    label: '地域',
    color: '#06B6D4',
    colorVar: 'var(--color-info)',
    gradient: ['var(--color-info)', 'var(--color-info)'],
  },
  {
    value: 'period',
    label: '时期',
    color: '#6366F1',
    colorVar: 'var(--color-indigo)',
    gradient: ['var(--color-indigo)', 'var(--color-indigo-hover)'],
  },
  {
    value: 'material',
    label: '材料',
    color: '#84CC16',
    colorVar: 'var(--color-success)',
    gradient: ['var(--color-success)', 'var(--color-success)'],
  },
];

export const CATEGORY_COLORS: Record<EntityType, string> = {
  inheritor: 'var(--color-primary)',
  technique: 'var(--color-secondary)',
  work: 'var(--color-accent)',
  pattern: 'var(--color-error)',
  region: 'var(--color-info)',
  period: 'var(--color-primary)',
  material: 'var(--color-success)',
};

export const CATEGORY_LABELS: Record<EntityType, string> = {
  inheritor: '传承人',
  technique: '技艺',
  work: '作品',
  pattern: '纹样',
  region: '地域',
  period: '时期',
  material: '材料',
};

export const CATEGORY_HEX_COLORS: Record<EntityType, string> = {
  inheritor: '#8B5CF6',
  technique: '#10B981',
  work: '#F59E0B',
  pattern: '#EF4444',
  region: '#06B6D4',
  period: '#6366F1',
  material: '#84CC16',
};

export const CATEGORY_GRADIENTS: Record<EntityType, string[]> = {
  inheritor: ['var(--color-primary)', 'var(--color-primary-hover)'],
  technique: ['var(--color-secondary)', 'var(--color-secondary-hover)'],
  work: ['var(--color-accent)', 'var(--color-accent-hover)'],
  pattern: ['var(--color-error)', 'var(--color-error)'],
  region: ['var(--color-info)', 'var(--color-info)'],
  period: ['var(--color-primary)', 'var(--color-primary-hover)'],
  material: ['var(--color-success)', 'var(--color-success)'],
};

export const ENTITY_TYPES = CATEGORY_CONFIG.map((c) => ({
  value: c.value,
  label: c.label,
  colorVar: c.colorVar,
}));

export const RELATION_TYPES = [
  { value: '传承', label: '传承' },
  { value: '创作', label: '创作' },
  { value: '包含', label: '包含' },
  { value: '产地', label: '产地' },
  { value: '时期', label: '时期' },
  { value: '使用', label: '使用' },
  { value: '相关', label: '相关' },
  { value: '属于', label: '属于' },
  { value: '材料', label: '材料' },
];

export const RELATION_LABELS: Record<string, string> = {
  传承: '传承关系',
  创作: '创作关系',
  包含: '包含关系',
  相关: '相关关系',
  属于: '属于关系',
  使用: '使用关系',
  产地: '产地关系',
  时期: '时期关系',
  材料: '材料关系',
};

export function getCategoryColor(type: string): string {
  return CATEGORY_COLORS[type as EntityType] || 'var(--color-primary)';
}

export function getCategoryLabel(type: string): string {
  return CATEGORY_LABELS[type as EntityType] || type;
}

export function getCategoryHexColor(type: string): string {
  return CATEGORY_HEX_COLORS[type as EntityType] || '#8B5CF6';
}

export function getCategoryGradient(type: string): string[] {
  return CATEGORY_GRADIENTS[type as EntityType] || ['var(--color-primary)', 'var(--color-primary-hover)'];
}

export function getCategoryConfig(type: string): CategoryConfig | undefined {
  return CATEGORY_CONFIG.find((c) => c.value === type);
}
