import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  BookOpen,
  Palette,
  Lightbulb,
  ArrowRight,
  Zap,
  Star,
  Globe,
  Award,
  Users,
} from 'lucide-react';
import { useThemeStore } from '../../../stores/themeStore';
import { getThemeVisual } from '../../../config/themes/heritageThemes';
import chatApi from '../../../api/chat';
import '../../../styles/theme-patterns.css';

interface WelcomeScreenProps {
  onQuestionClick: (question: string) => void;
  userName?: string;
  sessionId?: string;
  entities?: Array<{ id: string; name: string; type: string }>;
  keywords?: string[];
}

interface RecommendedQuestion {
  id: string;
  question: string;
}

const quickQuestions = [
  {
    category: '技艺探索',
    icon: Palette,
    questions: ['武汉木雕有哪些代表性技法？', '汉绣的基本针法有哪些？', '剪纸艺术有哪些流派？'],
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #9333ea 100%)',
    bgGlow: 'rgba(139, 92, 246, 0.15)',
  },
  {
    category: '历史文化',
    icon: BookOpen,
    questions: [
      '黄鹤楼的历史传说有哪些？',
      '楚文化的核心特征是什么？',
      '荆楚文化有哪些代表性遗产？',
    ],
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #0891b2 100%)',
    bgGlow: 'rgba(59, 130, 246, 0.15)',
  },
  {
    category: '传承人物',
    icon: Star,
    questions: ['湖北有哪些非遗传承人？', '传承人是如何培养的？', '非遗传承面临哪些挑战？'],
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    bgGlow: 'rgba(245, 158, 11, 0.15)',
  },
];

const features = [
  {
    icon: Zap,
    label: '智能问答',
    description: '精准理解',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
    bgGlow: 'rgba(251, 191, 36, 0.3)',
  },
  {
    icon: BookOpen,
    label: '知识图谱',
    description: '丰富知识库',
    gradient: 'linear-gradient(135deg, #60a5fa 0%, #22d3ee 100%)',
    bgGlow: 'rgba(96, 165, 250, 0.3)',
  },
  {
    icon: Sparkles,
    label: '个性推荐',
    description: '定制内容',
    gradient: 'linear-gradient(135deg, #c084fc 0%, #f472b6 100%)',
    bgGlow: 'rgba(192, 132, 252, 0.3)',
  },
  {
    icon: Globe,
    label: '多模态',
    description: '图文音视',
    gradient: 'linear-gradient(135deg, #4ade80 0%, #34d399 100%)',
    bgGlow: 'rgba(74, 222, 128, 0.3)',
  },
];

const stats = [
  { value: '1000+', label: '非遗项目', icon: Award },
  { value: '500+', label: '传承人', icon: Users },
  { value: '100+', label: '技艺类型', icon: Palette },
];

const tips = [
  '试试问我关于任何非遗技艺的问题',
  '我可以帮你了解非遗传承人的故事',
  '探索不同地区的非遗文化特色',
  '了解非遗保护与传承的现状',
];

// 动画配置 - 使用 CSS 动画替代 Framer Motion variants
const animationConfig = {
  staggerDelay: 80,
  initialDelay: 150,
};

