import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Star, Share2, Bookmark, Copy, Check, Volume2, Tag, FileText } from 'lucide-react';
import { knowledgeApi, Entity, Relationship } from '../../../api/knowledge';
import useKnowledgeGraphStore from '../../../stores/knowledgeGraphStore';
import { useToast } from '../../common/Toast';
import {
  getCategoryColor,
  getCategoryLabel,
  getCategoryGradient,
} from '../../../constants/categories';

export default function DetailPanel() {
  const [entity, setEntity] = useState<Entity | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [relatedEntities, setRelatedEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showAllTags, setShowAllTags] = useState(false);

  const { selectedNode, detailPanelCollapsed, setSelectedNode } = useKnowledgeGraphStore();
  const toast = useToast();

  const loadEntityDetail = useCallback(
    async (entityId: string) => {
      try {
        setLoading(true);
        const detail = await knowledgeApi.getEntityDetail(entityId);
        setEntity(detail.entity);
        setRelationships(detail.relationships || []);
        setRelatedEntities(detail.related_entities || []);
      } catch (error) {
        console.error('加载实体详情失败:', error);
        toast.error('加载失败', '无法加载实体详情');
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (selectedNode) {
      loadEntityDetail(selectedNode);
      const bookmarked = localStorage.getItem(`bookmark_${selectedNode}`);
      setIsBookmarked(!!bookmarked);
    } else {
      setEntity(null);
      setRelationships([]);
      setRelatedEntities([]);
      setActiveImageIndex(0);
    }
  }, [selectedNode, loadEntityDetail]);

  const handleClose = () => {
    setSelectedNode(null);
  };

  const handleCopyLink = useCallback(async () => {
    if (!entity) return;

    const link = `${window.location.origin}/knowledge?id=${entity.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('已复制', '链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  }, [entity, toast]);

  const handleBookmark = useCallback(() => {
    if (!entity) return;

    if (isBookmarked) {
      localStorage.removeItem(`bookmark_${entity.id}`);
      setIsBookmarked(false);
      toast.success('已取消收藏', '实体已从收藏夹移除');
    } else {
      localStorage.setItem(`bookmark_${entity.id}`, JSON.stringify(entity));
      setIsBookmarked(true);
      toast.success('已收藏', '实体已添加到收藏夹');
    }
  }, [entity, isBookmarked, toast]);

  const handleShare = useCallback(async () => {
    if (!entity) return;

    const shareData = {
      title: entity.name,
      text: entity.description || `查看${entity.name}的详细信息`,
      url: `${window.location.origin}/knowledge?id=${entity.id}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.error('分享失败:', error);
      }
    } else {
      handleCopyLink();
    }
  }, [entity, handleCopyLink]);

  const handleSpeak = useCallback(() => {
    if (!entity?.description) return;

    const utterance = new SpeechSynthesisUtterance(`${entity.name}。${entity.description}`);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [entity]);

  if (detailPanelCollapsed || !selectedNode) {
    return null;
  }

  if (loading) {
    return (
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        className="w-96 backdrop-blur-xl h-full flex flex-col shadow-2xl"
        style={{
          background: 'var(--gradient-card)',
          borderLeft: '1px solid var(--color-border)',
        }}
      >
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 rounded-full"
            style={{
              borderColor: 'var(--color-primary)',
              borderTopColor: 'transparent',
            }}
          />
        </div>
      </motion.div>
    );
  }

  if (!entity) {
    return null;
  }

  const categoryGradient = getCategoryGradient(entity.type);

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-96 backdrop-blur-xl h-full flex flex-col shadow-2xl relative overflow-hidden"
      style={{
        background: 'var(--gradient-card)',
        borderLeft: '1px solid var(--color-border)',
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
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 500 }}
                className="flex items-center gap-2 mb-3 flex-wrap"
              >
                <span
                  className="px-4 py-1.5 rounded-full text-xs font-semibold shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${categoryGradient[0]}, ${categoryGradient[1]})`,
                    color: 'var(--color-text-inverse)',
                  }}
                >
                  {getCategoryLabel(entity.type)}
                </span>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full"
                  style={{ background: 'var(--color-warning)', opacity: 0.15 }}
                >
                  <Star
                    size={14}
                    fill="var(--color-warning)"
                    style={{ color: 'var(--color-warning)' }}
                  />
                  <span className="text-sm font-bold" style={{ color: 'var(--color-warning)' }}>
                    {(entity.importance * 100).toFixed(0)}%
                  </span>
                </motion.div>
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-2xl font-bold mb-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {entity.name}
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex gap-2 flex-wrap"
              >
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <Share2 size={12} />
                  分享
                </button>
                <button
                  onClick={handleBookmark}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={{
                    background: isBookmarked ? 'var(--color-warning)' : 'var(--color-surface)',
                    color: isBookmarked
                      ? 'var(--color-text-inverse)'
                      : 'var(--color-text-secondary)',
                    border: isBookmarked ? 'none' : '1px solid var(--color-border)',
                    opacity: isBookmarked ? 0.9 : 1,
                  }}
                >
                  <Bookmark size={12} fill={isBookmarked ? 'currentColor' : 'none'} />
                  {isBookmarked ? '已收藏' : '收藏'}
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? '已复制' : '链接'}
                </button>
                {entity.description && (
                  <button
                    onClick={handleSpeak}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all"
                    style={{
                      background: 'var(--color-surface)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <Volume2 size={12} />
                    朗读
                  </button>
                )}
              </motion.div>
            </div>
            <motion.button
              onClick={handleClose}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-lg transition-all"
              style={{ background: 'var(--color-surface)' }}
            >
              <X
                size={20}
                style={{ color: 'var(--color-text-muted)' }}
                className="transition-colors"
              />
            </motion.button>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-6">
        {entity.images && entity.images.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div
              className="relative rounded-xl overflow-hidden"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <img
                src={entity.images[activeImageIndex]}
                alt={entity.name}
                className="w-full h-48 object-cover"
              />
              {entity.images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                  {entity.images.map((_: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => setActiveImageIndex(index)}
                      className="w-2 h-2 rounded-full transition-all"
                      style={{
                        background:
                          index === activeImageIndex
                            ? 'var(--color-primary)'
                            : 'var(--color-text-muted)',
                        width: index === activeImageIndex ? 24 : 8,
                        opacity: index === activeImageIndex ? 1 : 0.5,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {entity.description && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <h3
              className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <div
                className="w-1 h-4 rounded-full"
                style={{ background: 'var(--color-primary)' }}
              />
              描述
            </h3>
            <p
              className="text-sm leading-relaxed rounded-xl p-4"
              style={{
                color: 'var(--color-text-muted)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              {entity.description}
            </p>
          </motion.div>
        )}

        {entity.tags && entity.tags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.27 }}
          >
            <h3
              className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Tag size={14} style={{ color: 'var(--color-info)' }} />
              标签
            </h3>
            <div className="flex flex-wrap gap-2">
              {entity.tags
                .slice(0, showAllTags ? undefined : 5)
                .map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="px-3 py-1 rounded-full text-xs cursor-pointer transition-all"
                    style={{
                      background: 'var(--color-surface)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              {entity.tags.length > 5 && !showAllTags && (
                <button
                  onClick={() => setShowAllTags(true)}
                  className="px-3 py-1 text-xs"
                  style={{ color: 'var(--color-info)' }}
                >
                  +{entity.tags.length - 5} 更多
                </button>
              )}
            </div>
          </motion.div>
        )}

        {entity.metadata && Object.keys(entity.metadata).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.37 }}
          >
            <h3
              className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <FileText size={14} style={{ color: 'var(--color-accent)' }} />
              属性
            </h3>
            <div className="space-y-2">
              {Object.entries(entity.metadata).map(([key, value]) => (
                <div
                  key={key}
                  className="flex justify-between items-center px-4 py-2 rounded-lg"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {key}
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {relationships.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3
              className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <div
                className="w-1 h-4 rounded-full"
                style={{ background: 'var(--color-success)' }}
              />
              关联关系
              <span
                className="px-2 py-0.5 rounded-full text-xs"
                style={{
                  background: 'var(--color-success)',
                  color: 'var(--color-text-inverse)',
                  opacity: 0.2,
                }}
              >
                {relationships.length}
              </span>
            </h3>
            <div className="space-y-2">
              {relationships.slice(0, 10).map((rel, index) => (
                <motion.div
                  key={rel.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + index * 0.05 }}
                  className="p-4 rounded-xl transition-all"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {rel.relation_type}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      权重: {rel.weight?.toFixed(2) || '1.00'}
                    </span>
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
            <h3
              className="text-sm font-semibold mb-3 flex items-center gap-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <div className="w-1 h-4 rounded-full" style={{ background: 'var(--color-accent)' }} />
              相关实体
            </h3>
            <div className="space-y-2">
              {relatedEntities.slice(0, 5).map((relatedEntity, index) => (
                <motion.button
                  key={relatedEntity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.55 + index * 0.05 }}
                  onClick={() => setSelectedNode(relatedEntity.id)}
                  className="w-full p-4 rounded-xl transition-all text-left"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: getCategoryColor(relatedEntity.type) }}
                    >
                      <span
                        className="text-xs font-bold"
                        style={{ color: 'var(--color-text-inverse)' }}
                      >
                        {relatedEntity.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {relatedEntity.name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {getCategoryLabel(relatedEntity.type)}
                      </p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
