import { useMemo } from 'react';
import { Zap, Clock, Loader2 } from 'lucide-react';

interface StreamProgressProps {
  content: string;
  isStreaming: boolean;
  isThinking?: boolean;
}

/**
 * 流式输出进度指示器
 * 基于真实的流式数据展示生成进度
 */
export default function StreamProgress({ content, isStreaming, isThinking = false }: StreamProgressProps) {
  const charCount = useMemo(() => content.length, [content]);
  
  // 基于历史数据估算总长度（动态调整）
  const estimatedTotal = useMemo(() => {
    // 根据已生成内容动态估算
    if (charCount < 50) return 300;
    if (charCount < 100) return 400;
    if (charCount < 200) return 500;
    if (charCount < 500) return 800;
    return Math.max(charCount * 1.2, 1000);
  }, [charCount]);

  const progress = useMemo(() => {
    if (!isStreaming) return 100;
    return Math.min(Math.round((charCount / estimatedTotal) * 100), 95);
  }, [charCount, estimatedTotal, isStreaming]);

  // 估算剩余时间（基于生成速度）
  const estimatedTimeRemaining = useMemo(() => {
    if (!isStreaming || charCount === 0) return 0;
    // 假设平均生成速度约 30 字/秒
    const charsPerSecond = 30;
    const remainingChars = estimatedTotal - charCount;
    return Math.max(0, Math.round(remainingChars / charsPerSecond));
  }, [charCount, estimatedTotal, isStreaming]);

  if (!isStreaming && !isThinking) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {/* 进度条 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-dark))',
            }}
          />
        </div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[3rem] text-right">
          {progress}%
        </span>
      </div>

      {/* 状态信息 */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          {isThinking ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>思考中...</span>
            </>
          ) : (
            <>
              <Zap size={12} className="text-primary" />
              <span>已生成 {charCount} 字</span>
            </>
          )}
        </div>
        {isStreaming && estimatedTimeRemaining > 0 && (
          <div className="flex items-center gap-1.5">
            <Clock size={12} />
            <span>预计还需 {estimatedTimeRemaining} 秒</span>
          </div>
        )}
      </div>
    </div>
  );
}
