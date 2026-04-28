import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Plus,
  Star,
  ChevronLeft,
  ChevronRight,
  Search,
  MoreVertical,
  Pin,
  Trash2,
  Edit2,
  FolderOpen,
  Clock,
  Archive,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useChatStore } from '../../../stores/chatStore';
import { useUIStore, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from '../../../stores/uiStore';
import { useResizablePanel } from '../../../hooks/useResizablePanel';
import { chatDataService } from '../../../services/chat';
import { useToast } from '../../common/Toast';
import type { Session } from '../../../types/chat';

interface SidebarProps {
  onNewChat: () => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onPinSession: (sessionId: string) => void;
  onSelectFavorite?: (question: string) => void;
}

export default function Sidebar({
  onNewChat,
  onSwitchSession,
  onDeleteSession,
  onPinSession,
  onSelectFavorite,
}: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar, sidebarWidth, setSidebarWidth } = useUIStore();
  const { sessions, currentSessionId, pinSession, updateSessionTitle, batchArchiveSessions } =
    useChatStore();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [favoriteQuestions, setFavoriteQuestions] = useState<
    { id: string; question: string; category: string; timestamp: string }[]
  >([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'pinned'>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('chat_recent_searches');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const addRecentSearch = (query: string) => {
    const q = query.trim();
    if (!q) return;

    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((x) => x !== q)].slice(0, 20);
      try {
        localStorage.setItem('chat_recent_searches', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const { isResizing, handleMouseDown } = useResizablePanel({
    initialWidth: sidebarWidth,
    minWidth: MIN_SIDEBAR_WIDTH,
    maxWidth: MAX_SIDEBAR_WIDTH,
    collapsed: sidebarCollapsed,
    onWidthChange: setSidebarWidth,
    direction: 'left',
  });

  useEffect(() => {
    const loadFavoriteQuestions = async () => {
      try {
        const favorites = await chatDataService.getFavoriteQuestions();
        setFavoriteQuestions(favorites);
      } catch (error) {
        const storedFavorites = localStorage.getItem('favoriteQuestions');
        if (storedFavorites) {
          setFavoriteQuestions(JSON.parse(storedFavorites));
        }
      }
    };

    loadFavoriteQuestions();

    const handleFavoriteChange = () => {
      loadFavoriteQuestions();
    };

    window.addEventListener('favoriteChanged', handleFavoriteChange);
    return () => {
      window.removeEventListener('favoriteChanged', handleFavoriteChange);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredSessions = sessions.filter((s) => {
    return s.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredByType =
    filterType === 'pinned' ? filteredSessions.filter((s) => s.is_pinned) : filteredSessions;
  const pinnedSessions = filteredByType.filter((s) => s.is_pinned);
  const regularSessions = filteredByType.filter((s) => !s.is_pinned);

  const handleNewSession = () => {
    onNewChat?.();
  };

  const quickActions: {
    id: string;
    label: string;
    description: string;
    action: () => void;
    icon: LucideIcon;
  }[] = [
    {
      id: 'new-chat',
      label: '新建对话',
      description: '开始一个新的会话',
      action: handleNewSession,
      icon: Plus,
    },
  ];

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await chatDataService.deleteSession(sessionId);
    } catch (error) {
      console.warn('Failed to delete session from server');
    }
    onDeleteSession?.(sessionId);
    setContextMenu(null);
  };

  const handlePinSession = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    const newPinnedStatus = !session?.is_pinned;
    pinSession(sessionId);
    try {
      await chatDataService.updateSession(sessionId, { is_pinned: newPinnedStatus });
    } catch (error) {
      console.warn('Failed to sync pin status to server');
    }
    onPinSession?.(sessionId);
    setContextMenu(null);
  };

  const handleStartEdit = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
    setContextMenu(null);
  };

  const handleSaveEdit = async () => {
    if (editingSessionId && editingTitle.trim()) {
      updateSessionTitle(editingSessionId, editingTitle.trim());
      try {
        await chatDataService.updateSession(editingSessionId, { title: editingTitle.trim() });
      } catch (error) {
        console.warn('Failed to sync session title to server');
      }
    }
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 160;
    const menuHeight = 150;
    const padding = 8;
    let x = e.clientX;
    let y = e.clientY;
    if (x + menuWidth + padding > window.innerWidth) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (y + menuHeight + padding > window.innerHeight) {
      y = window.innerHeight - menuHeight - padding;
    }
    setContextMenu({ id: sessionId, x, y });
  };

  const handleFavoriteClick = (question: string) => {
    onSelectFavorite?.(question);
  };

  const handleSwitchSession = async (sessionId: string) => {
    onSwitchSession?.(sessionId);
    setContextMenu(null);
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedSessions(new Set(filteredByType.map((s) => s.id)));
  };

  const handleBatchArchive = async () => {
    const ids = Array.from(selectedSessions);
    if (ids.length === 0) return;

    try {
      // 使用批量归档方法
      await batchArchiveSessions(ids, true);
      toast.success('归档成功', `已归档 ${ids.length} 个会话`);
    } catch (error) {
      console.error('Failed to batch archive:', error);
      toast.error('归档失败', '无法批量归档会话');
    } finally {
      setSelectedSessions(new Set());
      setIsSelectionMode(false);
    }
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedSessions);
    if (ids.length === 0) return;

    try {
      // 使用批量删除方法（并行执行）
      await Promise.all(ids.map((id) => handleDeleteSession(id)));
      toast.success('删除成功', `已删除 ${ids.length} 个会话`);
    } catch (error) {
      console.error('Failed to batch delete:', error);
      toast.error('删除失败', '无法批量删除会话');
    } finally {
      setSelectedSessions(new Set());
      setIsSelectionMode(false);
    }
  };

  const handleRecentSearchClick = (search: string) => {
    setSearchQuery(search);
  };

  const groupSessionsByDate = (sessions: typeof filteredSessions) => {
    const groups: { label: string; sessions: typeof filteredSessions }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const todaySessions: typeof filteredSessions = [];
    const yesterdaySessions: typeof filteredSessions = [];
    const weekSessions: typeof filteredSessions = [];
    const monthSessions: typeof filteredSessions = [];
    const olderSessions: typeof filteredSessions = [];

    sessions.forEach((session) => {
      const sessionDate = new Date(session.updated_at || session.created_at);
      sessionDate.setHours(0, 0, 0, 0);

      if (sessionDate.getTime() >= today.getTime()) {
        todaySessions.push(session);
      } else if (sessionDate.getTime() >= yesterday.getTime()) {
        yesterdaySessions.push(session);
      } else if (sessionDate.getTime() >= weekAgo.getTime()) {
        weekSessions.push(session);
      } else if (sessionDate.getTime() >= monthAgo.getTime()) {
        monthSessions.push(session);
      } else {
        olderSessions.push(session);
      }
    });

    if (todaySessions.length > 0) groups.push({ label: '今天', sessions: todaySessions });
    if (yesterdaySessions.length > 0) groups.push({ label: '昨天', sessions: yesterdaySessions });
    if (weekSessions.length > 0) groups.push({ label: '本周', sessions: weekSessions });
    if (monthSessions.length > 0) groups.push({ label: '本月', sessions: monthSessions });
    if (olderSessions.length > 0) groups.push({ label: '更早', sessions: olderSessions });

    return groups;
  };

  const formatTime = (date: string) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const SessionItem = ({ session }: { session: Session }) => {
    const isEditing = editingSessionId === session.id;
    const isSelected = selectedSessions.has(session.id);

    return (
      <div
        className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 group relative hover:translate-x-[2px]"
        style={{
          background: isSelected
            ? 'var(--color-primary-light)'
            : currentSessionId === session.id
              ? 'var(--color-background-secondary)'
              : 'transparent',
          color:
            currentSessionId === session.id ? 'var(--color-primary)' : 'var(--color-text-primary)',
        }}
        onClick={() => {
          if (isSelectionMode) handleSelectSession(session.id);
          else if (!isEditing) handleSwitchSession(session.id);
        }}
        onContextMenu={(e) => !isSelectionMode && handleContextMenu(e, session.id)}
      >
        {isSelectionMode && (
          <div
            className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0"
            style={{
              borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
              background: isSelected ? 'var(--color-primary)' : 'transparent',
            }}
          >
            {isSelected && (
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2 5L4 7L8 3"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        )}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors"
          style={{
            background:
              currentSessionId === session.id
                ? 'var(--color-surface)'
                : 'var(--color-background-tertiary)',
            color:
              currentSessionId === session.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
          }}
        >
          <MessageSquare size={14} />
        </div>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              onBlur={handleSaveEdit}
              autoFocus
              className="w-full px-2 py-0.5 text-sm rounded outline-none"
              style={{
                background: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-primary)',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <p
                className="text-sm truncate leading-tight"
                style={{
                  color:
                    currentSessionId === session.id
                      ? 'var(--color-primary)'
                      : 'var(--color-text-primary)',
                  fontWeight: currentSessionId === session.id ? 500 : 400,
                }}
              >
                {session.title}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {formatTime(session.updated_at || session.created_at)}
              </p>
            </>
          )}
        </div>
        {session.is_pinned && !isEditing && (
          <div className="flex-shrink-0">
            <Pin size={10} style={{ color: 'var(--color-secondary)' }} />
          </div>
        )}
        {!isEditing && (
          <button
            className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all hover:bg-gray-100 dark:hover:bg-gray-700"
            style={{ background: 'transparent' }}
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e, session.id);
            }}
          >
            <MoreVertical size={12} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 56 : sidebarWidth }}
        transition={isResizing ? { duration: 0 } : { duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="h-full min-h-0 flex flex-col overflow-hidden relative transition-colors duration-300"
        style={{
          background: sidebarCollapsed
            ? 'transparent'
            : 'linear-gradient(135deg, var(--color-surface) 0%, var(--color-background-secondary) 100%)',
          borderRight: sidebarCollapsed ? 'none' : '1px solid var(--color-border-light)',
        }}
      >
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center py-2 gap-2">
            <motion.button
              onClick={toggleSidebar}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
              style={{
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
              }}
              title="展开侧边栏"
            >
              <ChevronRight size={16} />
            </motion.button>

            <div className="flex flex-col gap-1.5 mt-2">
              {[
                { icon: MessageSquare, label: '会话历史', tab: 'sessions' },
                { icon: Star, label: '收藏问题', tab: 'favorites' },
              ].map((item) => (
                <motion.button
                  key={item.tab}
                  onClick={() => {
                    setActiveTab(item.tab);
                    toggleSidebar();
                  }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                  style={{
                    background:
                      activeTab === item.tab ? 'var(--color-primary-light)' : 'transparent',
                    color:
                      activeTab === item.tab ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                  title={item.label}
                >
                  <item.icon size={18} />
                </motion.button>
              ))}
            </div>

            <motion.button
              onClick={handleNewSession}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md hover:shadow-lg transition-shadow mt-3"
              style={{ background: 'var(--gradient-secondary)' }}
              title="新建会话"
            >
              <Plus size={18} />
            </motion.button>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="p-3.5" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="text-base font-semibold flex items-center gap-2"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <MessageSquare size={18} style={{ color: 'var(--color-secondary)' }} />
                  会话历史
                </h2>
                <motion.button
                  onClick={toggleSidebar}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                  style={{ background: 'transparent', color: 'var(--color-text-muted)' }}
                  title="收起侧边栏"
                >
                  <ChevronLeft size={18} />
                </motion.button>
              </div>

              <motion.button
                onClick={handleNewSession}
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.99 }}
                className="w-full px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                style={{
                  background: 'var(--gradient-secondary)',
                  color: 'var(--color-text-inverse)',
                }}
              >
                <Plus size={16} />
                新建会话
              </motion.button>
            </div>

            <div className="p-2.5">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}
                />
                <input
                  type="text"
                  placeholder="搜索会话..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addRecentSearch(searchQuery);
                  }}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg transition-all"
                  style={{
                    background: 'var(--color-background-secondary)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>
            </div>

            <div
              className="flex px-2"
              style={{ borderBottom: '1px solid var(--color-border-light)' }}
            >
              {[
                { id: 'sessions', label: '会话', icon: MessageSquare },
                { id: 'favorites', label: '收藏', icon: Star },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors relative"
                  style={{
                    color:
                      activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  <tab.icon size={12} />
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeSidebarTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ background: 'var(--gradient-secondary)' }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {activeTab === 'sessions' && (
                <div className="p-2">
                  {isSelectionMode && (
                    <div
                      className="flex items-center justify-between px-2 py-2 mb-2 rounded-lg"
                      style={{ background: 'var(--color-background-secondary)' }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSelectAll}
                          className="text-xs px-2 py-1 rounded"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          {selectedSessions.size === filteredSessions.length ? '取消全选' : '全选'}
                        </button>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          已选 {selectedSessions.size} 项
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleBatchArchive}
                          disabled={selectedSessions.size === 0}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded disabled:opacity-50"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          <Archive size={12} />
                          归档
                        </button>
                        <button
                          onClick={handleBatchDelete}
                          disabled={selectedSessions.size === 0}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded disabled:opacity-50"
                          style={{ color: 'var(--color-error)' }}
                        >
                          <Trash2 size={12} />
                          删除
                        </button>
                      </div>
                    </div>
                  )}

                  {filterType !== 'all' && (
                    <div className="flex items-center justify-between px-2 py-1 mb-2">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        筛选: {filterType === 'pinned' ? '已置顶' : '已归档'}
                      </span>
                      <button
                        onClick={() => setFilterType('all')}
                        className="text-xs"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        清除筛选
                      </button>
                    </div>
                  )}

                  {(() => {
                    const groupedSessions = groupSessionsByDate(regularSessions);

                    if (pinnedSessions.length > 0) {
                      return (
                        <>
                          <div className="mb-1.5">
                            <p
                              className="text-[10px] px-2 py-1 font-medium"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              置顶会话
                            </p>
                            {pinnedSessions.map((session) => (
                              <SessionItem key={session.id} session={session} />
                            ))}
                          </div>

                          {groupedSessions.map((group) => (
                            <div key={group.label} className="mb-1.5">
                              <p
                                className="text-[10px] px-2 py-1 font-medium"
                                style={{ color: 'var(--color-text-muted)' }}
                              >
                                {group.label}
                              </p>
                              {group.sessions.map((session) => (
                                <SessionItem key={session.id} session={session} />
                              ))}
                            </div>
                          ))}
                        </>
                      );
                    }

                    if (groupedSessions.length > 0) {
                      return groupedSessions.map((group) => (
                        <div key={group.label} className="mb-1.5">
                          <p
                            className="text-[10px] px-2 py-1 font-medium"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            {group.label}
                          </p>
                          {group.sessions.map((session) => (
                            <SessionItem key={session.id} session={session} />
                          ))}
                        </div>
                      ));
                    }

                    return (
                      <div className="text-center py-8">
                        <FolderOpen
                          size={36}
                          className="mx-auto mb-2"
                          style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}
                        />
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          暂无会话记录
                        </p>
                        <p
                          className="text-[10px] mt-1"
                          style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
                        >
                          点击上方按钮开始新对话
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'favorites' && (
                <div className="p-2 space-y-0.5">
                  {favoriteQuestions.length > 0 ? (
                    favoriteQuestions.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleFavoriteClick(item.question)}
                        className="w-full flex items-start gap-2 p-2.5 rounded-lg transition-colors text-left group hover:bg-[var(--color-background-secondary)] hover:translate-x-[2px]"
                        style={{ background: 'transparent' }}
                      >
                        <Star
                          size={12}
                          className="mt-0.5 flex-shrink-0"
                          style={{ color: 'var(--color-secondary)' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-xs line-clamp-2"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {item.question}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                              {item.category}
                            </p>
                            {item.timestamp && (
                              <>
                                <span style={{ color: 'var(--color-text-muted)' }}>·</span>
                                <p
                                  className="text-[10px] flex items-center gap-0.5"
                                  style={{ color: 'var(--color-text-muted)' }}
                                >
                                  <Clock size={8} />
                                  {formatTime(item.timestamp)}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Star
                        size={36}
                        className="mx-auto mb-2"
                        style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}
                      />
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        暂无收藏问题
                      </p>
                      <p
                        className="text-[10px] mt-1"
                        style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
                      >
                        在对话中点击收藏按钮添加
                      </p>
                    </div>
                  )}

                  {recentSearches.length > 0 && (
                    <div
                      className="mt-4 pt-4"
                      style={{ borderTop: '1px solid var(--color-border-light)' }}
                    >
                      <p
                        className="text-[10px] px-2 py-1 font-medium"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        最近搜索
                      </p>
                      {recentSearches.slice(0, 5).map((search, index) => (
                        <button
                          key={index}
                          onClick={() => handleRecentSearchClick(search)}
                          className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left hover:translate-x-[2px]"
                          style={{ background: 'transparent' }}
                        >
                          <Clock size={12} style={{ color: 'var(--color-text-muted)' }} />
                          <span
                            className="text-xs"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            {search}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'actions' && (
                <div className="p-2 space-y-0.5">
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={action.action}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-colors text-left group hover:bg-[var(--color-background-secondary)] hover:translate-x-[2px]"
                      style={{ background: 'transparent' }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          background: 'var(--color-background-tertiary)',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        <action.icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span
                          className="text-xs font-medium block"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {action.label}
                        </span>
                        <span
                          className="text-[10px] block mt-0.5"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {action.description}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!sidebarCollapsed && (
          <div
            onMouseDown={handleMouseDown}
            className={`panel-resize-handle ${isResizing ? 'resizing' : ''}`}
          >
            <div className="panel-resize-indicator" />
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
              className="fixed inset-0 z-40"
              onClick={() => setContextMenu(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              className="fixed rounded-xl shadow-lg py-1.5 z-50 min-w-[140px]"
              style={{
                left: contextMenu.x,
                top: contextMenu.y,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-light)',
                boxShadow: '0 10px 40px -10px rgba(0, 0, 0, 0.2)',
              }}
            >
              <button
                onClick={() => {
                  const session = sessions.find((s) => s.id === contextMenu.id);
                  if (session) handleStartEdit(contextMenu.id, session.title);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <Edit2 size={12} />
                重命名
              </button>
              <button
                onClick={() => handlePinSession(contextMenu.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: 'var(--color-text-primary)' }}
              >
                <Pin size={12} />
                {sessions.find((s) => s.id === contextMenu.id)?.is_pinned ? '取消置顶' : '置顶会话'}
              </button>
              <hr
                style={{
                  border: 'none',
                  borderTop: '1px solid var(--color-border-light)',
                  margin: '4px 0',
                }}
              />
              <button
                onClick={() => handleDeleteSession(contextMenu.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                style={{ color: 'var(--color-error)' }}
              >
                <Trash2 size={12} />
                删除会话
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
