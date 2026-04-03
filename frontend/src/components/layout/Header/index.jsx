import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom'; // 1. 引入 useNavigate
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
  const navigate = useNavigate(); // 2. 初始化跳转钩子
  const { theme, setTheme, sidebarCollapsed, toggleSidebar } = useUIStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- 状态管理：实时昵称 ---
  const [user, setUser] = useState(null);

  // 3. 初始加载及监听登录状态
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, [location.pathname]); // 每次切换页面时重新检查一次状态

  // 4. 退出登录逻辑
  const handleLogout = () => {
    if (window.confirm("确定要退出登录吗？")) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('username');
      setUser(null);
      setShowUserMenu(false);
      navigate('/', { replace: true });
      // 这里的强制刷新可选，为了确保所有状态（如WebSocket）彻底关闭
      window.location.reload(); 
    }
  };

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
          {/* 只有登录后才显示连接状态 */}
          {user && <ConnectionStatus />}

          <motion.button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 bg-transparent border-none hover:bg-amber-100"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </motion.button>

          <div className="relative">
            {/* 5. 动态显示用户头像或登录按钮 */}
            {user ? (
              <>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-white font-medium text-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden md:block text-sm font-medium text-gray-700">{user.username}</span>
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
                      onClick={handleLogout} // 6. 绑定退出函数
                    >
                      <LogOut size={16} />
                      退出登录
                    </button>
                  </motion.div>
                )}
              </>
            ) : (
              // 7. 未登录状态显示登录链接
              <Link
                to="/login"
                className="px-5 py-2 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}