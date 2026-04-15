import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, History, Image as ImageIcon, Sparkles, Settings, Camera, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export default function UserCenter() {
  // 1. 从全局状态提取 user 和 updateUser 方法
  const { user, updateUser } = useAuthStore();
  
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  // 2. 安全读取用户信息，如果没有则降级显示
  const username = user?.username || '游客';
  const userId = user?.id || '未登录';
  const identity = user?.is_active ? '非遗数字创作者' : '离线测试账号';
  
  // 3. 处理头像 URL (适配相对路径和绝对路径)
  const API_BASE_URL = "http://localhost:8000";
  const avatarUrl = user?.avatar?.startsWith('http') 
    ? user.avatar 
    : user?.avatar ? `${API_BASE_URL}/${user.avatar.replace(/^\//, '')}` : null;

  // --- 处理文件上传核心逻辑 ---
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("图片不能超过 5MB");
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    setIsUploading(true);

    try {
      const token = localStorage.getItem('token');
      // 注意：这里的 URL 要和你后端的接口地址一致
      const resp = await fetch(`${API_BASE_URL}/api/v1/user/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}` 
        },
        body: formData
      });

      if (!resp.ok) throw new Error("上传失败");

      const data = await resp.json();
      const newAvatarUrl = data.avatar_url;

      // 🔥 最关键的一步：更新全局状态，导航栏头像会立刻跟着变！
      updateUser({ avatar: newAvatarUrl });
      alert("头像上传成功！");

    } catch (error) {
      console.error("上传头像出错:", error);
      alert("上传头像失败，请检查网络或后端服务");
    } finally {
      setIsUploading(false);
      // 清空 input 的值，保证下次选同一张图也能触发 onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; 
      }
    }
  };

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
      
      {/* 隐藏的文件选择器 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange} 
      />

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
                
                {/* 头像展示与上传区 */}
                <motion.div 
                  whileHover={{ scale: 1.02 }} 
                  className="relative shrink-0 cursor-pointer group"
                  onClick={() => !isUploading && fileInputRef.current.click()} 
                >
                  <div className={`w-40 h-40 md:w-48 md:h-48 rounded-full ${colors.cardBg} border-4 border-white shadow-[0_8px_30px_rgba(184,146,89,0.15)] flex items-center justify-center overflow-hidden relative`}>
                    
                    {isUploading ? (
                      <div className="flex flex-col items-center justify-center text-[#b89259]">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <span className="text-sm">上传中</span>
                      </div>
                    ) : avatarUrl ? (
                      <img 
                        src={avatarUrl} 
                        alt="用户头像" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#f2efe9] to-[#e6dfd1] flex items-center justify-center text-[#b89259]">
                        <span className="text-5xl font-serif">{username.charAt(0).toUpperCase()}</span>
                      </div>
                    )}

                    {/* 悬停提示 */}
                    {!isUploading && (
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Camera size={28} className="mb-2" />
                        <span className="text-sm tracking-wider">更换头像</span>
                      </div>
                    )}
                  </div>
                  
                  <div className={`absolute bottom-2 right-2 w-10 h-10 rounded-full ${colors.accentGold} flex items-center justify-center border-4 border-[#f8f6f1] text-white shadow-md`}>
                    <Sparkles size={18} />
                  </div>
                </motion.div>

                {/* 文本信息区 */}
                <div className="flex-1 flex flex-col justify-center w-full mt-4 md:mt-8">
                  <h1 className={`text-4xl md:text-5xl font-bold tracking-widest ${colors.textMain} font-serif`}>
                    {username}
                  </h1>
                  
                  <div className={`w-full max-w-xl h-[1px] bg-[#d1ccc0] my-5 relative`}>
                    <div className={`absolute left-0 -top-[2px] w-[5px] h-[5px] rounded-full ${colors.accentGold}`} />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                    <p className={`${colors.textSub} tracking-wider font-light`}>
                      用户id: <span className="font-mono text-[#3a3732]">{userId}</span>
                    </p>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 bg-[#f2efe9] ${colors.accentGoldText} rounded-md text-sm border ${colors.border}`}>
                      {identity}
                    </span>
                  </div>
                </div>
              </div>

              {/* 优雅的非遗风渐变背景展示卡片 (替代了之前报错的国外图片) */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="relative w-full aspect-[21/9] md:aspect-[2.5/1] rounded-3xl overflow-hidden group shadow-[0_15px_40px_rgba(58,55,50,0.08)] bg-gradient-to-r from-[#dcd1c4] to-[#f4eee6]"
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMTg0LCAxNDYsIDg5LCAwLjE1KSIvPjwvc3ZnPg==')] opacity-60" />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <ImageIcon size={48} className="text-[#b89259]/40 mb-4" />
                  <p className="text-[#7a756b] font-light tracking-widest text-lg md:text-xl">
                    {username} 的非遗数字展厅
                  </p>
                </div>
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