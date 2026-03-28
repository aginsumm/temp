import { motion } from 'framer-motion';
import { MapPin, Star, Clock, TrendingUp } from 'lucide-react';
import { Entity } from '../../../api/knowledge';

interface ListViewProps {
  entities: Entity[];
  onEntityClick: (entityId: string) => void;
  loading?: boolean;
}

const categoryColors: Record<string, { bg: string; text: string; gradient: string }> = {
  inheritor: { bg: 'from-purple-500 to-violet-600', text: '#8B5CF6', gradient: 'rgba(139, 92, 246, 0.1)' },
  technique: { bg: 'from-green-500 to-emerald-600', text: '#10B981', gradient: 'rgba(16, 185, 129, 0.1)' },
  work: { bg: 'from-amber-500 to-orange-600', text: '#F59E0B', gradient: 'rgba(245, 158, 11, 0.1)' },
  pattern: { bg: 'from-red-500 to-rose-600', text: '#EF4444', gradient: 'rgba(239, 68, 68, 0.1)' },
  region: { bg: 'from-cyan-500 to-blue-600', text: '#06B6D4', gradient: 'rgba(6, 182, 212, 0.1)' },
  period: { bg: 'from-indigo-500 to-purple-600', text: '#6366F1', gradient: 'rgba(99, 102, 241, 0.1)' },
  material: { bg: 'from-lime-500 to-green-600', text: '#84CC16', gradient: 'rgba(132, 204, 22, 0.1)' },
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

export default function ListView({ entities, onEntityClick, loading }: ListViewProps) {
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
    <div className="h-full overflow-y-auto p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entities.map((entity, index) => {
          const categoryStyle = categoryColors[entity.type] || categoryColors.technique;
          
          return (
            <motion.div
              key={entity.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -8, scale: 1.02 }}
              onClick={() => onEntityClick(entity.id)}
              className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 cursor-pointer group relative overflow-hidden"
              style={{
                boxShadow: `0 0 0 1px ${categoryStyle.gradient}`
              }}
            >
              {/* 装饰性背景 */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `linear-gradient(135deg, ${categoryStyle.gradient}, transparent)`
                }}
              />
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${categoryStyle.bg} shadow-lg`}
                    style={{ boxShadow: `0 4px 20px ${categoryStyle.text}40` }}
                  >
                    {categoryLabels[entity.type] || entity.type}
                  </motion.span>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.05 + 0.1 }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/10 rounded-full"
                  >
                    <Star size={12} fill="#FBBF24" className="text-yellow-400" />
                    <span className="text-xs font-bold text-yellow-400">
                      {(entity.importance * 100).toFixed(0)}%
                    </span>
                  </motion.div>
                </div>

                <h3 className="text-lg font-bold text-white mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-cyan-400 transition-all">
                  {entity.name}
                </h3>

                {entity.description && (
                  <p className="text-sm text-gray-400 line-clamp-2 mb-4 leading-relaxed">
                    {entity.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {entity.region && (
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/30 rounded-lg"
                    >
                      <MapPin size={12} className="text-blue-400" />
                      <span>{entity.region}</span>
                    </motion.div>
                  )}
                  {entity.period && (
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="flex items-center gap-1.5 px-2 py-1 bg-slate-700/30 rounded-lg"
                    >
                      <Clock size={12} className="text-purple-400" />
                      <span>{entity.period}</span>
                    </motion.div>
                  )}
                </div>

                {/* Hover 效果边框 */}
                <div 
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    boxShadow: `inset 0 0 0 2px ${categoryStyle.text}40`
                  }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