export default function WelcomeScreen({
  onQuestionClick,
  userName,
  sessionId,
  entities,
  keywords,
}: WelcomeScreenProps) {
  const [currentTip, setCurrentTip] = useState(0);
  const [greeting, setGreeting] = useState('');
  const [questions, setQuestions] = useState<RecommendedQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { currentTheme, themeId } = useThemeStore();
  const visual = useMemo(() => {
    if (currentTheme?.visual) {
      return currentTheme.visual;
    }
    return getThemeVisual(themeId || 'ink-wash');
  }, [currentTheme, themeId]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 6) setGreeting('夜深了');
    else if (hour < 12) setGreeting('早上好');
    else if (hour < 18) setGreeting('下午好');
    else setGreeting('晚上好');
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % tips.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // 加载个性化推荐问题
  useEffect(() => {
    const loadRecommendations = async () => {
      setIsLoading(true);
      try {
        const data = await chatApi.getRecommendations({
          session_id: sessionId,
          entities: entities?.map((e) => e.name) || [],
          keywords,
          limit: 6,
        });
        if (data && data.questions) {
          setQuestions(data.questions);
        } else {
          setQuestions([]);
        }
      } catch (error) {
        console.warn('Failed to load recommendations:', error);
        setQuestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecommendations();
  }, [sessionId, entities, keywords]);

  return (
    <div
      className="flex flex-col items-center justify-center h-full px-3 py-4 overflow-y-auto relative transition-colors duration-300 theme-visual-container"
      style={{ background: 'var(--color-background)' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-48 h-48 rounded-full blur-3xl"
          style={{ background: 'var(--gradient-primary)', opacity: 0.3 }}
        />
        <motion.div
          animate={{ scale: [1.15, 1, 1.15], opacity: [0.25, 0.4, 0.25] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full blur-3xl"
          style={{ background: 'var(--gradient-secondary)', opacity: 0.3 }}
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'var(--gradient-accent)', opacity: 0.2 }}
        />
      </div>

      {visual.particles.enabled && (
        <div className="theme-particles-container">
          {[...Array(Math.min(visual.particles.count, 6))].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0.4, 0.8, 0.4],
                scale: [1, 1.2, 1],
                y: [0, -30, -60, -30, 0],
                x: [0, 10, -5, -15, 0],
              }}
              transition={{
                duration: visual.particles.speed + i,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.8,
              }}
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + ((i * 10) % 60)}%`,
                width: visual.particles.size,
                height: visual.particles.size,
                background: `radial-gradient(circle, ${visual.particles.color} 0%, transparent 70%)`,
                boxShadow: `0 0 8px ${visual.particles.color}`,
              }}
            />
          ))}
        </div>
      )}

      <div
        className="relative z-10 w-full max-w-3xl animate-fade-in"
        style={{ animationDelay: `${animationConfig.initialDelay}ms` }}
      >
        <div className="text-center mb-8 animate-fade-in-up">
          {/* Logo 区域 - 更精致的设计 */}
          <div className="relative inline-block mb-5">
            {/* 外发光光环 */}
            <div
              className="absolute inset-0 rounded-2xl blur-xl opacity-30 animate-pulse"
              style={{
                background: 'var(--gradient-primary)',
                transform: 'scale(1.2)',
              }}
            />
            {/* 主图标容器 */}
            <div
              className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: 'var(--gradient-primary)',
                boxShadow: 'var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.1) inset',
              }}
            >
              {/* 内部装饰圆环 */}
              <div className="absolute inset-2 rounded-xl border border-white/20" />
              <Sparkles
                size={32}
                style={{ color: 'var(--color-text-inverse)' }}
                className="animate-pulse"
              />
            </div>
            {/* 浮动装饰点 */}
            <div
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full animate-bounce"
              style={{
                background: 'var(--gradient-accent)',
                animationDuration: '2s',
              }}
            />
          </div>

          {/* 主标题 - 更优雅的排版 */}
          <h1
            className="text-3xl md:text-4xl font-bold mb-3 tracking-tight"
            style={{
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {greeting}，{userName || '探索者'}
          </h1>

          {/* 副标题 */}
          <p className="text-base md:text-lg mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            我是您的
            <span
              className="font-semibold px-1.5 py-0.5 rounded mx-1"
              style={{
                color: 'var(--color-primary)',
                background: 'var(--color-primary-light)',
              }}
            >
              非遗文化智能助手
            </span>
          </p>

          {/* 动态提示 - 更 subtle 的设计 */}
          <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
            <p
              className="text-xs inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-500"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-light)',
                color: 'var(--color-text-muted)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--color-success)' }}
              />
              {tips[currentTip]}
            </p>
          </div>
        </div>

        <div
          className="flex items-center justify-center gap-3 md:gap-6 mb-8 animate-fade-in"
          style={{ animationDelay: '350ms' }}
        >
          {features.map((feature, index) => (
            <div
              key={feature.label}
              className="flex flex-col items-center gap-1.5 cursor-pointer group animate-fade-in"
              style={{ animationDelay: `${400 + index * 80}ms` }}
            >
              <div
                className="w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 group-hover:shadow-xl group-hover:scale-105 group-hover:-translate-y-1"
                style={{
                  background: feature.gradient,
                  boxShadow: `0 8px 24px -8px ${feature.bgGlow}`,
                }}
              >
                <feature.icon size={22} style={{ color: 'var(--color-text-inverse)' }} />
              </div>
              <span
                className="text-xs font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {feature.label}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {feature.description}
              </span>
            </div>
          ))}
        </div>

        <div
          className="flex items-center justify-center gap-4 md:gap-6 mb-8 animate-fade-in"
          style={{ animationDelay: '450ms' }}
        >
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl shadow-sm transition-all duration-300 hover:scale-105 animate-fade-in"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-light)',
                animationDelay: `${500 + index * 80}ms`,
              }}
            >
              <stat.icon size={14} style={{ color: 'var(--color-primary)' }} />
              <span className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {stat.value}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mb-6 animate-fade-in" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center justify-center gap-2 mb-5">
            <div
              className="h-px flex-1 max-w-16"
              style={{ background: 'linear-gradient(to right, transparent, var(--color-border))' }}
            />
            <h2
              className="text-xs font-medium flex items-center gap-1.5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Lightbulb size={12} />
              {questions.length > 0 ? '为您推荐' : '快速开始'}
            </h2>
            <div
              className="h-px flex-1 max-w-16"
              style={{ background: 'linear-gradient(to left, transparent, var(--color-border))' }}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div
                className="animate-spin rounded-full h-6 w-6 border-b-2"
                style={{ borderColor: 'var(--color-primary)' }}
              />
            </div>
          ) : questions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {questions.map((question, index) => (
                <button
                  key={question.id}
                  onClick={() => onQuestionClick(question.question)}
                  className="p-4 rounded-xl text-left transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-1 animate-fade-in"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    animationDelay: `${500 + index * 50}ms`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="text-sm font-medium flex-1"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {question.question}
                    </span>
                    <ArrowRight
                      size={16}
                      style={{ color: 'var(--color-primary)', flexShrink: 0 }}
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {quickQuestions.map((category, categoryIndex) => (
                <div
                  key={category.category}
                  className="rounded-xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 animate-fade-in"
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    boxShadow: `0 2px 16px -4px ${category.bgGlow}`,
                    animationDelay: `${500 + categoryIndex * 100}ms`,
                  }}
                >
                  <div
                    className="px-4 py-3.5 relative overflow-hidden"
                    style={{ background: category.gradient }}
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div
                      className="relative flex items-center gap-2.5"
                      style={{ color: 'var(--color-text-inverse)' }}
                    >
                      <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        <category.icon size={18} />
                      </div>
                      <span className="font-semibold text-base">{category.category}</span>
                    </div>
                  </div>
                  <div className="p-2">
                    {category.questions.map((question, questionIndex) => (
                      <button
                        key={questionIndex}
                        onClick={() => onQuestionClick(question)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm transition-all hover:translate-x-1 group/item"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <span className="line-clamp-1 flex-1">{question}</span>
                        <ArrowRight
                          size={14}
                          style={{ color: 'var(--color-primary)' }}
                          className="opacity-0 group-hover/item:opacity-100 transition-opacity"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center animate-fade-in" style={{ animationDelay: '500ms' }}>
          <p
            className="text-[11px] flex items-center justify-center gap-1.5"
            style={{ color: 'var(--color-text-muted)' }}
          >
            按
            <kbd
              className="px-1.5 py-0.5 rounded-md text-[10px] font-mono"
              style={{
                background: 'var(--color-background-secondary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              ⌘K
            </kbd>
            打开命令面板
            <span className="mx-1" style={{ color: 'var(--color-border)' }}>
              ·
            </span>
            按
            <kbd
              className="px-1.5 py-0.5 rounded-md text-[10px] font-mono"
              style={{
                background: 'var(--color-background-secondary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              ⌘/
            </kbd>
            查看快捷键
          </p>
        </div>
      </div>
    </div>
  );
}
