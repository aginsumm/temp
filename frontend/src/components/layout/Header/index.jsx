import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Network, User, Menu, X, LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import NetworkStatusManager from '../../common/NetworkStatusManager';
import ThemeToggle from '../../common/ThemeToggle';
import logoSvg from '../../../assets/icon/logo.svg';

const navItems = [
  { path: '/', label: '首页', icon: null },
  { path: '/chat', label: '智能问答', icon: MessageSquare },
  { path: '/knowledge', label: '知识图谱', icon: Network },
];

export default function Header() {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayName = user?.username || '';
  const displayChar = displayName.charAt(0).toUpperCase() || '游';

  useEffect(() => {
    setShowUserMenu(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 h-16 backdrop-blur-md z-50 transition-colors duration-300"
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border-light)',
        boxShadow: 'var(--color-shadow)',
      }}
    >
      <div className="h-full px-4 lg:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3 group">
            <motion.div
              className="w-10 h-10 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <img src={logoSvg} alt="Logo" className="w-full h-full object-contain" />
            </motion.div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
                故障机器人
              </h1>
            </div>
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2"
                style={{
                  color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  background: active ? 'var(--color-primary-light)' : 'transparent',
                }}
              >
                {Icon && <Icon size={18} />}
                {item.label}
                {active && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                    style={{ background: 'var(--gradient-secondary)' }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={mobileMenuOpen}
            onClick={() => {
              setMobileMenuOpen((v) => !v);
              setShowUserMenu(false);
            }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="hidden md:block">
            <NetworkStatusManager mode="compact" showLatency showQueue={false} />
          </div>

          <ThemeToggle variant="dropdown" size="sm" />

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
              style={{ background: 'transparent' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm"
                style={{
                  background: user?.avatar ? 'transparent' : 'var(--gradient-primary)',
                  color: 'var(--color-text-inverse)',
                  border: user?.avatar ? '1px solid var(--color-border-light)' : 'none',
                }}
              >
                {user?.avatar ? (
                  // 如果有头像，显示图片
                  <img
                    src={user.avatar}
                    alt={displayName}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  // 如果没有头像，显示首字符
                  <span>{displayChar}</span>
                )}
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform hidden sm:block ${showUserMenu ? 'rotate-180' : ''}`}
                style={{ color: 'var(--color-text-muted)' }}
              />
            </button>

            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-lg py-2 z-50 max-h-[70vh] overflow-auto"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                }}
              >
                <Link
                  to="/user"
                  className="flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onClick={() => setShowUserMenu(false)}
                >
                  <User size={16} />
                  个人中心
                </Link>
                <Link
                  to="/user"
                  className="flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onClick={() => setShowUserMenu(false)}
                >
                  <User size={16} />
                  设置
                </Link>
                <hr style={{ borderColor: 'var(--color-border-light)', margin: '0.5rem 0' }} />
                <button
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                  style={{ color: 'var(--color-error)' }}
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  退出登录
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="lg:hidden absolute left-0 right-0 top-16"
          style={{
            borderTop: '1px solid var(--color-border-light)',
            background: 'var(--color-surface)',
            maxHeight: 'calc(100vh - 4rem)',
            overflowY: 'auto',
          }}
        >
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors"
                  style={{
                    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    background: active ? 'var(--color-primary-light)' : 'transparent',
                  }}
                >
                  {Icon && <Icon size={20} />}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </motion.div>
      )}
    </header>
  );
}
