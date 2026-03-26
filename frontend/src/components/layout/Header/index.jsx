import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Network,
  Layers,
  User,
  Sun,
  Moon,
  Menu,
  X,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import ConnectionStatus from '../../common/ConnectionStatus';

const navItems = [
  { path: '/', label: '首页', icon: null },
  { path: '/chat', label: '智能问答', icon: MessageSquare },
  { path: '/knowledge', label: '知识图谱', icon: Network },
  { path: '/extract', label: '元素提取', icon: Layers },
];

export default function Header() {
  const location = useLocation();
  const { theme, setTheme, sidebarCollapsed, toggleSidebar } = useUIStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-b border-gray-200/50 z-50 shadow-sm">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 bg-transparent border-none hover:bg-amber-100"
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
          </button>

          <Link to="/" className="flex items-center gap-3 group">
            <motion.div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-700 to-amber-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-white font-bold text-lg">非</span>
            </motion.div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold bg-gradient-to-r from-amber-700 to-amber-600 bg-clip-text text-transparent">
                非遗数字生命
              </h1>
              <p className="text-xs text-gray-500 -mt-1">互动引擎</p>
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
                className={`relative px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
                  active
                    ? 'text-amber-700 bg-amber-100'
                    : 'text-gray-600 hover:text-amber-700 hover:bg-gray-100'
                }`}
              >
                {Icon && <Icon size={18} />}
                {item.label}
                {active && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-amber-700 to-amber-600 rounded-full"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <ConnectionStatus />

          <motion.button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 bg-transparent border-none hover:bg-amber-100"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </motion.button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-medium text-sm">
                U
              </div>
              <ChevronDown
                size={16}
                className={`text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200/50 py-2 z-50"
              >
                <Link
                  to="/user"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-amber-700 transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <User size={16} />
                  个人中心
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-amber-700 transition-colors"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings size={16} />
                  设置
                </Link>
                <hr className="my-2 border-gray-200" />
                <button
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  onClick={() => {
                    setShowUserMenu(false);
                  }}
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
          className="lg:hidden border-t border-gray-200/50 bg-white"
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                    active
                      ? 'text-amber-700 bg-amber-100'
                      : 'text-gray-600 hover:text-amber-700 hover:bg-gray-100'
                  }`}
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
