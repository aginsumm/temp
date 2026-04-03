import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd'; // 仅保留 antd 的全局提示功能
import { motion } from 'framer-motion';
import { User, Lock, ArrowRight, Sparkles } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  
  // 使用原生的 React State 替代 Antd 的 useForm
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberChecked, setRememberChecked] = useState(true);

  // --- 雅致非遗风 颜色配置 ---
  const colors = {
    baseBg: "bg-[#f8f6f1]",
    cardBg: "bg-[#ffffff]",
    accentGold: "bg-[#b89259]",
    accentGoldText: "text-[#b89259]",
    textMain: "text-[#3a3732]",
    textSub: "text-[#7a756b]",
    border: "border-[#ebe5d9]"
  };

  // 登录核心逻辑 (完全保留你的业务代码)
  const handleLogin = async (e) => {
    e.preventDefault(); // 阻止表单默认提交刷新页面

    try {
      const resp = await fetch('http://localhost:8000/api/v1/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await resp.json();
      
      if (!resp.ok) {
        message.error(data.message || '用户名或密码错误！');
        return;
      }

      const matchedUser = data.user;
      message.success(`登录成功！欢迎：${username}`);

      // 保留所有的本地存储逻辑
      localStorage.setItem('token', 'real-token-' + username);
      localStorage.setItem('lastLoginUsername', username);
      localStorage.setItem('currentUserIdentity', matchedUser.identity);
      
      if (matchedUser.id != null) {
        localStorage.setItem('userId', matchedUser.id);
      }
      localStorage.setItem('user', JSON.stringify(matchedUser));

      // 记住我逻辑
      const rememberedUserInfo = JSON.parse(localStorage.getItem('rememberedUserInfo')) || {};
      if (rememberChecked) {
        rememberedUserInfo[username] = {
          password,
          remember: true,
          identity: matchedUser.identity
        };
      } else {
        if (rememberedUserInfo[username]) delete rememberedUserInfo[username];
      }
      localStorage.setItem('rememberedUserInfo', JSON.stringify(rememberedUserInfo));

      // 统一跳转到我们新做的用户中心
      navigate('/user');

    } catch (err) {
      // 本地测试防报错：如果没有跑后端，可以取消下面两行的注释假装登录成功
      // localStorage.setItem('token', 'fake-token'); navigate('/user'); return;
      message.error('登录失败：' + err.message);
    }
  };

  // 监听用户名变化逻辑 (完全保留)
  const handleUsernameChange = (val) => {
    setUsername(val);
    if (!val) return;
    
    const rememberedUserInfo = JSON.parse(localStorage.getItem('rememberedUserInfo')) || {};
    const userRememberInfo = rememberedUserInfo[val];
    
    if (userRememberInfo) {
      setPassword(userRememberInfo.password);
      setRememberChecked(true);
    } else {
      setPassword('');
      setRememberChecked(false);
    }
  };

  // 页面加载自动填充逻辑 (完全保留)
  useEffect(() => {
    const lastLoginUsername = localStorage.getItem('lastLoginUsername');
    if (lastLoginUsername) {
      setUsername(lastLoginUsername);
      const rememberedUserInfo = JSON.parse(localStorage.getItem('rememberedUserInfo')) || {};
      const userRememberInfo = rememberedUserInfo[lastLoginUsername];
      
      if (userRememberInfo) {
        setPassword(userRememberInfo.password);
        setRememberChecked(true);
      } else {
        setPassword('');
        setRememberChecked(false);
      }
    }
  }, []);

  return (
    <div className={`min-h-screen ${colors.baseBg} flex items-center justify-center p-4 font-sans`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-md ${colors.cardBg} rounded-3xl shadow-[0_20px_60px_rgba(58,55,50,0.08)] p-8 md:p-10 border ${colors.border}`}
      >
        {/* 顶部图标与标题 */}
        <div className="text-center mb-10">
          <div className={`w-16 h-16 mx-auto ${colors.baseBg} rounded-full flex items-center justify-center mb-4 border ${colors.border}`}>
            <Sparkles className={colors.accentGoldText} size={28} />
          </div>
          <h1 className={`text-3xl font-bold ${colors.textMain} font-serif tracking-widest`}>非遗数字平台</h1>
          <p className={`${colors.textSub} mt-2 font-light`}>欢迎登录</p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            {/* 用户名输入框 */}
            <div className="relative group">
              <User className={`absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:${colors.accentGoldText} transition-colors`} size={20} />
              <input 
                type="text" 
                placeholder="请输入用户名" 
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                className={`w-full pl-12 pr-4 py-3.5 bg-[#f8f6f1] rounded-xl outline-none focus:ring-2 focus:ring-[#b89259]/50 focus:bg-white transition-all ${colors.textMain} border border-transparent focus:border-[#b89259]/30`}
                required
              />
            </div>

            {/* 密码输入框 */}
            <div className="relative group">
              <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:${colors.accentGoldText} transition-colors`} size={20} />
              <input 
                type="password" 
                placeholder="请输入密码" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-12 pr-4 py-3.5 bg-[#f8f6f1] rounded-xl outline-none focus:ring-2 focus:ring-[#b89259]/50 focus:bg-white transition-all ${colors.textMain} border border-transparent focus:border-[#b89259]/30`}
                required
              />
            </div>
          </div>

          {/* 记住我 & 忘记密码 */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  checked={rememberChecked}
                  onChange={(e) => setRememberChecked(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#b89259] focus:ring-[#b89259] transition-all cursor-pointer"
                />
              </div>
              <span className={`${colors.textSub} group-hover:${colors.textMain} transition-colors`}>记住我</span>
            </label>
            <button type="button" className={`${colors.accentGoldText} hover:underline`}>
              忘记密码？
            </button>
          </div>

          {/* 登录按钮 */}
          <button 
            type="submit" 
            className={`w-full py-4 ${colors.accentGold} hover:bg-[#a6824c] text-white rounded-xl font-medium tracking-widest shadow-lg shadow-[#b89259]/25 hover:shadow-[#b89259]/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2`}
          >
            登 录 <ArrowRight size={18} />
          </button>

          {/* 注册跳转 */}
          <div className={`text-center ${colors.textSub} text-sm pt-4 border-t ${colors.border}`}>
            还没有账号？ 
            <button 
              type="button" 
              onClick={() => navigate('/register')} 
              className={`${colors.accentGoldText} font-medium hover:underline ml-1`}
            >
              立即注册
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;