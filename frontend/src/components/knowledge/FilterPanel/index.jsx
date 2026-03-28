import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { knowledgeApi } from '../../../api/knowledge';
import useKnowledgeGraphStore from '../../../stores/knowledgeGraphStore';

export default function FilterPanel() {
  const [regions, setRegions] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    region: true,
    period: true,
  });

  const {
    region: selectedRegions,
    period: selectedPeriods,
    setRegion,
    setPeriod,
    filterPanelCollapsed,
    toggleFilterPanel,
  } = useKnowledgeGraphStore();

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    try {
      const [regionsData, periodsData] = await Promise.all([
        knowledgeApi.getRegions(),
        knowledgeApi.getPeriods(),
      ]);
      setRegions(regionsData);
      setPeriods(periodsData);
    } catch (error) {
      console.error('加载筛选选项失败:', error);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleRegionToggle = (region) => {
    const newRegions = selectedRegions.includes(region)
      ? selectedRegions.filter((r) => r !== region)
      : [...selectedRegions, region];
    setRegion(newRegions);
  };

  const handlePeriodToggle = (period) => {
    const newPeriods = selectedPeriods.includes(period)
      ? selectedPeriods.filter((p) => p !== period)
      : [...selectedPeriods, period];
    setPeriod(newPeriods);
  };

  if (filterPanelCollapsed) {
    return (
      <motion.button
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -100, opacity: 0 }}
        onClick={toggleFilterPanel}
        className="fixed left-0 top-1/2 -translate-y-1/2 w-12 h-24 bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-xl border-r border-t border-b border-slate-700/50 rounded-r-2xl shadow-2xl flex items-center justify-center hover:w-16 transition-all group"
      >
        <ChevronRight
          size={24}
          className="text-blue-400 group-hover:text-blue-300 transition-colors"
        />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-80 bg-gradient-to-b from-slate-800/90 to-slate-900/90 backdrop-blur-xl border-r border-slate-700/50 h-full flex flex-col relative overflow-hidden"
    >
      {/* 装饰性背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-purple-500/5 to-cyan-500/5 pointer-events-none" />

      <div className="relative z-10">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                <Filter size={16} className="text-white" />
              </div>
              筛选条件
            </h2>
            <motion.button
              onClick={toggleFilterPanel}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-all"
            >
              <ChevronLeft size={20} className="text-gray-400 hover:text-white transition-colors" />
            </motion.button>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <motion.button
            onClick={() => toggleSection('region')}
            whileHover={{ x: 4 }}
            className="w-full flex items-center justify-between text-sm font-medium text-gray-300 mb-3 group"
          >
            <span className="flex items-center gap-2">
              <div className="w-1 h-4 bg-blue-500 rounded-full" />
              地域
            </span>
            <motion.div
              animate={{ rotate: expandedSections.region ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown
                size={16}
                className="text-gray-500 group-hover:text-gray-300 transition-colors"
              />
            </motion.div>
          </motion.button>
          <AnimatePresence>
            {expandedSections.region && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                {regions.map((region, index) => (
                  <motion.label
                    key={region}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={selectedRegions.includes(region)}
                        onChange={() => handleRegionToggle(region)}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded-md border-2 transition-all ${
                          selectedRegions.includes(region)
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500 border-blue-500'
                            : 'border-slate-600 group-hover:border-slate-500'
                        }`}
                      >
                        {selectedRegions.includes(region) && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-full h-full flex items-center justify-center"
                          >
                            <svg
                              className="w-3 h-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 12 12"
                            >
                              <path d="M10.28 2.28L4 8.56 1.72 6.28a.75.75 0 00-1.06 1.06l3 3a.75.75 0 001.06 0l7-7a.75.75 0 00-1.06-1.06z" />
                            </svg>
                          </motion.div>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors">
                      {region}
                    </span>
                  </motion.label>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          <motion.button
            onClick={() => toggleSection('period')}
            whileHover={{ x: 4 }}
            className="w-full flex items-center justify-between text-sm font-medium text-gray-300 mb-3 group"
          >
            <span className="flex items-center gap-2">
              <div className="w-1 h-4 bg-purple-500 rounded-full" />
              时期
            </span>
            <motion.div
              animate={{ rotate: expandedSections.period ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown
                size={16}
                className="text-gray-500 group-hover:text-gray-300 transition-colors"
              />
            </motion.div>
          </motion.button>
          <AnimatePresence>
            {expandedSections.period && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                {periods.map((period, index) => (
                  <motion.label
                    key={period}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={selectedPeriods.includes(period)}
                        onChange={() => handlePeriodToggle(period)}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded-md border-2 transition-all ${
                          selectedPeriods.includes(period)
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-purple-500'
                            : 'border-slate-600 group-hover:border-slate-500'
                        }`}
                      >
                        {selectedPeriods.includes(period) && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-full h-full flex items-center justify-center"
                          >
                            <svg
                              className="w-3 h-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 12 12"
                            >
                              <path d="M10.28 2.28L4 8.56 1.72 6.28a.75.75 0 00-1.06 1.06l3 3a.75.75 0 001.06 0l7-7a.75.75 0 00-1.06-1.06z" />
                            </svg>
                          </motion.div>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors">
                      {period}
                    </span>
                  </motion.label>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="relative z-10 p-6 border-t border-slate-700/50">
        <motion.button
          onClick={() => {
            setRegion([]);
            setPeriod([]);
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 px-4 bg-gradient-to-r from-slate-700/50 to-slate-600/50 hover:from-slate-700 hover:to-slate-600 text-gray-300 rounded-xl transition-all text-sm font-medium border border-slate-600/50"
        >
          清除筛选
        </motion.button>
      </div>
    </motion.div>
  );
}
