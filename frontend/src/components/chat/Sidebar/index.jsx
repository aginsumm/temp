import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Plus,
  Star,
  Zap,
  ChevronLeft,
  ChevronRight,
  Search,
  MoreVertical,
  Pin,
  Trash2,
  Edit2,
  FolderOpen,
  GripVertical,
} from 'lucide-react';
import { useChatStore } from '../../../stores/chatStore';
import { useUIStore, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from '../../../stores/uiStore';
import { useResizablePanel } from '../../../hooks/useResizablePanel';

const mockFavoriteQuestions = [
  { id: '1', question: '武汉木雕有哪些代表性技法？', category: '技艺相关' },
  { id: '2', question: '汉绣的基本针法有哪些？', category: '技艺相关' },
  { id: '3', question: '黄鹤楼的历史传说有哪些？', category: '历史文化' },
  { id: '4', question: '楚文化的核心特征是什么？', category: '历史文化' },
];

const quickActions = [
  { id: 'clear', label: '清空对话', icon: Trash2 },
  { id: 'export', label: '导出对话', icon: MessageSquare },
  { id: 'search', label: '搜索历史', icon: Search },
  { id: 'settings', label: '设置', icon: Zap },
];

export default function Sidebar({ 
  onNewChat, 
  onSwitchSession, 
  onDeleteSession,
  onPinSession 
}) {
  const { 
    sidebarCollapsed, 
    toggleSidebar, 
    sidebarWidth, 
    setSidebarWidth 
  } = useUIStore();
  const { sessions, currentSessionId, pinSession } = useChatStore();
  const [activeTab, setActiveTab] = useState('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

  const { isResizing, handleMouseDown } = useResizablePanel({
    initialWidth: sidebarWidth,
    minWidth: MIN_SIDEBAR_WIDTH,
    maxWidth: MAX_SIDEBAR_WIDTH,
    collapsed: sidebarCollapsed,
    onWidthChange: setSidebarWidth,
    direction: 'left',
  });

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedSessions = filteredSessions.filter((s) => s.isPinned);
  const regularSessions = filteredSessions.filter((s) => !s.isPinned);

  const handleNewSession = () => {
    onNewChat?.();
  };

  const handleSwitchSession = (sessionId) => {
    onSwitchSession?.(sessionId);
  };

  const handleDeleteSession = (sessionId) => {
    onDeleteSession?.(sessionId);
    setContextMenu(null);
  };

  const handlePinSession = (sessionId) => {
    pinSession(sessionId);
    onPinSession?.(sessionId);
    setContextMenu(null);
  };

  const handleContextMenu = (e, sessionId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ id: sessionId, x: e.clientX, y: e.clientY });
  };

  const formatTime = (date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const SessionItem = ({ session }) => (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 group ${
        currentSessionId === session.id 
          ? 'bg-amber-100 border-l-[3px] border-amber-500' 
          : 'hover:bg-gray-100'
      }`}
      onClick={() => handleSwitchSession(session.id)}
      onContextMenu={(e) => handleContextMenu(e, session.id)}
    >
      <MessageSquare size={18} className='text-gray-500 flex-shrink-0' />
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-medium text-gray-900 truncate'>{session.title}</p>
        <p className='text-xs text-gray-500'>
          {formatTime(session.updatedAt || session.createdAt)} · {session.messageCount || 0}条消息
        </p>
      </div>
      {session.isPinned && (
        <Pin size={14} className='text-amber-500 flex-shrink-0' />
      )}
      <button
        className='opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-all'
        onClick={(e) => {
          e.stopPropagation();
          handleContextMenu(e, session.id);
        }}
      >
        <MoreVertical size={14} className='text-gray-500' />
      </button>
    </motion.div>
  );

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 64 : sidebarWidth }}
        transition={isResizing ? { duration: 0 } : { duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className='h-[calc(100vh-64px)] bg-white/80 backdrop-blur-sm border-r border-gray-200/50 flex flex-col overflow-hidden relative'
      >
        {sidebarCollapsed ? (
          <div className='flex flex-col items-center py-4 gap-3'>
            <button
              onClick={toggleSidebar}
              className='w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 to-amber-100 flex items-center justify-center shadow-md hover:shadow-lg transition-shadow'
              title='展开侧边栏'
            >
              <ChevronRight size={20} className='text-amber-700' />
            </button>
            
            <div className='flex flex-col gap-2 mt-4'>
              {[
                { icon: MessageSquare, label: '会话历史', tab: 'sessions' },
                { icon: Star, label: '收藏问题', tab: 'favorites' },
                { icon: Zap, label: '快捷操作', tab: 'actions' },
              ].map((item) => (
                <button
                  key={item.tab}
                  onClick={() => {
                    setActiveTab(item.tab);
                    toggleSidebar();
                  }}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                    activeTab === item.tab
                      ? 'bg-amber-100 text-amber-700'
                      : 'hover:bg-gray-100 text-gray-500'
                  }`}
                  title={item.label}
                >
                  <item.icon size={20} />
                </button>
              ))}
            </div>

            <button
              onClick={handleNewSession}
              className='w-10 h-10 rounded-lg bg-gradient-to-br from-amber-700 to-amber-600 flex items-center justify-center text-white shadow-md hover:shadow-lg transition-shadow mt-4'
              title='新建会话'
            >
              <Plus size={20} />
            </button>
          </div>
        ) : (
          <div className='flex flex-col h-full'>
            <div className='p-4 border-b border-gray-200/50'>
              <div className='flex items-center justify-between mb-3'>
                <h2 className='text-lg font-semibold text-gray-900 flex items-center gap-2'>
                  <MessageSquare size={20} className='text-amber-700' />
                  会话历史
                </h2>
                <button
                  onClick={toggleSidebar}
                  className='w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 bg-transparent border-none hover:bg-gray-100'
                  title='收起侧边栏'
                >
                  <ChevronLeft size={20} />
                </button>
              </div>

              <button
                onClick={handleNewSession}
                className='w-full px-6 py-3 bg-gradient-to-br from-amber-700 to-amber-600 text-white rounded-lg font-semibold text-base transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center gap-2'
              >
                <Plus size={18} />
                新建会话
              </button>
            </div>

            <div className='p-3'>
              <div className='relative'>
                <Search size={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' />
                <input
                  type='text'
                  placeholder='搜索会话...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all'
                />
              </div>
            </div>

            <div className='flex border-b border-gray-200/50 px-2'>
              {[
                { id: 'sessions', label: '会话', icon: MessageSquare },
                { id: 'favorites', label: '收藏', icon: Star },
                { id: 'actions', label: '快捷', icon: Zap },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors relative ${
                    activeTab === tab.id
                      ? 'text-amber-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId='activeSidebarTab'
                      className='absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-700 to-amber-600'
                    />
                  )}
                </button>
              ))}
            </div>

            <div className='flex-1 overflow-y-auto'>
              <AnimatePresence mode='wait'>
                {activeTab === 'sessions' && (
                  <motion.div
                    key='sessions'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className='p-2'
                  >
                    {pinnedSessions.length > 0 && (
                      <div className='mb-2'>
                        <p className='text-xs text-gray-400 px-2 py-1'>置顶会话</p>
                        {pinnedSessions.map((session) => (
                          <SessionItem key={session.id} session={session} />
                        ))}
                      </div>
                    )}
                    
                    {regularSessions.length > 0 ? (
                      <div>
                        {pinnedSessions.length > 0 && (
                          <p className='text-xs text-gray-400 px-2 py-1'>其他会话</p>
                        )}
                        {regularSessions.map((session) => (
                          <SessionItem key={session.id} session={session} />
                        ))}
                      </div>
                    ) : pinnedSessions.length === 0 ? (
                      <div className='text-center py-8'>
                        <FolderOpen size={40} className='mx-auto text-gray-300 mb-2' />
                        <p className='text-sm text-gray-400'>暂无会话记录</p>
                        <p className='text-xs text-gray-300 mt-1'>点击上方按钮开始新对话</p>
                      </div>
                    ) : null}
                  </motion.div>
                )}

                {activeTab === 'favorites' && (
                  <motion.div
                    key='favorites'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className='p-2 space-y-1'
                  >
                    {mockFavoriteQuestions.map((item, index) => (
                      <motion.button
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className='w-full flex items-start gap-2 p-3 rounded-lg hover:bg-gray-100 transition-colors text-left group'
                      >
                        <Star size={14} className='text-amber-500 mt-0.5 flex-shrink-0' />
                        <div className='flex-1 min-w-0'>
                          <p className='text-sm text-gray-700 line-clamp-2 group-hover:text-amber-700'>
                            {item.question}
                          </p>
                          <p className='text-xs text-gray-400 mt-0.5'>{item.category}</p>
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
                )}

                {activeTab === 'actions' && (
                  <motion.div
                    key='actions'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className='p-2 space-y-1'
                  >
                    {quickActions.map((action, index) => (
                      <motion.button
                        key={action.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className='w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors text-left'
                      >
                        <action.icon size={18} className='text-gray-500' />
                        <span className='text-sm text-gray-700'>{action.label}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {!sidebarCollapsed && (
          <div
            onMouseDown={handleMouseDown}
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize group ${
              isResizing ? 'bg-amber-500' : 'hover:bg-amber-300'
            }`}
          >
            <div className='absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity'>
              <GripVertical size={14} className='text-gray-400' />
            </div>
          </div>
        )}
      </motion.aside>

      <AnimatePresence>
        {contextMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='fixed inset-0 z-40'
              onClick={() => setContextMenu(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className='fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[140px]'
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                onClick={() => handlePinSession(contextMenu.id)}
                className='w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100'
              >
                <Pin size={14} />
                置顶会话
              </button>
              <button
                onClick={() => setContextMenu(null)}
                className='w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100'
              >
                <Edit2 size={14} />
                重命名
              </button>
              <hr className='my-1 border-gray-200' />
              <button
                onClick={() => handleDeleteSession(contextMenu.id)}
                className='w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50'
              >
                <Trash2 size={14} />
                删除会话
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
