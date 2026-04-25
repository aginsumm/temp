import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { connectionManager } from '../../services/connectionManager';

type ConnectionStatusType = 'online' | 'offline' | 'reconnecting' | 'checking';

interface StatusConfig {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  label: string;
  showLatency: boolean;
}

const STATUS_CONFIG: Record<ConnectionStatusType, StatusConfig> = {
  online: {
    icon: <Wifi size={14} />,
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    label: '已连接',
    showLatency: true,
  },
  offline: {
    icon: <WifiOff size={14} />,
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    label: '已断开',
    showLatency: false,
  },
  reconnecting: {
    icon: <Loader2 size={14} className="animate-spin" />,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
    label: '重连中...',
    showLatency: false,
  },
  checking: {
    icon: <Loader2 size={14} className="animate-spin" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    label: '检查中...',
    showLatency: false,
  },
};

export default function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatusType>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const unsubscribe = connectionManager.subscribe((state) => {
      setStatus(state.status as ConnectionStatusType);
      setLatency(state.latency);
    });

    return unsubscribe;
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      await connectionManager.forceReconnect();
    } catch (error) {
      console.error('手动重连失败:', error);
    } finally {
      setIsReconnecting(false);
    }
  };

  const config = STATUS_CONFIG[status];

  return (
    <div className="relative">
      <motion.div
        className={`
          inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm
          ${config.bgColor} ${config.color}
          cursor-pointer hover:shadow-sm transition-shadow
        `}
        onClick={() => setShowDetails(!showDetails)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {config.icon}
        <span className="font-medium">{config.label}</span>
        {config.showLatency && latency !== null && (
          <span className="text-xs opacity-75">{latency}ms</span>
        )}
        {status === 'offline' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReconnect();
            }}
            disabled={isReconnecting}
            className="ml-1 p-0.5 rounded hover:bg-white/50 transition-colors disabled:opacity-50"
            title="重新连接"
          >
            <RefreshCw size={12} className={isReconnecting ? 'animate-spin' : ''} />
          </button>
        )}
      </motion.div>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50"
          >
            <h4 className="font-medium text-gray-900 mb-3">连接详情</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">状态</span>
                <span className={config.color}>{config.label}</span>
              </div>
              {latency !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">延迟</span>
                  <span>{latency}ms</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">HTTP 可用</span>
                <span>{connectionManager.getState().httpAvailable ? '是' : '否'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">队列请求</span>
                <span>{connectionManager.getState().queuedRequestsCount}</span>
              </div>
              {connectionManager.getState().lastConnected && (
                <div className="flex justify-between">
                  <span className="text-gray-500">最后连接</span>
                  <span>
                    {new Date(connectionManager.getState().lastConnected!).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={handleReconnect}
                disabled={isReconnecting}
                className="w-full px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReconnecting ? '重连中...' : '重新连接'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {status === 'offline' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 mt-2 w-72 bg-red-50 border border-red-200 rounded-lg p-3 shadow-lg"
        >
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-red-800 font-medium">连接已断开</p>
              <p className="text-xs text-red-600 mt-1">
                无法连接到后端服务，请检查服务是否正常运行
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
