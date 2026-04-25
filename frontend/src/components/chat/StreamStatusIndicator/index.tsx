import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react';

interface StreamReconnectingProps {
  attempt: number;
  maxAttempts: number;
  estimatedTime?: number;
}

export const StreamReconnecting: React.FC<StreamReconnectingProps> = ({
  attempt,
  maxAttempts,
  estimatedTime,
}) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div className="text-yellow-600 animate-spin">
      <RefreshCw size={18} />
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-yellow-800">
        连接中断，正在重连（{attempt}/{maxAttempts}）...
      </p>
      {estimatedTime && (
        <p className="text-xs text-yellow-600 mt-0.5">预计 {estimatedTime} 秒后恢复</p>
      )}
    </div>
  </div>
);

interface StreamReconnectedProps {
  attempt: number;
}

export const StreamReconnected: React.FC<StreamReconnectedProps> = ({ attempt }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-200 animate-in fade-in zoom-in-95 duration-300">
    <CheckCircle size={18} className="text-green-600" />
    <p className="text-sm font-medium text-green-800">连接已恢复（重连 {attempt} 次）</p>
  </div>
);

interface StreamFailedProps {
  message: string;
  onRetry?: () => void;
}

export const StreamFailed: React.FC<StreamFailedProps> = ({ message, onRetry }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <WifiOff size={18} className="text-red-600" />
    <div className="flex-1">
      <p className="text-sm font-medium text-red-800">连接失败</p>
      <p className="text-xs text-red-600 mt-0.5">{message}</p>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all duration-200 hover:scale-105 active:scale-95"
      >
        重试
      </button>
    )}
  </div>
);

interface StreamStatusIndicatorProps {
  status: 'reconnecting' | 'reconnected' | 'failed' | 'idle';
  attempt?: number;
  maxAttempts?: number;
  estimatedTime?: number;
  message?: string;
  onRetry?: () => void;
}

export const StreamStatusIndicator: React.FC<StreamStatusIndicatorProps> = ({
  status,
  attempt = 0,
  maxAttempts = 3,
  estimatedTime,
  message,
  onRetry,
}) => {
  if (status === 'idle') return null;

  return (
    <div className="mb-3">
      {status === 'reconnecting' && (
        <StreamReconnecting
          attempt={attempt}
          maxAttempts={maxAttempts}
          estimatedTime={estimatedTime}
        />
      )}
      {status === 'reconnected' && <StreamReconnected attempt={attempt || 0} />}
      {status === 'failed' && (
        <StreamFailed message={message || '连接失败，请稍后重试'} onRetry={onRetry} />
      )}
    </div>
  );
};
