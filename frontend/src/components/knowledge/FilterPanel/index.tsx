import { motion } from 'framer-motion';
import { Filter, ChevronLeft } from 'lucide-react';
import useKnowledgeGraphStore from '../../../stores/knowledgeGraphStore';

export default function FilterPanel() {
  const { toggleFilterPanel } = useKnowledgeGraphStore();

  return (
    <motion.div
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
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
                <Filter size={18} style={{ color: 'var(--color-text-inverse)' }} />
              </div>
              <div>
                <span>筛选条件</span>
                <p
                  className="text-xs font-normal mt-0.5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  精简模式
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

      <div className="relative z-10 flex-1 overflow-y-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: 'var(--gradient-primary)', opacity: 0.2 }}
          >
            <Filter size={32} style={{ color: 'var(--color-primary)' }} />
          </div>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            筛选功能已精简
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            地点和时间筛选已移除
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
