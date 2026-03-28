import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Network,
  Layers,
  ArrowRight,
  Sparkles,
  BookOpen,
  Users,
  Award,
} from "lucide-react";

export default function Homepage() {
  const features = [
    {
      icon: MessageSquare,
      title: "智能问答",
      description: "基于大语言模型的智能对话系统，为您提供专业的非遗知识解答",
      link: "/chat",
      color: "from-primary-deep to-primary-medium",
    },
    {
      icon: Network,
      title: "知识图谱",
      description: "可视化展示非遗知识网络，探索文化传承的脉络与关联",
      link: "/knowledge",
      color: "from-blue-primary to-blue-deep",
    },
    {
      icon: Layers,
      title: "元素提取",
      description: "智能识别和提取非遗元素，助力文化研究与传承",
      link: "/extract",
      color: "from-gold-primary to-gold-dark",
    },
  ];

  const stats = [
    { icon: BookOpen, value: "1000+", label: "非遗项目" },
    { icon: Users, value: "500+", label: "传承人" },
    { icon: Award, value: "100+", label: "技艺分类" },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-cream via-white to-blue-50/30" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-light/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-light/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary-light/20 text-primary-deep rounded-full text-sm font-medium mb-6">
              <Sparkles size={16} />
              非遗文化数字传承平台
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary mb-6 leading-tight"
          >
            非遗数字生命
            <span className="block text-gradient from-primary-deep to-blue-primary">
              互动引擎
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10"
          >
            融合人工智能与传统文化，打造沉浸式的非遗知识探索体验，
            让千年技艺在数字时代焕发新生
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to="/chat"
              className="btn-primary flex items-center gap-2 text-lg px-8 py-4"
            >
              开始探索
              <ArrowRight size={20} />
            </Link>
            <Link
              to="/knowledge"
              className="btn-secondary flex items-center gap-2 text-lg px-8 py-4"
            >
              浏览图谱
              <Network size={20} />
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-4 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-text-primary mb-4">
              核心功能
            </h2>
            <p className="text-text-secondary">
              三大核心模块，全方位探索非遗文化
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={feature.link}
                  className="block h-full card-base hover:shadow-xl group"
                >
                  <div
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <feature.icon size={28} className="text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-text-primary mb-2 group-hover:text-primary-deep transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {feature.description}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-primary-deep text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    了解更多
                    <ArrowRight size={14} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-light to-primary-medium/50 flex items-center justify-center">
                  <stat.icon size={28} className="text-primary-deep" />
                </div>
                <div className="text-4xl font-bold text-gradient from-primary-deep to-primary-medium mb-2">
                  {stat.value}
                </div>
                <div className="text-text-secondary">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-gradient-to-br from-primary-deep to-primary-medium text-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold mb-4">
              开始您的非遗探索之旅
            </h2>
            <p className="text-white/80 mb-8">
              与AI助手对话，深入了解非遗文化的魅力
            </p>
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-deep rounded-lg font-semibold hover:bg-white/90 transition-colors"
            >
              立即开始
              <ArrowRight size={20} />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
