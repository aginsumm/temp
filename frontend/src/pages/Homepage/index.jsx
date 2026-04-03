import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Network,
  Layers,
  ArrowRight,
  PlaySquare,
  Search,
  ChevronsRight
} from "lucide-react";

export default function Homepage() {
  // --- 雅致非遗风 颜色配置 (温润、低饱和) ---
  const colors = {
    baseBg: "bg-[#f8f6f1]", // 宣纸白/米白，极度护眼
    cardBg: "bg-[#ffffff]", // 卡片用纯白微微提亮
    accentGold: "bg-[#b89259]", // 秋香黄/雅金，替代刺眼的亮黄
    accentGoldText: "text-[#b89259]",
    accentGoldBorder: "border-[#b89259]",
    textMain: "text-[#3a3732]", // 深褐灰，比纯黑更柔和
    textSub: "text-[#7a756b]",  // 浅咖灰
    border: "border-[#ebe5d9]"  // 柔和的暖色分割线
  };

  const features = [
    {
      id: "chat",
      title: "非遗智能问答",
      description: "基于大语言模型，深度解析非遗技艺背后的历史文脉与传承故事。",
      link: "/chat",
      bgClass: "bg-[#f2efe9]", // 极浅的暖石色
    },
    {
      id: "knowledge",
      title: "非遗知识检索",
      description: "构建多维度的知识图谱，精准定位地方志与文化遗产文献。",
      link: "/knowledge",
      bgClass: "bg-[#f2efe9]",
    },
    {
      id: "extract",
      title: "非遗元素提取",
      description: "AI 智能识别纹样、色彩与形态，助力现代文创设计与再造。",
      link: "/extract",
      bgClass: "bg-[#f2efe9]",
    },
    {
      id: "portfolio",
      title: "个人作品记录",
      description: "建立专属的文化探索档案，记录您的每一次非遗创新与灵感。",
      link: "/profile",
      bgClass: "bg-[#f2efe9]",
    },
  ];

  const hotTopic = {
    title: "千年古韵：京剧艺术大赏数字化呈现",
    description: "深入了解京剧的行当、流派、脸谱艺术，带您领略国粹魅力。利用AI技术动态还原经典折子戏场景，探索千年技艺在数字时代的焕发新生",
    image: "https://images.unsplash.com/photo-1594911771141-86689d06852a?q=80&w=600&auto=format&fit=crop", 
    link: "/topic/peking-opera",
  };

  const latestResource = {
    title: "云冈石窟造像数字化修复图谱发布",
    description: "利用三维扫描与AI算法，精准还原云冈石窟造像，探索古老石刻的数字化重生。最新整理的高清图谱与口述史料，免费对研究者开放",
    image: "https://images.unsplash.com/photo-1619412586927-448f7d983058?q=80&w=600&auto=format&fit=crop", 
    link: "/resource/yungang-grottoes",
  };

  const bottomCards = [
    { title: "数字展厅", link: "/exhibition" },
    { title: "传承人库", link: "/masters" },
    { title: "素材中心", link: "/assets" },
    { title: "共创社区", link: "/community" }
  ];

  // --- 雅致版通用卡片组件 ---
  function ContentCard({ title, description, image, link }) {
    return (
      <div className={`flex flex-col md:flex-row gap-6 ${colors.cardBg} overflow-hidden p-6 md:p-8 hover:shadow-[0_15px_40px_rgba(184,146,89,0.08)] group transition-all border ${colors.border} rounded-2xl`}>
        <div className="md:w-3/5 space-y-4">
          <h3 className={`text-2xl font-bold ${colors.textMain} group-hover:${colors.accentGoldText} transition-colors duration-300`}>
            {title}
          </h3>
          <p className={`${colors.textSub} leading-relaxed font-light`}>
            {description}
          </p>
        </div>
        <div className="md:w-2/5 flex flex-col md:flex-row gap-4 items-stretch">
          <div className="flex-grow bg-[#f2efe9] rounded-xl overflow-hidden aspect-[4/3] md:aspect-[3/4] relative">
            <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100" />
            <div className="absolute inset-0 bg-[#3a3732]/5 group-hover:bg-transparent transition-colors duration-500" />
          </div>
          <Link to={link} className={`flex items-center justify-center p-4 bg-[#fcfbf9] hover:bg-[#b89259] text-[#7a756b] hover:text-white rounded-xl transition-all duration-300 shrink-0 border ${colors.border} hover:border-transparent`}>
            <span className="hidden md:inline writing-vertical font-medium tracking-wider text-sm" style={{ writingMode: 'vertical-rl' }}>点击跳转</span>
            <ArrowRight className="md:hidden" size={24} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${colors.baseBg} font-sans selection:bg-[#b89259]/20 selection:${colors.accentGoldText}`}>
      
      {/* 1. 首屏 Hero Section (米色底，温和的光晕) */}
      <section className={`relative overflow-hidden pt-24 pb-32 px-6 md:px-12 lg:px-24 flex items-center min-h-[75vh]`}>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[0%] left-[-10%] w-[50%] h-[60%] bg-[#b89259]/5 blur-[120px] rounded-full" />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="md:w-1/2 space-y-8"
          >
            <div className="space-y-2">
              {/* --- 修改点 1: 在这里给大标题添加了柔和的高级雅金阴影 --- */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-[#3a3732] font-serif [text-shadow:_0_4px_12px_rgba(184,146,89,0.25)]">
                非遗数字引擎
              </h1>
              {/* --- 修改点 2: 在这里给副标题添加了干净的浅灰阴影 --- */}
              <h2 className="text-3xl md:text-4xl font-light text-[#7a756b] [text-shadow:_0_2px_8px_rgba(0,0,0,0.1)]">
                文化与科技的交汇
              </h2>
            </div>
            
            {/* 边框使用雅金色 */}
            <p className="text-lg md:text-xl text-[#7a756b] font-light tracking-wide max-w-lg border-l-4 border-[#b89259]/60 pl-4">
              面向地方志与非遗文化的智能检索、问答与创意辅助平台
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                to="/chat"
                className={`flex items-center gap-2 px-8 py-4 bg-white hover:bg-[#faf8f5] ${colors.textMain} hover:${colors.accentGoldText} border ${colors.border} hover:${colors.accentGoldBorder} rounded-none transition-all group shadow-sm`}
              >
                <PlaySquare size={20} className={`group-hover:${colors.accentGoldText} transition-colors`} />
                <span className="font-medium tracking-wider">立即体验问答</span>
              </Link>
              <Link
                to="/knowledge"
                className={`flex items-center gap-2 px-8 py-4 ${colors.accentGold} hover:bg-[#a6824c] text-white shadow-[0_8px_20px_rgba(184,146,89,0.25)] rounded-none transition-all`}
              >
                <Search size={20} />
                <span className="font-medium tracking-wider">检索知识图谱</span>
              </Link>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="md:w-1/2 flex justify-center items-center relative"
          >
            {/* 极弱的背景光 */}
            <div className="absolute w-[320px] h-[320px] md:w-[420px] md:h-[420px] bg-[#b89259]/10 blur-3xl rounded-full" />
            
            <div 
              // 改为极度温润的宣纸质感渐变
              className="relative z-10 w-[280px] h-[320px] md:w-[380px] md:h-[430px] bg-gradient-to-br from-[#ffffff] to-[#eeeae1] shadow-[0_20px_40px_rgba(58,55,50,0.06)] flex items-center justify-center overflow-hidden border border-[#ffffff]"
              style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
            >
              <div className="text-[#a8a39a] font-medium tracking-widest opacity-80">
                [ 核心视觉图形占位 ]
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. 核心功能 2x2 网格 (降低了悬停时的亮度变化) */}
      <section className={`py-24 px-6 md:px-12 bg-white relative -mt-10 z-20 rounded-t-3xl border-t ${colors.border} shadow-[0_-10px_30px_rgba(58,55,50,0.02)]`}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
              >
                <Link
                  to={feature.link}
                  className={`block relative h-[280px] w-full p-8 overflow-hidden group ${feature.bgClass} hover:bg-[#f8f6f1] rounded-none border border-transparent hover:${colors.accentGoldBorder} transition-all duration-500`}
                >
                  <div className="relative z-10 h-full flex flex-col justify-end">
                    <h3 className={`text-3xl font-bold ${colors.textMain} mb-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300`}>
                      {feature.title}
                    </h3>
                    <p className={`${colors.textSub} font-light max-w-sm opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-100`}>
                      {feature.description}
                    </p>
                  </div>
                  
                  <div className={`absolute top-8 right-8 text-[#d1ccc0] group-hover:${colors.accentGoldText} transition-colors duration-300`}>
                    <ArrowRight size={32} className="-rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. 热门主题 Section (大幅降低圆形标签的攻击性) */}
      <section className={`py-20 px-6 md:px-12 ${colors.baseBg} border-t ${colors.border}`}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-10 items-center md:items-start">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            // 改为雅金底色，白色文字，柔和高级
            className={`flex-shrink-0 w-40 h-40 md:w-48 md:h-48 rounded-full ${colors.accentGold} flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 transition-all`}
          >
            <span className="text-3xl md:text-4xl font-bold text-white text-center leading-tight tracking-widest">热门<br />主题</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-grow w-full md:w-auto"
          >
            <ContentCard {...hotTopic} />
          </motion.div>
        </div>
      </section>

      {/* 4. 最新资料 Section */}
      <section className={`py-20 px-6 md:px-12 ${colors.cardBg} border-t ${colors.border}`}>
        <div className="max-w-6xl mx-auto flex flex-col-reverse md:flex-row gap-10 items-center md:items-start">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-grow w-full md:w-auto"
          >
            <ContentCard {...latestResource} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            // 浅石色底色，雅金文字
            className={`flex-shrink-0 w-40 h-40 md:w-48 md:h-48 rounded-full bg-[#f2efe9] flex items-center justify-center shadow-sm hover:shadow-md hover:scale-105 transition-all border ${colors.border}`}
          >
            <span className={`text-3xl md:text-4xl font-bold ${colors.accentGoldText} text-center leading-tight tracking-widest`}>最新<br />资料</span>
          </motion.div>
        </div>
      </section>

      {/* 5. 底部 4 个卡片 */}
      <section className={`py-16 px-6 md:px-12 ${colors.baseBg} pb-24 border-t ${colors.border}`}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {bottomCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link 
                to={card.link}
                // 极简温和的底部卡片
                className={`block aspect-square md:aspect-[4/3] bg-[#f2efe9] hover:bg-white border border-transparent hover:${colors.accentGoldBorder} hover:shadow-sm transition-all duration-300 rounded-xl flex items-center justify-center group`}
              >
                <span className={`text-[#7a756b] font-medium tracking-wider group-hover:${colors.accentGoldText} transition-colors`}>
                  {card.title}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

    </div>
  );
}