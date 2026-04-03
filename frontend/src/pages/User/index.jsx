import { useState, useEffect } from 'react'; // 1. 确保引入了 useEffect
import { motion, AnimatePresence } from 'framer-motion';
import { User, History, Image as ImageIcon, Sparkles, Settings } from 'lucide-react';

export default function UserCenter() {
  // --- 状态管理：存储用户信息 ---
  const [userInfo, setUserInfo] = useState({
    username: '游客',
    userId: '未登录',
    identity: '普通用户'
  });

  // --- 实时读取本地存储的用户数据 ---
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const userObj = JSON.parse(savedUser);
        // 这里根据你后端返回的字段进行匹配，通常是 username 和 id
        setUserInfo({
          username: userObj.username || '未知用户',
          userId: userObj.id || 'ID未知',
          identity: userObj.identity === 'admin' ? '管理员' : '非遗数字创作者'
        });
      } catch (e) {
        console.error("解析用户信息失败", e);
      }
    }
  }, []);

  // --- 雅致非遗风配色 ---
  const colors = {
    baseBg: "bg-[#f8f6f1]",
    cardBg: "bg-[#ffffff]",
    accentGold: "bg-[#b89259]",
    accentGoldText: "text-[#b89259]",
    accentGoldBorder: "border-[#b89259]",
    textMain: "text-[#3a3732]",
    textSub: "text-[#7a756b]",
    border: "border-[#ebe5d9]"
  };

  const [activeTab, setActiveTab] = useState('profile');
  const navItems = [
    { id: 'profile', label: '个人主页', icon: User },
    { id: 'history', label: '历史提取记录', icon: History },
  ];

  return (
    <div className={`flex min-h-[calc(100vh-64px)] ${colors.baseBg} font-sans selection:bg-[#b89259]/20 selection:${colors.accentGoldText}`}>
      
      {/* --- 左侧导航栏 --- */}
      <motion.div 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className={`w-64 ${colors.cardBg} border-r ${colors.border} flex flex-col pt-10 pb-6 px-4 shadow-[4px_0_24px_rgba(58,55,50,0.02)] z-10`}
      >
        <div className="flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative overflow-hidden group ${
                  isActive ? `${colors.accentGoldText} font-medium` : `${colors.textSub} hover:bg-[#f8f6f1] hover:${colors.textMain}`
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="sidebar-active-bg"
                    className="absolute inset-0 bg-[#b89259]/10 rounded-xl"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon size={20} className="relative z-10" />
                <span className="relative z-10 tracking-wider text-sm">{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-auto">
          <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${colors.textSub} hover:bg-[#f8f6f1] transition-all duration-300`}>
            <Settings size={20} />
            <span className="tracking-wider text-sm">账户设置</span>
          </button>
        </div>
      </motion.div>

      {/* --- 右侧主内容区 --- */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'profile' ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="max-w-6xl mx-auto p-10 md:p-16"
            >
              <div className="flex flex-col md:flex-row items-center md:items-start gap-10 mb-16">
                <motion.div whileHover={{ scale: 1.05 }} className="relative shrink-0">
                  <div className={`w-40 h-40 md:w-48 md:h-48 rounded-full ${colors.cardBg} border-4 border-white shadow-[0_8px_30px_rgba(184,146,89,0.15)] flex items-center justify-center overflow-hidden`}>
                    <div className="w-full h-full bg-gradient-to-br from-[#f2efe9] to-[#e6dfd1] flex items-center justify-center text-[#b89259]">
                      {/* 头像显示名字首字母 */}
                      <span className="text-5xl font-serif">{userInfo.username.charAt(0).toUpperCase()}</span>
                    </div>
                  </div>
                  <div className={`absolute bottom-2 right-2 w-10 h-10 rounded-full ${colors.accentGold} flex items-center justify-center border-4 border-[#f8f6f1] text-white shadow-md`}>
                    <Sparkles size={18} />
                  </div>
                </motion.div>

                <div className="flex-1 flex flex-col justify-center w-full mt-4 md:mt-8">
                  <h1 
                    className={`text-4xl md:text-5xl font-bold tracking-widest ${colors.textMain} font-serif`}
                    style={{ textShadow: "0px 4px 8px rgba(0,0,0,0.05)" }}
                  >
                    {/* 2. 实时显示昵称 */}
                    {userInfo.username}
                  </h1>
                  
                  <div className={`w-full max-w-xl h-[1px] bg-[#d1ccc0] my-5 relative`}>
                    <div className={`absolute left-0 -top-[2px] w-[5px] h-[5px] rounded-full ${colors.accentGold}`} />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                    <p className={`${colors.textSub} tracking-wider font-light`}>
                      {/* 3. 实时显示用户ID */}
                      用户id: <span className="font-mono">{userInfo.userId}</span>
                    </p>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 bg-[#f2efe9] ${colors.accentGoldText} rounded-md text-sm border ${colors.border}`}>
                      {/* 4. 实时显示身份 */}
                      {userInfo.identity}
                    </span>
                  </div>
                </div>
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="relative w-full aspect-[21/9] md:aspect-[2.5/1] rounded-3xl overflow-hidden group shadow-[0_15px_40px_rgba(58,55,50,0.08)]"
              >
                <img 
                  src="https://images.unsplash.com/photo-1616422285623-14c1e48398e0?q=80&w=2000&auto=format&fit=crop" 
                  alt="个人主页背景" 
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <ImageIcon size={48} className="text-white/50 mb-4" />
                  <p className="text-white/80 font-light tracking-widest text-lg">
                    {userInfo.username} 的非遗数字展厅
                  </p>
                </div>
                <button className={`absolute top-6 right-6 px-4 py-2 bg-black/30 backdrop-blur-md text-white rounded-lg border border-white/20 text-sm tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-black/50`}>
                  更换封面
                </button>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="max-w-6xl mx-auto p-10 md:p-16 flex flex-col items-center justify-center h-full min-h-[60vh]"
            >
              <div className={`w-24 h-24 rounded-full ${colors.cardBg} border ${colors.border} flex items-center justify-center mb-6 shadow-sm`}>
                <History size={40} className={colors.accentGoldText} />
              </div>
              <h2 className={`text-2xl font-bold ${colors.textMain} mb-2 tracking-widest`}>暂无提取记录</h2>
              <p className={`${colors.textSub} font-light`}>您还没有进行过非遗元素的提取操作</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}