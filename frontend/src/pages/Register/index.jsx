import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Lock, Mail, ArrowRight, Sparkles, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../components/common/Toast';

export default function Register() {
  const navigate = useNavigate();
  const toast = useToast();

  const { register, checkBackendStatus, isLoading, error, setError, backendAvailable } =
    useAuthStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checkingBackend, setCheckingBackend] = useState(true);

  const colors = {
    baseBg: 'bg-[#f8f6f1]',
    cardBg: 'bg-[#ffffff]',
    accentGold: 'bg-[#b89259]',
    accentGoldText: 'text-[#b89259]',
    textMain: 'text-[#3a3732]',
    textSub: 'text-[#7a756b]',
    border: 'border-[#ebe5d9]',
  };

  useEffect(() => {
    const checkStatus = async () => {
      setCheckingBackend(true);
      await checkBackendStatus();
      setCheckingBackend(false);
    };
    checkStatus();
  }, [checkBackendStatus]);

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.warning('请输入用户名');
      return;
    }

    if (username.length < 1) {
      toast.warning('用户名至少需要1个字符');
      return;
    }

    if (password.length < 6) {
      toast.warning('密码至少需要6个字符');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }

    const result = await register(username, password);

    if (result.success) {
      toast.success('注册成功', '欢迎加入非遗数字平台');
      setTimeout(() => navigate('/login'), 800);
    } else {
      toast.error('注册失败', result.error || '注册失败，请重试');
    }
  };

  return (
    <div className={`min-h-screen ${colors.baseBg} flex items-center justify-center p-4 font-sans`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-md ${colors.cardBg} rounded-3xl shadow-[0_20px_60px_rgba(58,55,50,0.08)] p-8 md:p-10 border ${colors.border}`}
      >
        <div className="text-center mb-8">
          <div
            className={`w-16 h-16 mx-auto ${colors.baseBg} rounded-full flex items-center justify-center mb-4 border ${colors.border}`}
          >
            <Sparkles className={colors.accentGoldText} size={28} />
          </div>
          <h1 className={`text-3xl font-bold ${colors.textMain} font-serif tracking-widest`}>
            创建账号
          </h1>
          <p className={`${colors.textSub} mt-2 font-light`}>开启您的非遗探索之旅</p>

          <AnimatePresence mode="wait">
            {checkingBackend ? (
              <motion.div
                key="checking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-2 mt-4 text-sm"
              >
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span className={colors.textSub}>检测服务器状态...</span>
              </motion.div>
            ) : (
              <motion.div
                key="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`flex items-center justify-center gap-2 mt-4 text-sm ${
                  backendAvailable ? 'text-green-600' : 'text-amber-600'
                }`}
              >
                {backendAvailable ? (
                  <>
                    <Wifi className="w-4 h-4" />
                    <span>服务器在线 - 账号将同步到云端</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4" />
                    <span>离线模式 - 账号存储在本地</span>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="relative group">
            <User
              className={`absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:${colors.accentGoldText} transition-colors`}
              size={20}
            />
            <input
              type="text"
              required
              minLength={1}
              placeholder="设置用户名 (至少1个字符)"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              className={`w-full pl-12 pr-4 py-3.5 bg-[#f8f6f1] rounded-xl outline-none focus:ring-2 focus:bg-white transition-all ${colors.textMain} border border-transparent focus:ring-[#b89259]/50 focus:border-[#b89259]/30`}
              disabled={isLoading}
            />
          </div>

          <div>
            <div className="relative group">
              <Lock
                className={`absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:${colors.accentGoldText} transition-colors`}
                size={20}
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder="设置密码 (至少6个字符)"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className={`w-full pl-12 pr-4 py-3.5 bg-[#f8f6f1] rounded-xl outline-none focus:ring-2 focus:bg-white transition-all ${colors.textMain} border ${
                  password.length > 0 && password.length < 6
                    ? 'border-red-400 focus:ring-red-400/30'
                    : 'border-transparent focus:ring-[#b89259]/50 focus:border-[#b89259]/30'
                }`}
                disabled={isLoading}
              />
            </div>
            {password.length > 0 && password.length < 6 && (
              <p className="text-red-500 text-xs mt-1.5 ml-2 tracking-wider">密码至少6个字符</p>
            )}
          </div>

          <div>
            <div className="relative group">
              <Lock
                className={`absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:${colors.accentGoldText} transition-colors`}
                size={20}
              />
              <input
                type="password"
                required
                placeholder="请再次输入密码"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                className={`w-full pl-12 pr-4 py-3.5 bg-[#f8f6f1] rounded-xl outline-none focus:ring-2 focus:bg-white transition-all ${colors.textMain} border ${
                  confirmPassword.length > 0 && password !== confirmPassword
                    ? 'border-red-400 focus:ring-red-400/30'
                    : 'border-transparent focus:ring-[#b89259]/50 focus:border-[#b89259]/30'
                }`}
                disabled={isLoading}
              />
            </div>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-red-500 text-xs mt-1.5 ml-2 tracking-wider">
                两次输入的密码不一致
              </p>
            )}
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-sm text-center"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full mt-2 py-4 ${colors.accentGold} hover:bg-[#a6824c] disabled:bg-[#b89259]/50 disabled:cursor-not-allowed text-white rounded-xl font-medium tracking-widest shadow-lg shadow-[#b89259]/25 hover:shadow-[#b89259]/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                注册中...
              </>
            ) : (
              <>
                立即注册 <ArrowRight size={18} />
              </>
            )}
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
