import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Star, TrendingUp } from 'lucide-react';
import { Entity } from '../../../api/knowledge';

interface TimelineViewProps {
  entities: Entity[];
  onEntityClick: (entityId: string) => void;
  loading?: boolean;
}

const categoryColors: Record<string, string> = {
  inheritor: '#8B5CF6',
  technique: '#10B981',
  work: '#F59E0B',
  pattern: '#EF4444',
  region: '#06B6D4',
  period: '#6366F1',
  material: '#84CC16',
};

const categoryLabels: Record<string, string> = {
  inheritor: '传承人',
  technique: '技艺',
  work: '作品',
  pattern: '纹样',
  region: '地域',
  period: '时期',
  material: '材料',
};

export default function TimelineView({ entities, onEntityClick, loading }: TimelineViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  const periodEntities = entities.reduce<Record<string, Entity[]>>(
    (acc, entity) => {
      if (entity.period) {
        if (!acc[entity.period]) {
          acc[entity.period] = [];
        }
        acc[entity.period].push(entity);
      }
      return acc;
    },
    {} as Record<string, Entity[]>
  );

  const periods = Object.entries(periodEntities)
    .map(([name, items]) => ({
      name,
      count: items.length,
      entities: items,
    }))
    .sort((a, b) => {
      const order = ['古代', '唐宋', '明清', '近代', '现代', '当代'];
      const indexA = order.findIndex((p) => a.name.includes(p));
      const indexB = order.findIndex((p) => b.name.includes(p));
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!entities || entities.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-slate-700/50 to-slate-800/50 flex items-center justify-center">
            <TrendingUp size={40} className="text-gray-500" />
          </div>
          <p className="text-xl font-medium text-gray-300 mb-2">暂无数据</p>
          <p className="text-sm text-gray-500">请调整筛选条件或搜索关键词</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 opacity-50" />

            <div className="space-y-6">
              {periods.map((period, periodIndex) => (
                <motion.div
                  key={period.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: periodIndex * 0.1 }}
                  className="relative pl-20"
                >
                  <div className="absolute left-6 w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 border-4 border-slate-800 shadow-lg shadow-blue-500/30" />

                  <motion.div
                    onClick={() =>
                      setSelectedPeriod(selectedPeriod === period.name ? null : period.name)
                    }
                    whileHover={{ scale: 1.02 }}
                    className={`bg-slate-800/80 backdrop-blur-xl border rounded-xl p-6 cursor-pointer transition-all ${
                      selectedPeriod === period.name
                        ? 'border-blue-500/50 shadow-lg shadow-blue-500/20'
                        : 'border-slate-700/50 hover:border-slate-600/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                          <Clock size={20} className="text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-white">{period.name}</h3>
                      </div>
                      <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium border border-blue-500/30">
                        {period.count} 项
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {period.entities
                        .slice(0, selectedPeriod === period.name ? undefined : 4)
                        .map((entity, entityIndex) => (
                          <motion.div
                            key={entity.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: entityIndex * 0.05 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEntityClick(entity.id);
                            }}
                            className="p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-all cursor-pointer border border-slate-600/50 hover:border-cyan-500/50"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                  backgroundColor: categoryColors[entity.type] || '#3B82F6',
                                }}
                              />
                              <span className="font-medium text-gray-200">{entity.name}</span>
                              <div className="flex items-center gap-1 text-yellow-400 ml-auto">
                                <Star size={10} fill="currentColor" />
                                <span className="text-xs">
                                  {(entity.importance * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>{categoryLabels[entity.type] || entity.type}</span>
                              {entity.region && (
                                <>
                                  <span>•</span>
                                  <span>{entity.region}</span>
                                </>
                              )}
                            </div>
                          </motion.div>
                        ))}
                    </div>

                    {period.entities.length > 4 && selectedPeriod !== period.name && (
                      <div className="mt-3 text-center">
                        <button
                          onClick={() => setSelectedPeriod(period.name)}
                          className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                        >
                          查看更多 ({period.entities.length - 4} 项)
                        </button>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="w-80 bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-xl border-l border-slate-700/50 overflow-y-auto">
        <div className="p-4 border-b border-slate-700/50">
          <h3 className="font-bold text-white">时期分布</h3>
          <p className="text-sm text-gray-400 mt-1">共 {periods.length} 个时期</p>
        </div>
        <div className="p-4 space-y-2">
          {periods.map((period, index) => (
            <motion.div
              key={period.name}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setSelectedPeriod(selectedPeriod === period.name ? null : period.name)}
              className={`p-3 rounded-lg cursor-pointer transition-all ${
                selectedPeriod === period.name
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-slate-700/50 hover:bg-slate-700 text-gray-300 border border-slate-600/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={16} />
                  <span className="font-medium">{period.name}</span>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedPeriod === period.name
                      ? 'bg-white text-purple-500'
                      : 'bg-purple-500/20 text-purple-400'
                  }`}
                >
                  {period.count}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
