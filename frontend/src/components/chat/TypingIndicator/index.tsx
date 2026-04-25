interface TypingIndicatorProps {
  message?: string;
  variant?: 'default' | 'minimal' | 'dots';
}

export function TypingIndicator({ message = '正在思考', variant = 'default' }: TypingIndicatorProps) {
  if (variant === 'dots') {
    return (
      <div className="flex items-center gap-1.5 p-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full animate-bounce"
            style={{
              background: 'var(--color-primary)',
              animationDelay: `${i * 0.15}s`,
              animationDuration: '0.8s',
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-2 p-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{
                background: 'var(--color-primary)',
                animationDelay: `${i * 0.1}s`,
                animationDuration: '0.5s',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div
        className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
        style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        }}
      >
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            AI助手
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full animate-pulse"
            style={{
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
            }}
          >
            思考中
          </span>
        </div>

        <div
          className="rounded-2xl rounded-tl-md p-4"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{
                    background: 'var(--color-primary)',
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: '0.6s',
                  }}
                />
              ))}
            </div>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {message}
            </span>
          </div>

          <div className="mt-3 space-y-2 animate-in fade-in duration-500 delay-500">
            {['分析问题', '检索知识库', '生成回答'].map((step, i) => (
              <div
                key={step}
                className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300"
                style={{ animationDelay: `${0.5 + i * 0.3}s` }}
              >
                <div
                  className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
