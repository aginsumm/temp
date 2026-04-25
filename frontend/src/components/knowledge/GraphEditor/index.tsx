import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Edit3,
  Trash2,
  Link2,
  X,
  Save,
  AlertTriangle,
  ChevronDown,
  Search,
  Loader2,
} from 'lucide-react';
import { knowledgeApi, Entity } from '../../../api/knowledge';
import { useToast } from '../../common/Toast';
import {
  CATEGORY_CONFIG,
  RELATION_TYPES,
  getCategoryColor,
  getCategoryLabel,
} from '../../../constants/categories';

interface GraphEditorProps {
  selectedNode: string | null;
  onNodeUpdate: () => void;
  onNodeCreate: (entity: Entity) => void;
  onNodeDelete: (entityId: string) => void;
  onRelationshipCreate: (sourceId: string, targetId: string, type: string) => void;
}

interface EntityFormData {
  name: string;
  type: string;
  description: string;
  region: string;
  period: string;
  importance: number;
}

const initialFormData: EntityFormData = {
  name: '',
  type: 'technique',
  description: '',
  region: '',
  period: '',
  importance: 0.5,
};

export default function GraphEditor({
  selectedNode,
  onNodeUpdate,
  onNodeCreate,
  onNodeDelete,
  onRelationshipCreate,
}: GraphEditorProps) {
  const [mode, setMode] = useState<'view' | 'create' | 'edit' | 'delete' | 'link'>('view');
  const [formData, setFormData] = useState<EntityFormData>(initialFormData);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [linkTarget, setLinkTarget] = useState<string>('');
  const [linkType, setLinkType] = useState<string>('相关');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Entity[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const toast = useToast();

  const loadEntity = useCallback(
    async (entityId: string) => {
      setLoading(true);
      try {
        const data = await knowledgeApi.getEntity(entityId);
        setEntity(data);
        setFormData({
          name: data.name,
          type: data.type,
          description: data.description || '',
          region: data.region || '',
          period: data.period || '',
          importance: data.importance || 0.5,
        });
      } catch (error) {
        console.error('Failed to load entity:', error);
        toast.error('加载失败', '无法加载实体信息');
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (selectedNode) {
      loadEntity(selectedNode);
      setMode('view');
    }
  }, [selectedNode, loadEntity]);

  const handleCreateNew = () => {
    setMode('create');
    setEntity(null);
    setFormData(initialFormData);
  };

  const handleEdit = () => {
    if (entity) {
      setMode('edit');
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleLink = () => {
    setShowLinkModal(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('验证失败', '请输入实体名称');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'create') {
        const newEntity = await knowledgeApi.createEntity(formData);
        onNodeCreate(newEntity);
        toast.success('创建成功', `实体 "${formData.name}" 已创建`);
        setMode('view');
        setEntity(newEntity);
      } else if (mode === 'edit' && entity) {
        const updatedEntity = await knowledgeApi.updateEntity(entity.id, formData);
        setEntity(updatedEntity);
        onNodeUpdate();
        toast.success('更新成功', `实体 "${formData.name}" 已更新`);
        setMode('view');
      }
    } catch (error) {
      console.error('Failed to save entity:', error);
      toast.error('保存失败', '无法保存实体信息');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!entity) return;

    setLoading(true);
    try {
      await knowledgeApi.deleteEntity(entity.id);
      onNodeDelete(entity.id);
      toast.success('删除成功', `实体 "${entity.name}" 已删除`);
      setShowDeleteConfirm(false);
      setEntity(null);
      setMode('view');
    } catch (error) {
      console.error('Failed to delete entity:', error);
      toast.error('删除失败', '无法删除实体');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchEntities = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        const response = await knowledgeApi.search({ keyword: query, page_size: 10 });
        setSearchResults(response.results.filter((e: Entity) => e.id !== entity?.id));
      } catch (error) {
        console.error('Search failed:', error);
      }
    },
    [entity?.id]
  );

  const handleCreateRelationship = async () => {
    if (!entity || !linkTarget || !linkType) {
      toast.error('验证失败', '请选择目标实体和关系类型');
      return;
    }

    setLoading(true);
    try {
      await knowledgeApi.createRelationship({
        source_id: entity.id,
        target_id: linkTarget,
        relation_type: linkType,
        weight: 1.0,
      });
      onRelationshipCreate(entity.id, linkTarget, linkType);
      toast.success('创建成功', '关系已创建');
      setShowLinkModal(false);
      setLinkTarget('');
      setLinkType('相关');
      
      // 触发图谱刷新：通过 graphSyncService 同步关系变化
      // 重新加载当前实体的关系数据
      loadEntity(entity.id);
    } catch (error) {
      console.error('Failed to create relationship:', error);
      toast.error('创建失败', '无法创建关系');
    } finally {
      setLoading(false);
    }
  };

  const getTypeColorVar = (type: string) => {
    return getCategoryColor(type);
  };

  const getTypeLabel = (type: string) => {
    return getCategoryLabel(type);
  };

  return (
    <div
      className="h-full flex flex-col backdrop-blur-sm rounded-lg"
      style={{
        background: 'var(--gradient-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div
        className="flex items-center justify-between p-4"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {mode === 'create' ? '创建实体' : mode === 'edit' ? '编辑实体' : '图谱编辑器'}
        </h3>
        <div className="flex items-center gap-2">
          {mode === 'view' && entity && (
            <>
              <button
                onClick={handleCreateNew}
                className="p-2 rounded-lg transition-colors"
                style={{
                  background: 'var(--color-success)',
                  color: 'var(--color-text-inverse)',
                }}
                title="创建新实体"
              >
                <Plus size={18} />
              </button>
              <button
                onClick={handleEdit}
                className="p-2 rounded-lg transition-colors"
                style={{
                  background: 'var(--color-info)',
                  color: 'var(--color-text-inverse)',
                }}
                title="编辑"
              >
                <Edit3 size={18} />
              </button>
              <button
                onClick={handleLink}
                className="p-2 rounded-lg transition-colors"
                style={{
                  background: 'var(--color-primary)',
                  color: 'var(--color-text-inverse)',
                }}
                title="创建关系"
              >
                <Link2 size={18} />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg transition-colors"
                style={{
                  background: 'var(--color-error)',
                  color: 'var(--color-text-inverse)',
                }}
                title="删除"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
          {(mode === 'create' || mode === 'edit') && (
            <>
              <button
                onClick={handleSave}
                disabled={loading}
                className="p-2 rounded-lg transition-colors disabled:opacity-50"
                style={{
                  background: 'var(--color-success)',
                  color: 'var(--color-text-inverse)',
                }}
                title="保存"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              </button>
              <button
                onClick={() => {
                  setMode('view');
                  if (entity) {
                    loadEntity(entity.id);
                  }
                }}
                className="p-2 rounded-lg transition-colors"
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                }}
                title="取消"
              >
                <X size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && mode === 'view' ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        ) : mode === 'view' && entity ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: getTypeColorVar(entity.type) }}
              />
              <span className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {entity.name}
              </span>
              <span
                className="px-2 py-1 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${getTypeColorVar(entity.type)}20`,
                  color: getTypeColorVar(entity.type),
                }}
              >
                {getTypeLabel(entity.type)}
              </span>
            </div>

            {entity.description && (
              <div>
                <label className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  描述
                </label>
                <p className="mt-1" style={{ color: 'var(--color-text-primary)' }}>
                  {entity.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {entity.region && (
                <div>
                  <label className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    地区
                  </label>
                  <p className="mt-1" style={{ color: 'var(--color-text-primary)' }}>
                    {entity.region}
                  </p>
                </div>
              )}
              {entity.period && (
                <div>
                  <label className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    时期
                  </label>
                  <p className="mt-1" style={{ color: 'var(--color-text-primary)' }}>
                    {entity.period}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                重要性
              </label>
              <div className="mt-2 flex items-center gap-2">
                <div
                  className="flex-1 h-2 rounded-full overflow-hidden"
                  style={{ background: 'var(--color-surface)' }}
                >
                  <div
                    className="h-full"
                    style={{
                      background: 'var(--gradient-primary)',
                      width: `${(entity.importance || 0) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {((entity.importance || 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        ) : mode === 'view' && !entity ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Plus
              size={48}
              className="mb-4 opacity-50"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <p className="text-lg mb-2" style={{ color: 'var(--color-text-muted)' }}>
              选择一个节点查看详情
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
              或创建新实体
            </p>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 rounded-lg transition-colors"
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-text-inverse)',
              }}
            >
              创建实体
            </button>
          </div>
        ) : mode === 'create' || mode === 'edit' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
                名称 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                placeholder="输入实体名称"
              />
            </div>

            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
                类型
              </label>
              <div className="relative">
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none appearance-none"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {CATEGORY_CONFIG.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--color-text-muted)' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
                描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:outline-none resize-none"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                rows={3}
                placeholder="输入实体描述"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  地区
                </label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  placeholder="如：武汉"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  时期
                </label>
                <input
                  type="text"
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  placeholder="如：明清"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
                重要性: {(formData.importance * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={formData.importance}
                onChange={(e) =>
                  setFormData({ ...formData, importance: parseFloat(e.target.value) })
                }
                className="w-full"
                style={{ accentColor: 'var(--color-primary)' }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ background: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-lg p-6 max-w-md mx-4"
              style={{
                background: 'var(--gradient-card)',
                border: '1px solid var(--color-border)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle style={{ color: 'var(--color-error)' }} size={24} />
                <h4
                  className="text-lg font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  确认删除
                </h4>
              </div>
              <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                确定要删除实体 &quot;{entity?.name}&quot;
                吗？此操作不可撤销，相关的所有关系也将被删除。
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{
                    background: 'var(--color-error)',
                    color: 'var(--color-text-inverse)',
                  }}
                >
                  {loading ? '删除中...' : '确认删除'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showLinkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ background: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setShowLinkModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-lg p-6 max-w-md w-full mx-4"
              style={{
                background: 'var(--gradient-card)',
                border: '1px solid var(--color-border)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h4
                className="text-lg font-semibold mb-4"
                style={{ color: 'var(--color-text-primary)' }}
              >
                创建关系
              </h4>

              <div className="mb-4">
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  源实体
                </label>
                <div
                  className="px-3 py-2 rounded-lg"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {entity?.name}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  关系类型
                </label>
                <select
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {RELATION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  目标实体
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--color-text-muted)' }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleSearchEntities(e.target.value);
                    }}
                    className="w-full pl-10 pr-3 py-2 rounded-lg focus:outline-none"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-primary)',
                    }}
                    placeholder="搜索目标实体..."
                  />
                </div>
                {searchResults.length > 0 && (
                  <div
                    className="mt-2 max-h-40 overflow-y-auto rounded-lg"
                    style={{ background: 'var(--color-surface)' }}
                  >
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => {
                          setLinkTarget(result.id);
                          setSearchResults([]);
                          setSearchQuery(result.name);
                        }}
                        className="w-full px-3 py-2 text-left transition-colors"
                        style={{
                          color: 'var(--color-text-primary)',
                          borderBottom: '1px solid var(--color-border)',
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getTypeColorVar(result.type) }}
                          />
                          {result.name}
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {getTypeLabel(result.type)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleCreateRelationship}
                  disabled={loading || !linkTarget}
                  className="px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{
                    background: 'var(--gradient-primary)',
                    color: 'var(--color-text-inverse)',
                  }}
                >
                  {loading ? '创建中...' : '创建关系'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
