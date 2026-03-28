import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Star, TrendingUp } from 'lucide-react';
import { Entity } from '../../../api/knowledge';

interface MapViewProps {
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

export default function MapView({ entities, onEntityClick, loading }: MapViewProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const regionEntities = entities.reduce<Record<string, Entity[]>>((acc, entity) => {
    if (entity.region) {
      if (!acc[entity.region]) {
        acc[entity.region] = [];
      }
      acc[entity.region].push(entity);
    }
    return acc;
  }, {} as Record<string, Entity[]>);

  const regions = Object.entries(regionEntities).map(([name, items]) => ({
    name,
    count: items.length,
    entities: items,
  }));

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
      <div className="flex-1 relative bg-gradient-to-br from-slate-800/50 to-slate-900/50">
        <div className="w-full h-full flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white mb-4 shadow-lg shadow-blue-500/30">
                <MapPin size={48} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">非遗地域分布</h3>
              <p className="text-gray-400">点击右侧地域查看详情</p>
            </div>
          </motion.div>
        </div>

        {selectedRegion && regionEntities[selectedRegion] && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-4 right-4 w-80 max-h-96 overflow-y-auto bg-slate-800/90 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-white">{selectedRegion}</h4>
              <button
                onClick={() => setSelectedRegion(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {regionEntities[selectedRegion].map((entity, index) => (
                <motion.div
                  key={entity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onEntityClick(entity.id)}
                  className="p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 cursor-pointer transition-all border border-slate-600/50 hover:border-cyan-500/50"
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
                      <span className="text-xs">{(entity.importance * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  {entity.description && (
                    <p className="text-xs text-gray-400 line-clamp-1">{entity.description}</p>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <div className="w-80 bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-xl border-l border-slate-700/50 overflow-y-auto">
        <div className="p-4 border-b border-slate-700/50">
          <h3 className="font-bold text-white">地域分布</h3>
          <p className="text-sm text-gray-400 mt-1">共 {regions.length} 个地域</p>
        </div>
        <div className="p-4 space-y-2">
          {regions
            .sort((a, b) => b.count - a.count)
            .map(({ name, count }, index) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedRegion(selectedRegion === name ? null : name)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedRegion === name
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-slate-700/50 hover:bg-slate-700 text-gray-300 border border-slate-600/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} />
                    <span className="font-medium">{name}</span>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      selectedRegion === name
                        ? 'bg-white text-blue-500'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {count}
                  </span>
                </div>
              </motion.div>
            ))}
        </div>
      </div>
    </div>
  );
}
