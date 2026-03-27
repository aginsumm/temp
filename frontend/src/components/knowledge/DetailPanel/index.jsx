import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, MapPin, Clock, Star, ExternalLink, Share2, Bookmark } from 'lucide-react';
import { knowledgeApi } from '../../../api/knowledge';
import useKnowledgeGraphStore from '../../../stores/knowledgeGraphStore';

export default function DetailPanel() {
  const [entity, setEntity] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [relatedEntities, setRelatedEntities] = useState([]);
  const [loading, setLoading] = useState(false);

  const { selectedNode, detailPanelCollapsed, setSelectedNode } = useKnowledgeGraphStore();

  useEffect(() => {
    if (selectedNode) {
      loadEntityDetail(selectedNode);
    } else {
      setEntity(null);
      setRelationships([]);
      setRelatedEntities([]);
    }
  }, [selectedNode]);

  const loadEntityDetail = async (entityId) => {
    try {
      setLoading(true);
      const detail = await knowledgeApi.getEntityDetail(entityId);
      setEntity(detail.entity);
      setRelationships(detail.relationships);
      setRelatedEntities(detail.related_entities);
    } catch (error) {
      console.error('加载实体详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedNode(null);
  };

  if (detailPanelCollapsed || !selectedNode) {
    return null;
  }

  if (loading) {
    return (
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        className="w-96 bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-xl border-l border-slate-700/50 h-full flex flex-col shadow-2xl"
      >
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
          />
        </div>
      </motion.div>
    );
  }

  if (!entity) {
    return null;
  }

  const categoryColors = {
    inheritor: {
      bg: 'from-purple-500 to-violet-600',
      text: '#8B5CF6',
      light: 'rgba(139, 92, 246, 0.1)',
    },
    technique: {
      bg: 'from-green-500 to-emerald-600',
      text: '#10B981',
      light: 'rgba(16, 185, 129, 0.1)',
    },
    work: { bg: 'from-amber-500 to-orange-600', text: '#F59E0B', light: 'rgba(245, 158, 11, 0.1)' },
    pattern: { bg: 'from-red-500 to-rose-600', text: '#EF4444', light: 'rgba(239, 68, 68, 0.1)' },
    region: { bg: 'from-cyan-500 to-blue-600', text: '#06B6D4', light: 'rgba(6, 182, 212, 0.1)' },
    period: {
      bg: 'from-indigo-500 to-purple-600',
      text: '#6366F1',
      light: 'rgba(99, 102, 241, 0.1)',
    },
    material: {
      bg: 'from-lime-500 to-green-600',
      text: '#84CC16',
      light: 'rgba(132, 204, 22, 0.1)',
    },
  };

  const categoryLabels = {
    inheritor: '传承人',
    technique: '技艺',
    work: '作品',
    pattern: '纹样',
    region: '地域',
    period: '时期',
    material: '材料',
  };

  const categoryStyle = categoryColors[entity.type] || categoryColors.technique;

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-96 bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-xl border-l border-slate-700/50 h-full flex flex-col shadow-2xl relative overflow-hidden"
    >
      {/* 装饰性背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-purple-500/5 to-cyan-500/5 pointer-events-none" />

      <div className="relative z-10">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 500 }}
                className="flex items-center gap-2 mb-3"
              >
                <span
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${categoryStyle.bg} shadow-lg`}
                  style={{ boxShadow: `0 4px 20px ${categoryStyle.text}40` }}
                >
                  {categoryLabels[entity.type] || entity.type}
                </span>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500/10 rounded-full"
                >
                  <Star size={14} fill="#FBBF24" className="text-yellow-400" />
                  <span className="text-sm font-bold text-yellow-400">
                    {(entity.importance * 100).toFixed(0)}%
                  </span>
                </motion.div>
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-2xl font-bold text-white mb-2"
              >
                {entity.name}
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex gap-2"
              >
                <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-xs text-gray-300 transition-all">
                  <Share2 size={12} />
                  分享
                </button>
                <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-xs text-gray-300 transition-all">
                  <Bookmark size={12} />
                  收藏
                </button>
              </motion.div>
            </div>
            <motion.button
              onClick={handleClose}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-all"
            >
              <X size={20} className="text-gray-400 hover:text-white transition-colors" />
            </motion.button>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-6">
        {entity.description && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-500 rounded-full" />
              描述
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              {entity.description}
            </p>
          </motion.div>
        )}

        {entity.region && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-start gap-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
              <MapPin size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-1">地域</h3>
              <p className="text-sm text-gray-400">{entity.region}</p>
            </div>
          </motion.div>
        )}

        {entity.period && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex items-start gap-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <Clock size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-1">时期</h3>
              <p className="text-sm text-gray-400">{entity.period}</p>
            </div>
          </motion.div>
        )}

        {relationships.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-green-500 rounded-full" />
              关联关系
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-xs">
                {relationships.length}
              </span>
            </h3>
            <div className="space-y-2">
              {relationships.map((rel, index) => (
                <motion.div
                  key={rel.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + index * 0.05 }}
                  className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-green-500/50 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-200">{rel.relation_type}</span>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-xs text-gray-500">权重: {rel.weight}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {relatedEntities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-cyan-500 rounded-full" />
              相关实体
              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full text-xs">
                {relatedEntities.length}
              </span>
            </h3>
            <div className="space-y-2">
              {relatedEntities.map((related, index) => (
                <motion.div
                  key={related.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.55 + index * 0.05 }}
                  onClick={() => setSelectedNode(related.id)}
                  className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-cyan-500/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: categoryColors[related.type]?.text || '#3B82F6' }}
                      />
                      <span className="text-sm font-medium text-gray-200 group-hover:text-cyan-400 transition-colors">
                        {related.name}
                      </span>
                    </div>
                    <ExternalLink
                      size={14}
                      className="text-gray-500 group-hover:text-cyan-400 transition-colors"
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {categoryLabels[related.type] || related.type}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
