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

import HeadBgImage from './head-bg_light.png';
import TitleImage from './title_light.png';
import Bg1Image from './bg_1.png';     
import Card01Image from './card_01.png';

// 引入背景图
import Bg4Image from './bg-4.png';
// 引入五大瑰宝的真实图片
import KunquImg from './image_01_kunqu.png';
import SuxiuImg from './image_02_suxiu.png';
import ShujinImg from './image_03_shujin.png';
import YinhuasiImg from './image_04_yinhuasi.png';
import ChuanjuImg from './image_05_chuanju.png';

const features = [
  {
    icon: MessageSquare,
    title: '非遗智能问答',
    description: '基于大语言模型的智能对话系统，为您提供专业的非遗知识解答与创意辅助',
    link: '/chat',
    image: Card01Image,
    pattern: <div className="absolute top-0 left-0 xiangyun-pattern w-24 h-24 opacity-10" />
  },
  {
    icon: Network,
    title: '非遗知识图谱',
    description: '可视化展示非遗知识网络，探索文化传承的脉络与关联关系',
    link: '/knowledge',
    image: Card01Image,
    pattern: <div className="absolute bottom-0 right-0 huiwen-pattern w-24 h-24 opacity-10" />
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

const cultureShowcase = [
  { id: 1, name: '昆曲之韵', img: KunquImg },
  { id: 2, name: '苏绣之美', img: SuxiuImg },
  { id: 3, name: '蜀锦之华', img: ShujinImg },
  { id: 4, name: '银花丝之精', img: YinhuasiImg },
  { id: 5, name: '川剧之魅', img: ChuanjuImg },
];

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
      {/* 🚀 第 1 屏修改区：全屏背景图 + 居中标题图 */}
      <section className="relative min-h-[95vh] flex items-center justify-center py-20 px-4 overflow-hidden">
        
        {/* 1. 全屏背景图 */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: `url(${HeadBgImage})`,
            backgroundColor: '#1a1a1a', // 图片加载前的默认底色
          }}
        >
          {/* 添加一层黑色遮罩，确保上面的按钮和图片能看清楚（可调节透明度 0.4） */}
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px]" />
        </div>

        {/* 金色粒子特效 (保留) */}
        <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
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
        </div>

        {/* 主要内容 - 居中布局 */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-20 max-w-5xl mx-auto flex flex-col items-center text-center"
        >
          {/* 2. 标题图 (替代原来的纯文字 <h1>) */}
          <motion.img
            variants={itemVariants}
            src={TitleImage}
            alt="非遗数字生命互动引擎"
            className="w-full max-w-[800px] mb-6 drop-shadow-2xl"
            style={{
              filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.6))',
            }}
          />

          {/* 副标题描述 */}
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl max-w-2xl mx-auto mb-14 leading-relaxed font-light tracking-wide text-white/90 drop-shadow-md"
            style={{ fontFamily: "'Noto Sans SC', sans-serif" }}
          >
            面向地方志与非遗文化的智能检索、问答与创意辅助平台
          </motion.p>

          {/*CTA按钮组 -*/}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full"
          >
            <Link to="/chat" className="group block w-full sm:w-auto">
              <motion.div
                whileHover={{ scale: 1.06, y: -4 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-3 px-10 py-5 rounded-2xl font-bold text-lg shadow-2xl relative overflow-hidden"
                style={{
                 background: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)', 
                  color: '#fff',
                  boxShadow: '0 15px 50px -10px rgba(20,184,166,0.8), inset 0 1px 0 rgba(255,255,255,0.2)', 
                  letterSpacing: '1px',
                }}
              >
                <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
                  <Play size={22} fill="currentColor" />
                </motion.div>
                立即体验问答
                <motion.div animate={{ x: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <ArrowRight size={22} />
                </motion.div>
                {/* 按钮光泽效果 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 translate-x-[-100%] group-hover:translate-x-[100%] transition-all duration-700" />
                {/* 光晕效果 */}
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%)', opacity: 0 }}
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
                  background: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)', // 纯正青绿色渐变
                  color: '#fff',
                  boxShadow: '0 15px 50px -10px rgba(20,184,166,0.8), inset 0 1px 0 rgba(255,255,255,0.2)', // 统一青色发光阴影
                  letterSpacing: '1px',
                }}
              >
                <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}>
                  <Network size={22} />
                </motion.div>
                检索知识图谱
               <motion.div
                  className="absolute inset-0 rounded-2xl"
                  /* 光晕换成青色 */
                  style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.3), transparent 50%, rgba(20,184,166,0.3))', opacity: 0 }} 
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.div>
            </Link>
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
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            <span className="text-xs font-medium tracking-widest uppercase">向下探索</span>
            <ChevronDown size={24} strokeWidth={2.5} />
          </motion.div>
        </motion.div>
      </section>

    {/* 🚀 核心功能区域 - 真实图片背景 + 海报式卡片 */}
      <section className="relative py-24 px-4 min-h-[80vh] flex items-center justify-center overflow-hidden">
        
        {/* 背景图 Bg1Image */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${Bg1Image})` }}
        >
          <div className="absolute inset-0 bg-white/20" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          
          {/* 标题部分 */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="text-center mb-16"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-8 shadow-2xl"
              style={{ background: 'linear-gradient(135deg, #14b8a6, #0f766e)' }}
            >
              <Layers size={36} style={{ color: '#fff' }} />
            </motion.div>
            <h2 className="text-4xl md:text-5xl font-bold mb-5 tracking-wide" style={{ color: '#2c1810', fontFamily: "'Noto Serif SC', serif" }}>
              核心功能模块
            </h2>
            <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: '#6b4423' }}>
              两大核心模块，全方位探索非遗文化的智慧殿堂
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 max-w-5xl mx-auto gap-10 justify-center">
           {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 60, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, type: 'spring' }}
                className="w-full flex justify-center"
              >
                <Link to={feature.link} className="block w-full group">
                  
                  {/* 【核心修改】：卡片变小(h-[380px])，内容设为垂直居中(justify-center)，文字居中(text-center) */}
                  <motion.div
                    whileHover={{ y: -8, scale: 1.02 }}
                    className="relative w-full h-[350px] lg:h-[380px] rounded-3xl overflow-hidden shadow-xl flex flex-col items-center justify-center text-center p-8 lg:p-10 traditional-border"
                    style={{ background: '#fff' }} // 纯白底色，原生展示Card01Image
                  >
                    
                    {/* 1. 纯净底图 */}
                    <div 
                      className="absolute inset-0 z-0 bg-center bg-no-repeat bg-[length:100%_100%] transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url(${feature.image})` }}
                    />
                    
                    {/* 数据源里配的淡淡的古风图案（祥云或回纹），填充角落空白 */}
                    {feature.pattern}

                    {/* 2. 内容排版：全部居中 */}
                    <div className="relative z-10 flex flex-col items-center w-full">
                      
                      {/* 【核心修改】：精致、克制的图标。位置上抬，尺寸缩小，改为更通透的玻璃质感 */}
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 10 }}
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm"
                        style={{
                          // 改为通透的毛玻璃背景，不穿衣服，直接浮在 Card01Image 上
                          background: 'rgba(13,148,136,0.1)', 
                          backdropFilter: 'blur(4px)',
                          border: '1px solid rgba(13,148,136,0.2)',
                        }}
                      >
                        {/* 图标尺寸从大号缩小为中号 (32) */}
                        <feature.icon size={32} style={{ color: '#0d9488' }} strokeWidth={2} />
                      </motion.div>

                      {/* 标题：尺寸缩小为 text-2xl */}
                      <h3 
                        className="text-2xl font-bold mb-3 transition-colors duration-300 group-hover:text-[#0d9488]"
                        style={{ fontFamily: "'Noto Serif SC', serif", color: '#2c1810' }}
                      >
                        {feature.title}
                      </h3>
                      
                      {/* 描述：尺寸缩小为 text-sm */}
                      <p className="text-base mb-7 leading-relaxed max-w-sm" style={{ color: '#6b4423' }}>
                        {feature.description}
                      </p>
                      
                      {/* CTA 链接：居中对齐 */}
                      <div className="flex items-center gap-2 text-[#0d9488] font-bold text-base border-b-2 border-transparent hover:border-[#0d9488] pb-1 transition-all">
                        <span>立即体验</span>
                        <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                          <ArrowRight size={18} strokeWidth={2.5} />
                        </motion.div>
                      </div>
                      
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
          
        </div>
      </section>


      {/* 🚀 第 4 块：非遗瑰宝展示 - 真实图片版 */}
      <section className="py-24 px-4 relative overflow-hidden flex items-center justify-center min-h-[70vh]">
        
        {/* 背景图 Bg4Image - 保持高清 */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${Bg4Image})` }}
        >
          <div className="absolute inset-0 bg-white/10" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          {/* 区域标题 (文字保留你的原版) */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2
              className="text-4xl md:text-5xl font-bold mb-5 tracking-wide"
              style={{ color: '#2c1810', fontFamily: "'Noto Serif SC', serif" }}
            >
              非遗瑰宝展示
            </h2>
            <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: '#6b4423' }}>
              昆曲之韵、苏绣之美、蜀锦之华、银花丝之精、川剧之魅
            </p>
          </motion.div>

          {/* 五张图片排版 - 使用 grid-cols-5 保证横向排列 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {cultureShowcase.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, type: 'spring', stiffness: 100 }}
                className="relative group aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl cursor-pointer"
              >
                {/* 1. 核心：展示你引入的文化图片 */}
                <img 
                  src={item.img} 
                  alt={item.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />

                {/* 2. 悬浮遮罩 & 文字 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-6">
                  <h3
                    className="text-xl font-bold text-white tracking-wide translate-y-4 group-hover:translate-y-0 transition-transform duration-500"
                    style={{ fontFamily: "'Noto Serif SC', serif" }}
                  >
                    {item.name}
                  </h3>
                  <div className="w-8 h-1 bg-[#14b8a6] mt-2 rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 底部CTA区域 */}
      <section className="py-24 px-4 relative overflow-hidden">
        {/* 这里使用同样的背景遮罩处理方式，确保一致性 */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/images/your-bg-placeholder.jpg')", 
            backgroundColor: '#1a1a1a', 
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />
        </div>

        {[...Array(Math.min(particleCount, 8))].map((_, i) => (
          <div
            key={i}
            className="golden-particle z-10"
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
                    background: 'rgba(0,0,0,0.4)',
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