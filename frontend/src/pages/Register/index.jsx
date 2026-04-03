import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd'; // 保留 antd 的全局提示
import { motion } from 'framer-motion';
import { User, Lock, ArrowRight, Sparkles } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  
  // 表单状态
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 雅致风配色
  const colors = {
    baseBg: "bg-[#f8f6f1]",
    cardBg: "bg-[#ffffff]",
    accentGold: "bg-[#b89259]",
    accentGoldText: "text-[#b89259]",
    textMain: "text-[#3a3732]",
    textSub: "text-[#7a756b]",
    border: "border-[#ebe5d9]"
  };

  // 注册提交逻辑
  const handleRegister = async (e) => {
    e.preventDefault(); // 阻止浏览器默认刷新

    // --- 强拦截：点击注册时，如果校验不通过，触发 antd 的顶部提示 ---
    if (password.length < 6) {
      message.warning('密码至少需要6个字符！');
      return;
    }
    if (password !== confirmPassword) {
      message.error('两次输入的密码不一致！');
      return;
    }

    try {
      // 接口请求 (只传账号和密码)
      const resp = await fetch('http://localhost:8000/api/v1/user/register', { // 修正路径
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }) 
      });
      const data = await resp.json();
      
      if (!resp.ok) {
        message.error(data.message || '注册失败，该用户名可能已存在！');
        return;
      }

      // 注册成功跳转
      message.success('注册成功！请登录');
      setTimeout(() => navigate('/login'), 1200);

    } catch (err) {
      // 网络等错误处理
      message.error('注册失败：' + err.message);
    }
  };

  return (
    <div className={`min-h-screen ${colors.baseBg} flex items-center justify-center p-4 font-sans`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-md ${colors.cardBg} rounded-3xl shadow-[0_20px_60px_rgba(58,55,50,0.08)] p-8 md:p-10 border ${colors.border}`}
      >
        <div className="text-center mb-10">
          <div className={`w-16 h-16 mx-auto ${colors.baseBg} rounded-full flex items-center justify-center mb-4 border ${colors.border}`}>
            <Sparkles className={colors.accentGoldText} size={28} />
          </div>
          <h1 className={`text-3xl font-bold ${colors.textMain} font-serif tracking-widest`}>创建账号</h1>
          <p className={`${colors.textSub} mt-2 font-light`}>开启您的非遗探索之旅</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-4">
            
            {/* 1. 用户名 */}
            <div>
              <div className="relative group">
                <User className={`absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:${colors.accentGoldText} transition-colors`} size={20} />
                <input 
                  type="text" 
                  required // 浏览器自带的必填校验
                  placeholder="设置用户名" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full pl-12 pr-4 py-3.5 bg-[#f8f6f1] rounded-xl outline-none focus:ring-2 focus:bg-white transition-all ${colors.textMain} border border-transparent focus:ring-[#b89259]/50 focus:border-[#b89259]/30`}
                />
              </div>
            </div>

            {/* 2. 密码 (自带实时长度校验) */}
            <div>
              <div className="relative group">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:${colors.accentGoldText} transition-colors`} size={20} />
                <input 
                  type="password" 
                  required 
                  minLength={6} // 浏览器自带的最小长度校验
                  placeholder="设置密码 (至少6个字符)" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  // 如果密码不满足长度，边框会变成红色警告
                  className={`w-full pl-12 pr-4 py-3.5 bg-[#f8f6f1] rounded-xl outline-none focus:ring-2 focus:bg-white transition-all ${colors.textMain} border ${
                    password.length > 0 && password.length < 6 
                      ? 'border-red-400 focus:ring-red-400/30' 
                      : 'border-transparent focus:ring-[#b89259]/50 focus:border-[#b89259]/30'
                  }`}
                />
              </div>
              {/* 实时红字提示 */}
              {password.length > 0 && password.length < 6 && (
                <p className="text-red-500 text-xs mt-1.5 ml-2 tracking-wider">密码至少6个字符！</p>
              )}
            </div>

            {/* 3. 确认密码 (自带实时一致性校验) */}
            <div>
              <div className="relative group">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:${colors.accentGoldText} transition-colors`} size={20} />
                <input 
                  type="password" 
                  required 
                  placeholder="请再次输入密码" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  // 如果两次密码不一致，边框变红
                  className={`w-full pl-12 pr-4 py-3.5 bg-[#f8f6f1] rounded-xl outline-none focus:ring-2 focus:bg-white transition-all ${colors.textMain} border ${
                    confirmPassword.length > 0 && password !== confirmPassword 
                      ? 'border-red-400 focus:ring-red-400/30' 
                      : 'border-transparent focus:ring-[#b89259]/50 focus:border-[#b89259]/30'
                  }`}
                />
              </div>
              {/* 实时红字提示 */}
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-red-500 text-xs mt-1.5 ml-2 tracking-wider">两次输入的密码不一致！</p>
              )}
            </div>

          </div>

          {/* 注册按钮 */}
          <button 
            type="submit" 
            className={`w-full mt-4 py-4 ${colors.accentGold} hover:bg-[#a6824c] text-white rounded-xl font-medium tracking-widest shadow-lg shadow-[#b89259]/25 hover:shadow-[#b89259]/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2`}
          >
            立即注册 <ArrowRight size={18} />
          </button>

          <div className={`text-center ${colors.textSub} text-sm pt-5 border-t ${colors.border}`}>
            已有账号？ 
            <button 
              type="button" 
              onClick={() => navigate('/login')} 
              className={`${colors.accentGoldText} font-medium hover:underline ml-1`}
            >
              返回登录
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}