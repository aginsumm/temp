import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Network,
  Layers,
  ArrowRight,
  BookOpen,
  Users,
  Award,
  ChevronDown,
  Play,
  Star,
  Globe,
  Zap,
  Shield,
  TrendingUp,
  Image as ImageIcon,
} from 'lucide-react';
import HeritageImages from '../../assets/heritage-images';
import { useThemeStore } from '../../stores/themeStore';
import { getThemeVisual } from '../../config/themes/heritageThemes';
import '../../styles/heritage.css';
import '../../styles/theme-patterns.css';

const floatingElements = [
  { icon: '🎭', delay: 0, x: '10%', y: '20%' },
  { icon: '🎨', delay: 0.5, x: '85%', y: '15%' },
  { icon: '🏺', delay: 1, x: '75%', y: '70%' },
  { icon: '🎪', delay: 1.5, x: '15%', y: '75%' },
  { icon: '🎵', delay: 2, x: '50%', y: '10%' },
  { icon: '📖', delay: 2.5, x: '90%', y: '45%' },
];

const features = [
  {
    icon: MessageSquare,
    title: '非遗智能问答',
    description: '基于大语言模型的智能对话系统，为您提供专业的非遗知识解答与创意辅助',
    link: '/chat',
    gradient: 'linear-gradient(135deg, #c41e3a 0%, #8b0000 100%)',
    bgGlow: 'rgba(196, 30, 58, 0.25)',
    stats: '10万+ 问答',
    badge: 'AI驱动',
  },
  {
    icon: Network,
    title: '非遗知识图谱',
    description: '可视化展示非遗知识网络，探索文化传承的脉络与关联关系',
    link: '/knowledge',
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    bgGlow: 'rgba(59, 130, 246, 0.25)',
    stats: '5000+ 节点',
    badge: '可视化',
  },
  {
    icon: ImageIcon,
    title: '非遗文创生成',
    description: '智能识别和提取非遗元素，助力文化研究与文创产品设计',
    link: '/extract',
    gradient: 'linear-gradient(135deg, #daa520 0%, #b8860b 100%)',
    bgGlow: 'rgba(218, 165, 32, 0.25)',
    stats: '100+ 类型',
    badge: 'AIGC',
  },
];

const stats = [
  { icon: BookOpen, value: '1000+', label: '非遗项目', trend: '+12%', color: '#c41e3a' },
  { icon: Users, value: '500+', label: '传承人', trend: '+8%', color: '#1e3a8a' },
  { icon: Award, value: '100+', label: '技艺分类', trend: '+5%', color: '#daa520' },
  { icon: Globe, value: '50+', label: '文化区域', trend: '+3%', color: '#228b22' },
];

const highlights = [
  {
    icon: Zap,
    title: '极速响应',
    description: '毫秒级智能响应',
    gradient: 'linear-gradient(135deg, #f59e0b, #ea580c)',
  },
  {
    icon: Shield,
    title: '权威数据',
    description: '官方认证信息源',
    gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  },
  {
    icon: TrendingUp,
    title: '持续更新',
    description: '实时扩充知识库',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
  },
];

const heritageGallery = HeritageImages();

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 100, damping: 20, duration: 0.6 },
  },
};

