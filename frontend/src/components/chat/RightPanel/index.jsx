import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Tag,
  MessageSquarePlus,
  User,
  Palette,
  Image,
  MapPin,
  Clock,
  Package,
  Sparkles,
  ExternalLink,
  GripVertical,
} from 'lucide-react';
import { useUIStore, MIN_RIGHT_PANEL_WIDTH, MAX_RIGHT_PANEL_WIDTH } from '../../../stores/uiStore';
import { useResizablePanel } from '../../../hooks/useResizablePanel';

const entityTypeConfig = {
  inheritor: { label: '传承人', icon: User, color: 'bg-purple-500' },
  technique: { label: '技艺', icon: Palette, color: 'bg-green-500' },
  work: { label: '作品', icon: Image, color: 'bg-amber-500' },
  pattern: { label: '纹样', icon: Sparkles, color: 'bg-red-500' },
  region: { label: '地域', icon: MapPin, color: 'bg-cyan-500' },
  period: { label: '时期', icon: Clock, color: 'bg-indigo-500' },
  material: { label: '材料', icon: Package, color: 'bg-lime-500' },
};

export default function RightPanel({
  entities = [],
  keywords = [],
  recommendedQuestions = [],
  onQuestionClick,
  onEntityClick,
}) {
  const { rightPanelCollapsed, toggleRightPanel, rightPanelWidth, setRightPanelWidth } =
    useUIStore();
  const [activeSection, setActiveSection] = useState('entities');

  const { isResizing, handleMouseDown } = useResizablePanel({
    initialWidth: rightPanelWidth,
    minWidth: MIN_RIGHT_PANEL_WIDTH,
    maxWidth: MAX_RIGHT_PANEL_WIDTH,
    collapsed: rightPanelCollapsed,
    onWidthChange: setRightPanelWidth,
    direction: 'right',
  });

  const displayEntities = entities && entities.length > 0 ? entities : [];
  const displayKeywords = keywords && keywords.length > 0 ? keywords : [];
  const displayQuestions =
    recommendedQuestions && recommendedQuestions.length > 0 ? recommendedQuestions : [];

  const buttonRight = rightPanelCollapsed ? 16 : rightPanelWidth + 20;

  return (
    <>
      <motion.button
        onClick={toggleRightPanel}
        className="fixed top-20 z-50 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
        style={{ right: buttonRight }}
        title={rightPanelCollapsed ? '展开信息栏' : '收起信息栏'}
      >
        {rightPanelCollapsed ? (
          <ChevronLeft size={16} className="text-gray-500" />
        ) : (
          <ChevronRight size={16} className="text-gray-500" />
        )}
      </motion.button>

      <motion.aside
        initial={false}
        animate={{
          width: rightPanelCollapsed ? 0 : rightPanelWidth,
          opacity: rightPanelCollapsed ? 0 : 1,
        }}
        transition={isResizing ? { duration: 0 } : { duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="h-[calc(100vh-64px)] bg-white/80 backdrop-blur-sm border-l border-gray-200/50 flex flex-col overflow-hidden relative"
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-200/50">
            <h2 className="text-lg font-semibold text-gray-900">信息面板</h2>
          </div>

          <div className="flex border-b border-gray-200/50">
            {[
              { id: 'entities', label: '实体', icon: User },
              { id: 'keywords', label: '关键词', icon: Tag },
              { id: 'questions', label: '追问', icon: MessageSquarePlus },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors relative ${
                  activeSection === tab.id ? 'text-amber-700' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
                {activeSection === tab.id && (
                  <motion.div
                    layoutId="activePanelTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-700 to-amber-600"
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              {activeSection === 'entities' && (
                <motion.div
                  key="entities"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {displayEntities.length > 0 ? (
                    displayEntities.map((entity, index) => {
                      const config = entityTypeConfig[entity.type] || entityTypeConfig.technique;
                      const Icon = config.icon;
                      return (
                        <motion.div
                          key={entity.id || index}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          onClick={() => onEntityClick?.(entity)}
                          className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center text-white flex-shrink-0`}
                            >
                              <Icon size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                  {entity.name}
                                </h4>
                                <span
                                  className={`px-1.5 py-0.5 text-xs rounded ${config.color} text-white whitespace-nowrap`}
                                >
                                  {config.label}
                                </span>
                              </div>
                              {entity.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                  {entity.description}
                                </p>
                              )}
                            </div>
                            <ExternalLink
                              size={14}
                              className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            />
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8">
                      <User size={40} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">暂无实体信息</p>
                      <p className="text-xs text-gray-300 mt-1">发送消息后将显示相关实体</p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeSection === 'keywords' && (
                <motion.div
                  key="keywords"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-wrap gap-2"
                >
                  {displayKeywords.length > 0 ? (
                    displayKeywords.map((keyword, index) => (
                      <motion.button
                        key={keyword}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => onQuestionClick?.(`${keyword}是什么？`)}
                        className="px-4 py-2 bg-gray-100/80 border border-gray-200/80 rounded-2xl text-gray-500 text-sm transition-all duration-200 hover:bg-amber-100 hover:text-amber-700 whitespace-nowrap"
                      >
                        <Tag size={12} className="mr-1 inline" />
                        {keyword}
                      </motion.button>
                    ))
                  ) : (
                    <div className="w-full text-center py-8">
                      <Tag size={40} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">暂无关键词</p>
                      <p className="text-xs text-gray-300 mt-1">发送消息后将显示关键词</p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeSection === 'questions' && (
                <motion.div
                  key="questions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2"
                >
                  {displayQuestions.length > 0 ? (
                    displayQuestions.map((item, index) => (
                      <motion.button
                        key={item.id || index}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => onQuestionClick?.(item.question)}
                        className="w-full p-3 bg-gray-50 rounded-lg text-left hover:bg-amber-50 hover:text-amber-700 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquarePlus
                            size={16}
                            className="text-gray-400 group-hover:text-amber-500 transition-colors flex-shrink-0"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-amber-700 line-clamp-2">
                            {item.question}
                          </span>
                        </div>
                      </motion.button>
                    ))
                  ) : (
                    <div className="w-full text-center py-8">
                      <MessageSquarePlus size={40} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">暂无推荐问题</p>
                      <p className="text-xs text-gray-300 mt-1">开始对话后将显示推荐问题</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {!rightPanelCollapsed && (
          <div
            onMouseDown={handleMouseDown}
            className={`absolute top-0 left-0 w-1 h-full cursor-col-resize group ${
              isResizing ? 'bg-amber-500' : 'hover:bg-amber-300'
            }`}
          >
            <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={14} className="text-gray-400" />
            </div>
          </div>
        )}
      </motion.aside>
    </>
  );
}
