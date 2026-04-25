import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Search, X, SlidersHorizontal } from 'lucide-react';
import useKnowledgeGraphStore from '../../../stores/knowledgeGraphStore';
import { knowledgeApi } from '../../../api/knowledge';

interface FilterPanelProps {
  onFilterChange?: (filters: FilterState) => void;
}

interface FilterState {
  keyword: string;
  category: string;
  regions: string[];
  periods: string[];
  minImportance: number;
  maxImportance: number;
  hasCoordinates: boolean | null;
}

export default function FilterPanel({ onFilterChange }: FilterPanelProps) {
  const { toggleFilterPanel, filterPanelCollapsed, setCategory, setKeyword } =
    useKnowledgeGraphStore();
  const [filters, setFilters] = useState<FilterState>({
    keyword: '',
    category: 'all',
    regions: [],
    periods: [],
    minImportance: 0,
    maxImportance: 1,
    hasCoordinates: null,
  });
  const [categories, setCategories] = useState<
    Array<{ value: string; label: string; color: string }>
  >([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    try {
      const [categoriesData, regionsData, periodsData] = await Promise.all([
        knowledgeApi.getCategories(),
        knowledgeApi.getRegions(),
        knowledgeApi.getPeriods(),
      ]);
      setCategories(categoriesData);
      setRegions(regionsData);
      setPeriods(periodsData);
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  };

  const updateFilter = (
    key: keyof FilterState,
    value: string | number | boolean | null | string[]
  ) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);

    // 同步到 store，触发图谱重新加载
    if (key === 'category') {
      setCategory(value as string);
    } else if (key === 'keyword') {
      setKeyword(value as string);
    }
  };

  const toggleArrayValue = (key: 'regions' | 'periods', value: string) => {
    const currentValues = filters[key];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    updateFilter(key, newValues);
  };

  const resetFilters = () => {
    const resetState: FilterState = {
      keyword: '',
      category: 'all',
      regions: [],
      periods: [],
      minImportance: 0,
      maxImportance: 1,
      hasCoordinates: null,
    };
    setFilters(resetState);
    onFilterChange?.(resetState);
  };

  const hasActiveFilters = () => {
    return (
      filters.keyword !== '' ||
      filters.category !== 'all' ||
      filters.regions.length > 0 ||
      filters.periods.length > 0 ||
      filters.minImportance > 0 ||
      filters.maxImportance < 1 ||
      filters.hasCoordinates !== null
    );
  };

  return (
    <motion.div
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: filterPanelCollapsed ? -320 : 0, opacity: filterPanelCollapsed ? 0 : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-80 backdrop-blur-xl h-full flex flex-col relative overflow-hidden"
      style={{
        background: 'var(--gradient-card)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, var(--color-primary), var(--color-secondary), var(--color-accent))',
          opacity: 0.03,
        }}
      />

      <div className="relative z-10">
        <div className="p-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <h2
              className="text-lg font-semibold flex items-center gap-3"
              style={{ color: 'var(--color-text-primary)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                style={{ background: 'var(--gradient-primary)' }}
              >
                <SlidersHorizontal size={18} style={{ color: 'var(--color-text-inverse)' }} />
              </div>
              <div>
                <span>高级筛选</span>
                <p
                  className="text-xs font-normal mt-0.5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {hasActiveFilters() ? '已应用筛选条件' : '多条件组合搜索'}
                </p>
              </div>
            </h2>
            <motion.button
              onClick={toggleFilterPanel}
              whileHover={{ scale: 1.1, rotate: -5 }}
              whileTap={{ scale: 0.9 }}
              className="p-2.5 rounded-xl transition-all group"
              style={{ background: 'var(--color-surface)' }}
            >
              <ChevronLeft
                size={20}
                style={{ color: 'var(--color-text-muted)' }}
                className="transition-colors"
              />
            </motion.button>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <label
            className="text-sm font-medium mb-2 block"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            关键词搜索
          </label>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => updateFilter('keyword', e.target.value)}
              placeholder="搜索实体名称或描述..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
        </div>

        <div>
          <label
            className="text-sm font-medium mb-2 block"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            实体类型
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateFilter('category', 'all')}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                filters.category === 'all' ? 'ring-2 ring-primary' : ''
              }`}
              style={{
                background:
                  filters.category === 'all' ? 'var(--color-primary)' : 'var(--color-surface)',
                color:
                  filters.category === 'all'
                    ? 'var(--color-text-inverse)'
                    : 'var(--color-text-primary)',
              }}
            >
              全部
            </button>
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => updateFilter('category', cat.value)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all`}
                style={{
                  background: filters.category === cat.value ? cat.color : 'var(--color-surface)',
                  color: filters.category === cat.value ? '#fff' : 'var(--color-text-primary)',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            className="text-sm font-medium mb-2 block"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            地区筛选
          </label>
          <div className="flex flex-wrap gap-2">
            {regions.map((region) => (
              <button
                key={region}
                onClick={() => toggleArrayValue('regions', region)}
                className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                  filters.regions.includes(region) ? 'ring-2 ring-primary' : ''
                }`}
                style={{
                  background: filters.regions.includes(region)
                    ? 'var(--color-primary)'
                    : 'var(--color-surface)',
                  color: filters.regions.includes(region)
                    ? 'var(--color-text-inverse)'
                    : 'var(--color-text-primary)',
                }}
              >
                {region}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            className="text-sm font-medium mb-2 block"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            时期筛选
          </label>
          <div className="flex flex-wrap gap-2">
            {periods.map((period) => (
              <button
                key={period}
                onClick={() => toggleArrayValue('periods', period)}
                className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                  filters.periods.includes(period) ? 'ring-2 ring-primary' : ''
                }`}
                style={{
                  background: filters.periods.includes(period)
                    ? 'var(--color-primary)'
                    : 'var(--color-surface)',
                  color: filters.periods.includes(period)
                    ? 'var(--color-text-inverse)'
                    : 'var(--color-text-primary)',
                }}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            className="text-sm font-medium mb-3 block"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            重要性范围: {filters.minImportance.toFixed(1)} - {filters.maxImportance.toFixed(1)}
          </label>
          <div className="space-y-3">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={filters.minImportance}
              onChange={(e) => updateFilter('minImportance', parseFloat(e.target.value))}
              className="w-full"
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={filters.maxImportance}
              onChange={(e) => updateFilter('maxImportance', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {hasActiveFilters() && (
          <button
            onClick={resetFilters}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <X size={14} />
            重置所有筛选条件
          </button>
        )}
      </div>
    </motion.div>
  );
}