export default function Homepage() {
  const { currentTheme, themeId } = useThemeStore();
  const visual = useMemo(() => {
    if (currentTheme?.visual) {
      return currentTheme.visual;
    }
    return getThemeVisual(themeId || 'ink-wash');
  }, [currentTheme, themeId]);

  useEffect(() => {
    const handleScroll = () => {};
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const particleCount = visual.particles.enabled ? visual.particles.count : 12;

  return (
    <div className="min-h-[calc(100vh-64px)] overflow-x-hidden">
      {/* Hero Section - 非遗建筑背景 */}
      <section className="relative min-h-[95vh] flex items-center justify-center py-20 px-4 overflow-hidden hero-heritage-bg">
        {/* 古建筑轮廓剪影 */}
        <div className="building-silhouette" />

        {/* 古风云纹装饰 */}
        <div className="cloud-pattern" style={{ top: '10%', left: '5%' }} />
        <div className="cloud-pattern" style={{ top: '60%', right: '8%', animationDelay: '-5s' }} />
        <div
          className="cloud-pattern"
          style={{ bottom: '20%', left: '15%', animationDelay: '-10s' }}
        />

        {/* 金色粒子特效 */}
        {[...Array(particleCount)].map((_, i) => (
          <div
            key={i}
            className="golden-particle"
            style={{
              left: `${10 + i * (80 / particleCount)}%`,
              top: `${15 + ((i * 13) % 70)}%`,
              animationDelay: `${i * 0.7}s`,
              width: `${visual.particles.size + Math.random() * 2}px`,
              height: `${visual.particles.size + Math.random() * 2}px`,
            }}
          />
        ))}

        {/* 动态光晕效果 */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.15, 0.35, 0.15],
              x: [0, 50, 0],
              y: [0, -30, 0],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(218,165,32,0.4), transparent 70%)' }}
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.15, 0.3, 0.15],
              x: [0, -40, 0],
              y: [0, 40, 0],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 3,
            }}
            className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(196,30,58,0.35), transparent 70%)' }}
          />
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.25, 0.1],
              x: [0, 30, 0],
              y: [0, -20, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1.5,
            }}
            className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.3), transparent 70%)' }}
          />
        </div>

        {/* 浮动图标 */}
        {floatingElements.map((el, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0.5, 0.9, 0.5],
              scale: [1, 1.25, 1],
              y: [0, -25, 0],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 5 + index * 0.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: el.delay,
            }}
            className="absolute text-5xl pointer-events-none z-10 drop-shadow-lg"
            style={{
              left: el.x,
              top: el.y,
              filter: 'drop-shadow(0 4px 8px rgba(218,165,32,0.3))',
              cursor: 'pointer',
            }}
            whileHover={{ scale: 1.3, rotate: 15, y: el.y - 35 }}
          >
            {el.icon}
          </motion.div>
        ))}

        {/* 主要内容 - 左右布局 */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-20 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          {/* 左侧内容 */}
          <div className="text-center lg:text-left">
            {/* 标题徽章 */}
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center gap-3 px-6 py-3 rounded-full mb-10 shadow-xl backdrop-blur-md lg:inline-flex"
              style={{
                background: 'rgba(250,249,246,0.15)',
                border: '2px solid rgba(218,165,32,0.4)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              >
                <Star size={18} style={{ color: '#ffd700' }} fill="#ffd700" />
              </motion.div>
              <span
                className="text-base font-semibold tracking-wider"
                style={{ color: '#faf9f6', fontFamily: "'Noto Serif SC', serif" }}
              >
                非遗数字生命互动引擎
              </span>
              <span
                className="seal-badge text-xs px-3 py-1 ml-2"
                style={{
                  background: 'rgba(196,30,58,0.9)',
                  borderColor: '#c41e3a',
                  color: '#fff',
                }}
              >
                v2.0
              </span>
            </motion.div>

            {/* 主标题 */}
            <motion.h1
              variants={itemVariants}
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 leading-tight tracking-wide"
              style={{ fontFamily: "'Noto Serif SC', serif", color: '#faf9f6' }}
            >
              面向地方志与非遗文化的
              <br />
              <motion.span
                className="inline-block mt-2"
                style={{
                  background: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 50%, #daa520 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 2px 8px rgba(218,165,32,0.4))',
                  textShadow: 'none',
                }}
              >
                智能检索、问答与创意辅助平台
              </motion.span>
            </motion.h1>

            {/* 副标题描述 */}
            <motion.p
              variants={itemVariants}
              className="text-lg md:text-xl max-w-2xl mx-auto lg:mx-0 mb-14 leading-relaxed font-light tracking-wide"
              style={{ color: 'rgba(250,249,246,0.88)', fontFamily: "'Noto Sans SC', sans-serif" }}
            >
              面向地方志与非遗文化的智能检索、问答与创意辅助平台
            </motion.p>

            {/* CTA按钮组 */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-5"
            >
              <Link to="/chat" className="group block w-full sm:w-auto">
                <motion.div
                  whileHover={{ scale: 1.06, y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-center gap-3 px-10 py-5 rounded-2xl font-bold text-lg shadow-2xl relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #c41e3a 0%, #8b0000 100%)',
                    color: '#fff',
                    boxShadow:
                      '0 15px 50px -10px rgba(196,30,58,0.6), inset 0 1px 0 rgba(255,255,255,0.2)',
                    letterSpacing: '1px',
                  }}
                >
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Play size={22} fill="currentColor" />
                  </motion.div>
                  立即体验问答
                  <motion.div
                    animate={{ x: [0, 6, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ArrowRight size={22} />
                  </motion.div>
                  {/* 按钮光泽效果 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 translate-x-[-100%] group-hover:translate-x-[100%] transition-all duration-700" />
                  {/* 光晕效果 */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      background: 'radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%)',
                      opacity: 0,
                    }}
                    whileHover={{ opacity: 1, scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5 }}
                  />
                </motion.div>
              </Link>

              <Link to="/knowledge" className="group block w-full sm:w-auto">
                <motion.div
                  whileHover={{ scale: 1.06, y: -4 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-center gap-3 px-10 py-5 rounded-2xl font-bold text-lg backdrop-blur-md"
                  style={{
                    background: 'rgba(250,249,246,0.12)',
                    color: '#faf9f6',
                    border: '2px solid rgba(218,165,32,0.5)',
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.3)',
                    letterSpacing: '1px',
                  }}
                >
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  >
                    <Network size={22} />
                  </motion.div>
                  检索知识图谱
                  {/* 边框光效 */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(218,165,32,0.2), transparent 50%, rgba(218,165,32,0.2))',
                      opacity: 0,
                    }}
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.div>
              </Link>
            </motion.div>
          </div>

          {/* 右侧六边形大图 */}
          <motion.div
            variants={itemVariants}
            className="relative flex items-center justify-center w-full"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: 'spring',
                delay: 0.6,
                stiffness: 200,
                damping: 15,
              }}
              className="relative w-full"
              whileHover={{ scale: 1.02 }}
            >
              {/* 六边形容器 */}
              <svg
                viewBox="0 0 400 440"
                className="w-full h-auto drop-shadow-2xl"
                style={{
                  filter: 'drop-shadow(0 25px 50px rgba(218,165,32,0.4))',
                  maxHeight: '80vh',
                }}
              >
                <defs>
                  {/* 六边形渐变背景 */}
                  <linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#daa520" stopOpacity="0.3" />
                    <stop offset="50%" stopColor="#c41e3a" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#8b4513" stopOpacity="0.3" />
                  </linearGradient>

                  {/* 六边形边框渐变 */}
                  <linearGradient id="hexBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffd700" />
                    <stop offset="50%" stopColor="#ffed4e" />
                    <stop offset="100%" stopColor="#daa520" />
                  </linearGradient>

                  {/* 内部图案 */}
                  <pattern
                    id="heritagePattern"
                    x="0"
                    y="0"
                    width="60"
                    height="60"
                    patternUnits="userSpaceOnUse"
                  >
                    <circle cx="30" cy="30" r="2" fill="rgba(255,215,0,0.15)" />
                    <path
                      d="M 30 15 L 35 25 L 45 30 L 35 35 L 30 45 L 25 35 L 15 30 L 25 25 Z"
                      fill="none"
                      stroke="rgba(255,215,0,0.1)"
                      strokeWidth="1"
                    />
                  </pattern>

                  {/* 发光效果 */}
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* 六边形主体 */}
                <polygon
                  points="200,20 370,120 370,320 200,420 30,320 30,120"
                  fill="url(#hexGrad)"
                  stroke="url(#hexBorderGrad)"
                  strokeWidth="3"
                  filter="url(#glow)"
                />

                {/* 图案层 */}
                <polygon
                  points="200,20 370,120 370,320 200,420 30,320 30,120"
                  fill="url(#heritagePattern)"
                  opacity="0.5"
                />

                {/* 古建筑剪影 */}
                <g transform="translate(200, 220)" opacity="0.4">
                  {/* 主建筑轮廓 */}
                  <path
                    d="M -80,-60 L -60,-90 L -40,-70 L -20,-95 L 0,-80 L 20,-105 L 40,-85 L 60,-110 L 80,-90 L 100,-65 L 100,80 L -100,80 Z"
                    fill="none"
                    stroke="#ffd700"
                    strokeWidth="2"
                    filter="url(#glow)"
                  />

                  {/* 屋檐装饰 */}
                  <line
                    x1="-90"
                    y1="-55"
                    x2="90"
                    y2="-55"
                    stroke="#ffd700"
                    strokeWidth="1.5"
                    opacity="0.6"
                  />
                  <line
                    x1="-85"
                    y1="-40"
                    x2="85"
                    y2="-40"
                    stroke="#ffd700"
                    strokeWidth="1"
                    opacity="0.4"
                  />

                  {/* 门 */}
                  <rect
                    x="-20"
                    y="20"
                    width="40"
                    height="60"
                    fill="none"
                    stroke="#daa520"
                    strokeWidth="2"
                    rx="3"
                  />
                  <circle cx="12" cy="52" r="3" fill="#ffd700" opacity="0.7" />

                  {/* 窗户 */}
                  <rect
                    x="-70"
                    y="-10"
                    width="25"
                    height="30"
                    fill="none"
                    stroke="#daa520"
                    strokeWidth="1.5"
                    rx="2"
                    opacity="0.6"
                  />
                  <rect
                    x="45"
                    y="-10"
                    width="25"
                    height="30"
                    fill="none"
                    stroke="#daa520"
                    strokeWidth="1.5"
                    rx="2"
                    opacity="0.6"
                  />

                  {/* 装饰云纹 */}
                  <g transform="translate(-60, -75)" opacity="0.5">
                    <path
                      d="M 0,0 Q 10,-10 20,0 Q 30,-10 40,0"
                      fill="none"
                      stroke="#ffd700"
                      strokeWidth="1.5"
                    />
                  </g>
                  <g transform="translate(30, -90)" opacity="0.5">
                    <path
                      d="M 0,0 Q 10,-10 20,0 Q 30,-10 40,0"
                      fill="none"
                      stroke="#ffd700"
                      strokeWidth="1.5"
                    />
                  </g>
                </g>

                {/* 浮动装饰元素 */}
                <g opacity="0.6">
                  <circle cx="100" cy="150" r="4" fill="#ffd700" filter="url(#glow)">
                    <animate
                      attributeName="opacity"
                      values="0.3;1;0.3"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle cx="300" cy="280" r="3" fill="#ffed4e" filter="url(#glow)">
                    <animate
                      attributeName="opacity"
                      values="0.5;1;0.5"
                      dur="2.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle cx="250" cy="130" r="5" fill="#daa520" filter="url(#glow)">
                    <animate
                      attributeName="opacity"
                      values="0.4;1;0.4"
                      dur="4s"
                      repeatCount="indefinite"
                      begin="0.5s"
                    />
                  </circle>
                  <circle cx="150" cy="330" r="3.5" fill="#ffd700" filter="url(#glow)">
                    <animate
                      attributeName="opacity"
                      values="0.6;1;0.6"
                      dur="3.5s"
                      repeatCount="indefinite"
                      begin="1.5s"
                    />
                  </circle>
                </g>

                {/* 边角装饰 */}
                <g stroke="#ffd700" strokeWidth="2" fill="none" opacity="0.7">
                  <path d="M 190,28 L 200,20 L 210,28" />
                  <path d="M 365,125 L 370,120 L 365,115" />
                  <path d="M 365,315 L 370,320 L 365,325" />
                  <path d="M 190,412 L 200,420 L 210,412" />
                  <path d="M 35,315 L 30,320 L 35,325" />
                  <path d="M 35,125 L 30,120 L 35,115" />
                </g>
              </svg>

              {/* 外部光晕效果 */}
              <div
                className="absolute inset-0 rounded-lg blur-3xl opacity-40 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(218,165,32,0.6), transparent 70%)',
                  transform: 'scale(1.2)',
                }}
              />
            </motion.div>
          </motion.div>

          {/* 特色亮点 */}
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-center gap-8 flex-wrap max-w-3xl mx-auto"
          >
            {highlights.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 + index * 0.15 }}
                className="flex items-center gap-3 px-5 py-3 rounded-xl backdrop-blur-sm"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
                  style={{
                    background: item.gradient,
                    boxShadow: `0 4px 15px ${item.bgGlow || 'rgba(0,0,0,0.2)'}`,
                  }}
                >
                  <item.icon size={20} style={{ color: '#fff' }} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold tracking-wide" style={{ color: '#faf9f6' }}>
                    {item.title}
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(250,249,246,0.65)' }}>
                    {item.description}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* 向下滚动指示器 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20"
        >
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-2 cursor-pointer"
            style={{ color: 'rgba(250,249,246,0.6)' }}
          >
            <span className="text-xs font-medium tracking-widest uppercase">向下探索</span>
            <ChevronDown size={24} strokeWidth={2.5} />
          </motion.div>
        </motion.div>
      </section>

      {/* 功能卡片区域 - 古风纯色背景 */}
      <section className="py-24 px-4 relative ancient-bg-solid ancient-texture">
        {/* 祥云纹样装饰条 */}
        <div className="xiangyun-pattern absolute top-0 left-0 right-0 h-16" />

        <div className="relative z-10 max-w-7xl mx-auto">
          {/* 区域标题 */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="text-center mb-18"
            style={{ marginBottom: '72px' }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-8 shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #daa520, #b8860b)',
                boxShadow: '0 15px 45px -10px rgba(218,165,32,0.5)',
              }}
            >
              <Layers size={36} style={{ color: '#fff' }} />
            </motion.div>

            <h2
              className="text-4xl md:text-5xl font-bold mb-5 tracking-wide"
              style={{
                color: '#2c1810',
                fontFamily: "'Noto Serif SC', serif",
              }}
            >
              核心功能模块
            </h2>
            <p
              className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
              style={{ color: '#6b4423' }}
            >
              三大核心模块，全方位探索非遗文化的智慧殿堂
            </p>
          </motion.div>

          {/* 功能卡片网格 */}
          <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 60, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{
                  delay: index * 0.2,
                  type: 'spring',
                  stiffness: 100,
                  damping: 15,
                }}
              >
                <Link to={feature.link} className="block h-full group">
                  <motion.div
                    whileHover={{ y: -12, scale: 1.03 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="h-full rounded-3xl overflow-hidden heritage-card-shadow traditional-border"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,249,246,0.95) 100%)',
                      minHeight: '380px',
                    }}
                  >
                    {/* 卡片顶部渐变区域 */}
                    <div
                      className="relative h-48 flex items-center justify-center overflow-hidden"
                      style={{ background: feature.gradient }}
                    >
                      {/* 光泽效果 */}
                      <div
                        className="absolute inset-0 opacity-30"
                        style={{
                          background:
                            'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 70%)',
                        }}
                      />

                      {/* 图标容器 */}
                      <motion.div
                        whileHover={{ scale: 1.15, rotate: 8 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                        className="relative w-24 h-24 rounded-2xl flex items-center justify-center shadow-2xl"
                        style={{
                          background: 'rgba(255,255,255,0.25)',
                          backdropFilter: 'blur(15px)',
                          border: '2px solid rgba(255,255,255,0.35)',
                          boxShadow: '0 15px 45px -10px rgba(0,0,0,0.3)',
                        }}
                      >
                        <feature.icon
                          size={44}
                          style={{
                            color: '#fff',
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                          }}
                        />
                      </motion.div>

                      {/* 徽章标签 */}
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileHover={{ opacity: 1, x: 0 }}
                        className="absolute top-5 right-5 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-lg"
                        style={{
                          background: 'rgba(255,255,255,0.25)',
                          color: '#fff',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255,255,255,0.3)',
                          letterSpacing: '1px',
                        }}
                      >
                        {feature.badge}
                      </motion.div>

                      {/* 统计数据 */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileHover={{ opacity: 1, y: 0 }}
                        className="absolute bottom-5 left-5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md"
                        style={{
                          background: 'rgba(0,0,0,0.2)',
                          color: '#fff',
                          backdropFilter: 'blur(8px)',
                        }}
                      >
                        {feature.stats}
                      </motion.div>
                    </div>

                    {/* 卡片内容区 */}
                    <div className="p-7 lg:p-8">
                      <h3
                        className="text-2xl font-bold mb-4 group-hover:text-primary transition-colors duration-300"
                        style={{
                          color: '#2c1810',
                          fontFamily: "'Noto Serif SC', serif",
                        }}
                      >
                        {feature.title}
                      </h3>
                      <p className="text-base leading-relaxed mb-6" style={{ color: '#6b4423' }}>
                        {feature.description}
                      </p>

                      {/* CTA链接 */}
                      <motion.div
                        initial={{ opacity: 0, x: -15 }}
                        whileHover={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2.5 text-base font-semibold pt-4 border-t-2"
                        style={{
                          color: feature.gradient.includes('c41e')
                            ? '#c41e3a'
                            : feature.gradient.includes('3a8a')
                              ? '#1e3a8a'
                              : '#daa520',
                          borderColor: 'rgba(139,69,19,0.1)',
                        }}
                      >
                        <span>立即体验</span>
                        <motion.div
                          animate={{ x: [0, 6, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <ArrowRight size={18} strokeWidth={2.5} />
                        </motion.div>
                      </motion.div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 数据统计区域 */}
      <section className="py-24 px-4 relative overflow-hidden ancient-bg-solid">
        <div className="huiwen-pattern absolute inset-0 opacity-40" />

        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-18"
            style={{ marginBottom: '72px' }}
          >
            <h2
              className="text-4xl md:text-5xl font-bold mb-5 tracking-wide"
              style={{
                color: '#2c1810',
                fontFamily: "'Noto Serif SC', serif",
              }}
            >
              平台数据概览
            </h2>
            <p className="text-lg md:text-xl" style={{ color: '#6b4423' }}>
              持续增长的文化资源库，守护千年文明瑰宝
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 40, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, type: 'spring', stiffness: 120 }}
                whileHover={{ y: -10, scale: 1.05 }}
                className="traditional-border rounded-2xl p-6 text-center heritage-card-shadow"
              >
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.6 }}
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${stat.color}, ${stat.color}dd)`,
                    boxShadow: `0 8px 25px -5px ${stat.color}50`,
                  }}
                >
                  <stat.icon size={28} style={{ color: '#fff' }} />
                </motion.div>
                <div
                  className="text-3xl md:text-4xl font-bold mb-2 tracking-tight"
                  style={{
                    color: stat.color,
                    fontFamily: "'Noto Serif SC', serif",
                  }}
                >
                  {stat.value}
                </div>
                <div className="text-sm font-medium mb-2" style={{ color: '#2c1810' }}>
                  {stat.label}
                </div>
                <div
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: `${stat.color}15`,
                    color: stat.color,
                  }}
                >
                  ↑ {stat.trend}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 非遗图片展示区域 - 5张图片 */}
      <section className="py-24 px-4 relative ancient-bg-solid ancient-texture">
        <div className="xiangyun-pattern absolute top-0 left-0 right-0 h-16 opacity-50" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-18"
            style={{ marginBottom: '72px' }}
          >
            <h2
              className="text-4xl md:text-5xl font-bold mb-5 tracking-wide"
              style={{
                color: '#2c1810',
                fontFamily: "'Noto Serif SC', serif",
              }}
            >
              非遗瑰宝展示
            </h2>
            <p
              className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
              style={{ color: '#6b4423' }}
            >
              昆曲之韵、苏绣之美、蜀锦之华、银花丝之精、川剧之魅
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 lg:gap-6">
            {heritageGallery.map((image, index) => (
              <motion.div
                key={image.id}
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{
                  delay: index * 0.12,
                  type: 'spring',
                  stiffness: 100,
                  damping: 15,
                }}
                className="heritage-gallery-item shadow-xl"
                style={{
                  aspectRatio: '1 / 1',
                }}
                whileHover={{
                  scale: 1.05,
                  boxShadow: '0 25px 60px rgba(92,64,51,0.35)',
                }}
              >
                {image.pattern}

                {/* 图片标题覆盖层 */}
                <div className="absolute bottom-0 left-0 right-0 p-4 z-10 opacity-0 hover:opacity-100 transition-all duration-300 transform translate-y-2 hover:translate-y-0">
                  <h3
                    className="text-lg font-bold text-white tracking-wide"
                    style={{
                      fontFamily: "'Noto Serif SC', serif",
                      textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    }}
                  >
                    {image.name}
                  </h3>
                  <p className="text-xs text-white/80 mt-1">点击了解更多</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 底部CTA区域 */}
      <section className="py-24 px-4 relative hero-heritage-bg overflow-hidden">
        <div className="building-silhouette" />

        {[...Array(Math.min(particleCount, 8))].map((_, i) => (
          <div
            key={i}
            className="golden-particle"
            style={{
              left: `${5 + i * 12}%`,
              top: `${20 + ((i * 17) % 60)}%`,
              animationDelay: `${i * 0.9}s`,
              width: `${visual.particles.size + Math.random() * 2}px`,
              height: `${visual.particles.size + Math.random() * 2}px`,
            }}
          />
        ))}

        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <motion.h2
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 leading-tight tracking-wide"
              style={{
                color: '#faf9f6',
                fontFamily: "'Noto Serif SC', serif",
              }}
            >
              开启您的非遗探索之旅
            </motion.h2>

            <motion.p
              className="text-lg md:text-xl mb-12 leading-relaxed font-light"
              style={{ color: 'rgba(250,249,246,0.88)' }}
            >
              让我们一起用科技的力量，守护和传承中华民族的文化瑰宝
            </motion.p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <Link to="/chat" className="block w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.06, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full px-12 py-5 rounded-2xl font-bold text-lg shadow-2xl tracking-wide"
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #daa520)',
                    color: '#2c1810',
                    boxShadow: '0 15px 50px -10px rgba(218,165,32,0.6)',
                    letterSpacing: '1px',
                  }}
                >
                  开始探索
                  <ArrowRight size={20} className="inline-block ml-2" />
                </motion.button>
              </Link>

              <Link to="/knowledge" className="block w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.06, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full px-12 py-5 rounded-2xl font-bold text-lg backdrop-blur-md tracking-wide"
                  style={{
                    background: 'rgba(250,249,246,0.12)',
                    color: '#faf9f6',
                    border: '2px solid rgba(218,165,32,0.5)',
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.3)',
                    letterSpacing: '1px',
                  }}
                >
                  浏览知识图谱
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
