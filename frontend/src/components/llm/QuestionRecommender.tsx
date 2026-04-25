import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  MessageCircle,
  ChevronRight,
  Lightbulb,
  TrendingUp,
  GitBranch,
  BookOpen,
  Wrench,
} from 'lucide-react';
import llmApi from '../../api/llm';

interface QuestionRecommenderProps {
  query: string;
  response: string;
  entities: string[];
  onQuestionSelect: (question: string) => void;
  className?: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  深入: <TrendingUp className="w-4 h-4" />,
  扩展: <GitBranch className="w-4 h-4" />,
  对比: <MessageCircle className="w-4 h-4" />,
  应用: <Wrench className="w-4 h-4" />,
  探索: <Lightbulb className="w-4 h-4" />,
  学习: <BookOpen className="w-4 h-4" />,
};

const typeColors: Record<string, string> = {
  深入: 'from-purple-500 to-indigo-500',
  扩展: 'from-blue-500 to-cyan-500',
  对比: 'from-green-500 to-emerald-500',
  应用: 'from-orange-500 to-amber-500',
  探索: 'from-pink-500 to-rose-500',
  学习: 'from-teal-500 to-green-500',
};

const QuestionRecommender: React.FC<QuestionRecommenderProps> = ({
  query,
  response,
  entities,
  onQuestionSelect,
  className = '',
}) => {
  const [questions, setQuestions] = useState<
    Array<{
      question: string;
      type: string;
      reason: string;
      related_entities: string[];
      priority: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [contextSummary, setContextSummary] = useState<string>('');

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const result = await llmApi.recommendQuestions({
        query,
        response,
        entities,
      });

      setQuestions(result.questions);
      setContextSummary(result.context_summary || '');
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
      setQuestions(getFallbackQuestions());
    } finally {
      setLoading(false);
    }
  }, [query, response, entities]);

  useEffect(() => {
    if (query && response) {
      fetchRecommendations();
    }
  }, [query, response, fetchRecommendations]);

  const getFallbackQuestions = () => {
    return [
      {
        question: '这个技艺的历史渊源是什么？',
        type: '深入',
        reason: '了解历史背景可以更好地理解技艺发展',
        related_entities: [],
        priority: 1,
      },
      {
        question: '如何学习这门技艺？',
        type: '学习',
        reason: '提供实用的学习指导',
        related_entities: [],
        priority: 2,
      },
      {
        question: '这门技艺有哪些代表作品？',
        type: '扩展',
        reason: '欣赏优秀作品可以激发灵感',
        related_entities: [],
        priority: 3,
      },
    ];
  };

  return (
    <div className={`question-recommender ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-purple-400" />
        <h3 className="text-sm font-medium text-gray-300">相关问题推荐</h3>
      </div>

      {contextSummary && <p className="text-xs text-gray-500 mb-3 italic">{contextSummary}</p>}

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-800/50 rounded-lg animate-pulse" />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="questions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            {questions.map((q, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => onQuestionSelect(q.question)}
                className="w-full group relative overflow-hidden"
              >
                <div
                  className={`
                  relative p-3 rounded-lg border border-gray-700/50
                  bg-gradient-to-r from-gray-800/50 to-gray-800/30
                  hover:border-gray-600/50 transition-all duration-300
                  group-hover:shadow-lg group-hover:shadow-purple-500/10
                `}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`
                      p-1.5 rounded-md bg-gradient-to-br ${typeColors[q.type] || 'from-gray-500 to-gray-600'}
                      text-white shadow-lg
                    `}
                    >
                      {typeIcons[q.type] || <MessageCircle className="w-4 h-4" />}
                    </div>

                    <div className="flex-1 text-left">
                      <p className="text-sm text-gray-200 group-hover:text-white transition-colors">
                        {q.question}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{q.reason}</p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-purple-400 transition-colors mt-1" />
                  </div>

                  {q.related_entities.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {q.related_entities.slice(0, 3).map((entity, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400"
                        >
                          {entity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuestionRecommender;
