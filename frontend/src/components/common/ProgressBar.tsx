import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
  label?: string;
  showPercentage?: boolean;
  height?: number;
  color?: string;
}

export default function ProgressBar({
  progress,
  label,
  showPercentage = true,
  height = 8,
  color,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {label}
            </span>
          )}
          {showPercentage && (
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{
          height: `${height}px`,
          background: 'var(--color-background-secondary)',
          border: '1px solid var(--color-border-light)',
        }}
      >
        <motion.div
          className="h-full rounded-full"
          role="progressbar"
          aria-valuenow={Math.round(clampedProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label ?? '进度'}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            background:
              color ||
              'linear-gradient(90deg, var(--color-primary), var(--color-secondary))',
            boxShadow: `0 0 10px ${color || 'var(--color-primary)'}`,
          }}
        />
      </div>
    </div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

export function LoadingOverlay({ isLoading, message = '加载中...', progress }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-50"
      style={{
        background: 'var(--color-surface)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{
          background: 'var(--gradient-secondary)',
          boxShadow: 'var(--color-shadow-glow)',
        }}
      >
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      </div>

      <p
        className="text-sm font-medium mb-3"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {message}
      </p>

      {progress !== undefined && (
        <div className="w-48">
          <ProgressBar progress={progress} showPercentage={true} height={6} />
        </div>
      )}
    </div>
  );
}
