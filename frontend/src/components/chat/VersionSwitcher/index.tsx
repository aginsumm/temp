import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  GitBranch,
  Sparkles,
  Eye,
  RotateCcw,
  X,
} from 'lucide-react';
import { useToast } from '../../common/Toast';

interface MessageVersion {
  id: string;
  content: string;
  created_at: string;
  is_current: boolean;
}

interface VersionSwitcherProps {
  versions: MessageVersion[];
  currentIndex: number;
  isEdited?: boolean;
  onSwitch: (versionId: string, index: number) => void;
  isUser?: boolean;
}

const formatTimeAgo = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

export default function VersionSwitcher({
  versions,
  currentIndex,
  isEdited,
  onSwitch,
  isUser = false,
}: VersionSwitcherProps) {
  const [direction, setDirection] = useState(0);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<MessageVersion | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const hasVersions = versions.length > 1;
  const currentVersion = versions[currentIndex];

  useEffect(() => {
    setDirection(0);
  }, [currentIndex]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      onSwitch(versions[currentIndex - 1].id, currentIndex - 1);
    }
  }, [currentIndex, versions, onSwitch]);

  const handleNext = useCallback(() => {
    if (currentIndex < versions.length - 1) {
      setDirection(1);
      onSwitch(versions[currentIndex + 1].id, currentIndex + 1);
    }
  }, [currentIndex, versions, onSwitch]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (showRestoreConfirm || viewingVersion) return;

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight' && currentIndex < versions.length - 1) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Escape') {
        setShowAllVersions(false);
      }
    },
    [currentIndex, versions.length, showRestoreConfirm, viewingVersion, handlePrev, handleNext]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!hasVersions && !isEdited) return null;

  const handleRestoreLatest = () => {
    setShowRestoreConfirm(true);
  };

  const confirmRestore = () => {
    const lastIndex = versions.length - 1;
    if (currentIndex !== lastIndex) {
      setDirection(1);
      onSwitch(versions[lastIndex].id, lastIndex);
      toast.success('已恢复', '已恢复到最新版本');
    }
    setShowRestoreConfirm(false);
  };

  const switchToVersion = (versionId: string, index: number) => {
    setDirection(index > currentIndex ? 1 : -1);
    onSwitch(versionId, index);
  };

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 20 : -20,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 20 : -20,
      opacity: 0,
      scale: 0.95,
    }),
  };

  if (isEdited && !hasVersions) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-2 mt-2 ${isUser ? 'justify-end' : ''}`}
      >
        <span
          className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5"
          style={{
            background:
              'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
            color: 'var(--color-primary)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <Edit3 size={11} />
          已编辑
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`mt-3 ${isUser ? 'flex flex-col items-end' : ''}`}
      role="group"
      aria-label="版本切换器"
    >
      <div
        ref={containerRef}
        className="inline-flex items-center gap-1.5 p-1.5 rounded-xl"
        style={{
          background: 'var(--color-background-secondary)',
          border: '1px solid var(--color-border-light)',
          boxShadow: '0 2px 8px -4px rgba(0, 0, 0, 0.05)',
        }}
        role="toolbar"
        aria-label="版本导航工具栏"
      >
        <motion.button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          whileHover={{ scale: currentIndex === 0 ? 1 : 1.05 }}
          whileTap={{ scale: currentIndex === 0 ? 1 : 0.95 }}
          className="px-2 py-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
          style={{
            color: currentIndex === 0 ? 'var(--color-text-muted)' : 'var(--color-primary)',
            background: currentIndex === 0 ? 'transparent' : 'var(--color-primary-alpha)',
          }}
          aria-label="上一版本"
          aria-disabled={currentIndex === 0}
        >
          <ChevronLeft size={14} />
          <span className="text-xs font-medium hidden sm:inline">上一版本</span>
        </motion.button>

        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--color-surface)' }}
          role="status"
          aria-live="polite"
          aria-label={`当前版本 ${currentIndex + 1}，共 ${versions.length} 个版本`}
        >
          <GitBranch size={14} style={{ color: 'var(--color-text-muted)' }} />
          <AnimatePresence mode="wait" custom={direction}>
            <motion.span
              key={currentIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="text-sm font-semibold min-w-[60px] text-center"
              style={{ color: 'var(--color-text-primary)' }}
            >
              V{currentIndex + 1}
            </motion.span>
          </AnimatePresence>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            / {versions.length}
          </span>
        </div>

        <motion.button
          onClick={handleNext}
          disabled={currentIndex === versions.length - 1}
          whileHover={{ scale: currentIndex === versions.length - 1 ? 1 : 1.05 }}
          whileTap={{ scale: currentIndex === versions.length - 1 ? 1 : 0.95 }}
          className="px-2 py-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
          style={{
            color:
              currentIndex === versions.length - 1
                ? 'var(--color-text-muted)'
                : 'var(--color-primary)',
            background:
              currentIndex === versions.length - 1 ? 'transparent' : 'var(--color-primary-alpha)',
          }}
          aria-label="下一版本"
          aria-disabled={currentIndex === versions.length - 1}
        >
          <span className="text-xs font-medium hidden sm:inline">下一版本</span>
          <ChevronRight size={14} />
        </motion.button>
      </div>

      <div className={`flex items-center gap-3 mt-2 flex-wrap ${isUser ? 'justify-end' : ''}`}>
        {versions.length <= 10 ? (
          <div className="flex items-center gap-1.5" role="tablist" aria-label="版本列表">
            {versions.map((version, index) => (
              <motion.button
                key={version.id}
                onClick={() => switchToVersion(version.id, index)}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                className="group relative"
                role="tab"
                aria-selected={index === currentIndex}
                aria-label={`版本 ${index + 1} - ${formatTimeAgo(version.created_at)}`}
                title={`版本 ${index + 1} - ${formatTimeAgo(version.created_at)}`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full transition-all"
                  style={{
                    background:
                      index === currentIndex ? 'var(--color-primary)' : 'var(--color-border)',
                    boxShadow: index === currentIndex ? '0 0 8px var(--color-primary)' : 'none',
                  }}
                />
                {index === currentIndex && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'var(--color-primary)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <div
                  className="absolute -top-16 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  <div className="text-xs font-medium mb-1">版本 {index + 1}</div>
                  <div className="text-[10px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    {formatTimeAgo(version.created_at)}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingVersion(version);
                    }}
                    className="w-full flex items-center justify-center gap-1 text-xs px-2 py-1 rounded transition-colors"
                    style={{
                      background: 'var(--color-primary-alpha)',
                      color: 'var(--color-primary)',
                    }}
                  >
                    <Eye size={12} />
                    <span>查看</span>
                  </button>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--color-background-secondary)' }}
          >
            <GitBranch size={14} style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
              版本 {currentIndex + 1} / {versions.length}
            </span>
          </div>
        )}

        {versions.length > 2 && (
          <motion.button
            onClick={() => setShowAllVersions(!showAllVersions)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors"
            style={{
              background: 'var(--color-background-secondary)',
              color: 'var(--color-text-muted)',
            }}
            aria-expanded={showAllVersions}
            aria-controls="version-history-panel"
          >
            <Eye size={12} />
            <span>{showAllVersions ? '收起' : versions.length} 个版本</span>
          </motion.button>
        )}

        <div
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
          style={{
            background: 'var(--color-background-secondary)',
            color: 'var(--color-text-muted)',
          }}
        >
          <Clock size={12} />
          <span>{formatTimeAgo(currentVersion.created_at)}</span>
        </div>

        {isEdited && (
          <span
            className="text-xs px-2 py-1 rounded-lg flex items-center gap-1.5"
            style={{
              background:
                'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              color: 'var(--color-primary)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            <Edit3 size={12} />
            已编辑
          </span>
        )}

        {currentIndex !== versions.length - 1 && versions.length > 1 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleRestoreLatest}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors"
            style={{
              background: 'var(--color-success-alpha)',
              color: 'var(--color-success)',
              border: '1px solid var(--color-success)',
            }}
          >
            <RotateCcw size={12} />
            <span>恢复最新</span>
          </motion.button>
        )}

        {currentIndex === versions.length - 1 && versions.length > 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
            style={{
              background: 'var(--color-success-alpha)',
              color: 'var(--color-success)',
            }}
          >
            <Sparkles size={12} />
            <span>最新版本</span>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showAllVersions && versions.length > 2 && (
          <motion.div
            id="version-history-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3 rounded-xl"
            style={{
              background: 'var(--color-background-secondary)',
              border: '1px solid var(--color-border)',
              maxHeight: '400px',
              overflowY: 'auto',
            }}
            role="listbox"
            aria-label="版本历史列表"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                版本历史 ({versions.length}个)
              </span>
              <button
                onClick={() => setShowAllVersions(false)}
                className="text-xs flex items-center gap-1"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <X size={12} />
                收起
              </button>
            </div>
            <div className="space-y-1.5">
              {versions.map((version, index) => (
                <motion.button
                  key={version.id}
                  onClick={() => {
                    switchToVersion(version.id, index);
                    setShowAllVersions(false);
                  }}
                  whileHover={{ scale: 1.01 }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${
                    index === currentIndex ? 'ring-2 ring-primary' : ''
                  }`}
                  style={{
                    background:
                      index === currentIndex
                        ? 'var(--color-primary-alpha)'
                        : 'var(--color-surface)',
                    border:
                      index === currentIndex
                        ? '1px solid var(--color-primary)'
                        : '1px solid var(--color-border)',
                  }}
                  role="option"
                  aria-selected={index === currentIndex}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        index === currentIndex ? 'bg-primary' : 'bg-border'
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        index === currentIndex ? 'text-primary' : 'text-text-primary'
                      }`}
                    >
                      版本 {index + 1}
                    </span>
                    {index === versions.length - 1 && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{
                          background: 'var(--color-success-alpha)',
                          color: 'var(--color-success)',
                        }}
                      >
                        最新
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {formatTimeAgo(version.created_at)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingVersion(version);
                      }}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
                      style={{
                        background: 'var(--color-primary-alpha)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      <Eye size={12} />
                      <span>查看</span>
                    </button>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRestoreConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowRestoreConfirm(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-confirm-title"
            aria-describedby="restore-confirm-desc"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-auto shadow-xl"
            >
              <h3
                id="restore-confirm-title"
                className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
              >
                确认恢复
              </h3>
              <p id="restore-confirm-desc" className="text-gray-600 dark:text-gray-400 mb-6">
                确定要恢复到最新版本吗？当前版本将被保存为历史版本。
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowRestoreConfirm(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmRestore}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  恢复
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingVersion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setViewingVersion(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="version-detail-title"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <h3
                    id="version-detail-title"
                    className="text-lg font-semibold text-gray-900 dark:text-white"
                  >
                    版本详情
                  </h3>
                  <span className="text-sm px-2 py-1 rounded bg-primary-alpha text-primary">
                    版本 {versions.findIndex((v) => v.id === viewingVersion.id) + 1}
                  </span>
                  {viewingVersion.is_current && (
                    <span className="text-xs px-2 py-1 rounded-full bg-success-alpha text-success">
                      当前版本
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setViewingVersion(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label="关闭版本详情"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {new Date(viewingVersion.created_at).toLocaleString('zh-CN')}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitBranch size={14} />
                    {formatTimeAgo(viewingVersion.created_at)}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <div className="prose dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-gray-900 dark:text-gray-100 leading-relaxed">
                    {viewingVersion.content}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setViewingVersion(null)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  关闭
                </button>
                {!viewingVersion.is_current && (
                  <button
                    onClick={() => {
                      const index = versions.findIndex((v) => v.id === viewingVersion.id);
                      if (index !== -1) {
                        switchToVersion(viewingVersion.id, index);
                        toast.success('已恢复', '已恢复到此版本');
                      }
                      setViewingVersion(null);
                    }}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                  >
                    <RotateCcw size={16} />
                    <span>恢复此版本</span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
