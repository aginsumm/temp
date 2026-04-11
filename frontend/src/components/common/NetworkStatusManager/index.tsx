import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Cloud,
  CloudOff,
  Check,
  AlertCircle,
  Zap,
  Activity,
  Clock,
  ChevronDown,
  Signal,
  Globe,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import {
  useNetworkStore,
  getConnectionQuality,
  getStatusMessage,
} from '../../../stores/networkStore';
import { useToast } from '../Toast';

interface NetworkStatusManagerProps {
  mode?: 'minimal' | 'compact' | 'full';
  position?: 'top-right' | 'bottom-right' | 'top-bar';
  showDetails?: boolean;
  showLatency?: boolean;
  showQueue?: boolean;
  autoHide?: boolean;
  className?: string;
}

export default function NetworkStatusManager({
  mode = 'compact',
  position = 'top-right',
  showDetails = true,
  showLatency = true,
  showQueue = true,
  className = '',
}: NetworkStatusManagerProps) {
  const {
    status,
    latency,
    queuedRequestsCount,
    httpAvailable,
    wsAvailable,
    lastConnected,
    forceReconnect,
    isManualReconnect,
  } = useNetworkStore();
  const toast = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const quality = getConnectionQuality(latency);
  const isAnimating = status === 'reconnecting' || isManualReconnect;
  const isOffline = status === 'offline' || !httpAvailable;

  useEffect(() => {
    if (latency !== null) {
      setLatencyHistory((prev) => [...prev.slice(-9), latency!]);
    }
  }, [latency]);

  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'var(--color-success)';
      case 'offline':
        return 'var(--color-error)';
      case 'reconnecting':
        return 'var(--color-info)';
      case 'degraded':
        return 'var(--color-warning)';
      default:
        return 'var(--color-text-muted)';
    }
  };

  const getQualityColor = () => {
    switch (quality) {
      case 'excellent':
        return 'var(--color-success)';
      case 'good':
        return 'var(--color-info)';
      case 'poor':
        return 'var(--color-warning)';
      default:
        return 'var(--color-text-muted)';
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'online':
        return Wifi;
      case 'offline':
        return WifiOff;
      case 'reconnecting':
        return RefreshCw;
      case 'degraded':
        return AlertCircle;
      default:
        return Wifi;
    }
  };

  const getLatencyTrend = () => {
    if (latencyHistory.length < 3) return 'stable';
    const recent = latencyHistory.slice(-3);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const last = recent[recent.length - 1];
    if (last < avg * 0.9) return 'improving';
    if (last > avg * 1.1) return 'degrading';
    return 'stable';
  };

  const getTrendIcon = () => {
    const trend = getLatencyTrend();
    switch (trend) {
      case 'improving':
        return <TrendingDown size={12} style={{ color: 'var(--color-success)' }} />;
      case 'degrading':
        return <TrendingUp size={12} style={{ color: 'var(--color-warning)' }} />;
      default:
        return <Minus size={12} style={{ color: 'var(--color-text-muted)' }} />;
    }
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '未知';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    return date.toLocaleDateString();
  };

  const handleReconnect = async () => {
    await forceReconnect();
    toast.info('正在重连', '尝试恢复网络连接...');
  };

  const Icon = getIcon();
  const statusColor = getStatusColor();

  if (mode === 'minimal') {
    return (
      <motion.div
        className={`relative flex items-center justify-center w-3 h-3 ${className}`}
        title={getStatusMessage(status)}
      >
        <div className="w-2 h-2 rounded-full" style={{ background: getQualityColor() }} />
        {(status === 'offline' || status === 'reconnecting') && (
          <motion.div
            className="absolute w-2 h-2 rounded-full"
            style={{ background: getQualityColor() }}
            animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </motion.div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <motion.button
        onClick={() => showDetails && setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 backdrop-blur-sm"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${statusColor} 15%, var(--color-surface)) 0%, color-mix(in srgb, ${statusColor} 5%, var(--color-surface)) 100%)`,
          border: `1px solid color-mix(in srgb, ${statusColor} 30%, var(--color-border))`,
          boxShadow: `0 2px 8px -2px color-mix(in srgb, ${statusColor} 20%, transparent)`,
        }}
        whileHover={
          showDetails
            ? {
                scale: 1.02,
                boxShadow: `0 4px 16px -2px color-mix(in srgb, ${statusColor} 30%, transparent)`,
              }
            : {}
        }
        whileTap={showDetails ? { scale: 0.98 } : {}}
      >
        <div className="relative">
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ background: getQualityColor() }}
            animate={
              status === 'online'
                ? { scale: [1, 1.1, 1] }
                : status === 'offline' || status === 'reconnecting'
                  ? { scale: [1, 1.5, 1], opacity: [0.8, 0.4, 0.8] }
                  : {}
            }
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          {(status === 'offline' || status === 'reconnecting') && (
            <motion.div
              className="absolute inset-0 w-2 h-2 rounded-full"
              style={{ background: getQualityColor() }}
              animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>

        <motion.div
          className="flex items-center justify-center w-5 h-5 rounded-full"
          style={{ background: statusColor }}
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.5 }}
        >
          <Icon
            size={14}
            style={{ color: 'var(--color-text-inverse)' }}
            className={isAnimating ? 'animate-spin' : ''}
          />
        </motion.div>

        <span
          className="text-xs font-medium"
          style={{ color: 'var(--color-text-primary)', letterSpacing: '0.01em' }}
        >
          {getStatusMessage(status)}
        </span>

        {showLatency && latency !== null && status === 'online' && (
          <span
            className="flex items-center gap-1 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Zap size={10} />
            {Math.round(latency)}ms
          </span>
        )}

        {showQueue && queuedRequestsCount > 0 && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="ml-1 px-1.5 py-0.5 text-xs rounded-full font-semibold"
            style={{
              background: 'linear-gradient(135deg, var(--color-warning) 0%, #f59e0b 100%)',
              color: 'var(--color-text-inverse)',
              boxShadow: '0 2px 4px -1px rgba(245, 158, 11, 0.3)',
            }}
          >
            {queuedRequestsCount}
          </motion.span>
        )}

        {showDetails && (
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={12} style={{ color: 'var(--color-text-muted)' }} />
          </motion.div>
        )}
      </motion.button>

      <AnimatePresence>
        {isExpanded && showDetails && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsExpanded(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.25, type: 'spring', stiffness: 300, damping: 25 }}
              className="absolute top-full right-0 mt-2 w-80 rounded-2xl shadow-2xl overflow-hidden z-50"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
            >
              <div
                className="p-4"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, ${statusColor} 5%, var(--color-surface)) 0%, var(--color-surface) 100%)`,
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <motion.div
                      className="w-8 h-8 rounded-xl flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${statusColor} 0%, color-mix(in srgb, ${statusColor} 80%, var(--color-primary)) 100%)`,
                        boxShadow: `0 4px 12px -2px ${statusColor}40`,
                      }}
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Signal size={16} style={{ color: 'var(--color-text-inverse)' }} />
                    </motion.div>
                    <div>
                      <h3
                        className="font-semibold text-sm"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        网络状态
                      </h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        实时监控
                      </p>
                    </div>
                  </div>
                  <motion.span
                    className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: `linear-gradient(135deg, color-mix(in srgb, ${statusColor} 20%, transparent) 0%, color-mix(in srgb, ${statusColor} 10%, transparent) 100%)`,
                      color: statusColor,
                      border: `1px solid color-mix(in srgb, ${statusColor} 30%, transparent)`,
                    }}
                    whileHover={{ scale: 1.05 }}
                  >
                    {status === 'online'
                      ? '在线'
                      : status === 'offline'
                        ? '离线'
                        : status === 'reconnecting'
                          ? '重连中'
                          : '部分可用'}
                  </motion.span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <motion.div
                    className="p-3 rounded-xl"
                    style={{
                      background: 'var(--color-background-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                    whileHover={{ scale: 1.02, y: -2 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Activity size={14} style={{ color: statusColor }} />
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        连接质量
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-lg font-bold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {quality === 'excellent'
                          ? '优秀'
                          : quality === 'good'
                            ? '良好'
                            : quality === 'poor'
                              ? '较差'
                              : '未知'}
                      </span>
                      <div
                        className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ background: 'var(--color-background-tertiary)' }}
                      >
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: statusColor }}
                          initial={{ width: 0 }}
                          animate={{
                            width:
                              status === 'online'
                                ? quality === 'excellent'
                                  ? '100%'
                                  : quality === 'good'
                                    ? '70%'
                                    : '40%'
                                : '0%',
                          }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    className="p-3 rounded-xl"
                    style={{
                      background: 'var(--color-background-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                    whileHover={{ scale: 1.02, y: -2 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={14} style={{ color: 'var(--color-warning)' }} />
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        网络延迟
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-lg font-bold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {latency ? `${Math.round(latency)}ms` : '--'}
                      </span>
                      {latency && getTrendIcon()}
                    </div>
                  </motion.div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <motion.div
                    className="p-3 rounded-xl"
                    style={{ background: 'var(--color-background-secondary)' }}
                    whileHover={{ scale: 1.01 }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Globe
                        size={14}
                        style={{
                          color: httpAvailable ? 'var(--color-success)' : 'var(--color-error)',
                        }}
                      />
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        HTTP服务
                      </span>
                    </div>
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {httpAvailable ? '正常' : '不可用'}
                    </span>
                  </motion.div>

                  <motion.div
                    className="p-3 rounded-xl"
                    style={{ background: 'var(--color-background-secondary)' }}
                    whileHover={{ scale: 1.01 }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Wifi
                        size={14}
                        style={{
                          color: wsAvailable ? 'var(--color-success)' : 'var(--color-error)',
                        }}
                      />
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        WebSocket
                      </span>
                    </div>
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {wsAvailable ? '正常' : '不可用'}
                    </span>
                  </motion.div>
                </div>

                {lastConnected && (
                  <motion.div
                    className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: 'var(--color-background-secondary)' }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <Clock size={14} style={{ color: 'var(--color-text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      上次连接:
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {formatTime(lastConnected)}
                    </span>
                  </motion.div>
                )}
              </div>

              <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Cloud size={16} style={{ color: 'var(--color-primary)' }} />
                    <h3
                      className="font-semibold text-sm"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      数据同步
                    </h3>
                  </div>
                  {queuedRequestsCount > 0 ? (
                    <CloudOff size={12} style={{ color: 'var(--color-warning)' }} />
                  ) : (
                    <Check size={12} style={{ color: 'var(--color-success)' }} />
                  )}
                </div>

                <div
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--color-background-secondary)' }}
                >
                  <div className="flex items-center gap-2">
                    <CloudOff size={14} style={{ color: 'var(--color-text-muted)' }} />
                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      待同步请求
                    </span>
                  </div>
                  <motion.span
                    className="text-sm font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color:
                        queuedRequestsCount > 0 ? 'var(--color-warning)' : 'var(--color-success)',
                      background:
                        queuedRequestsCount > 0
                          ? 'rgba(245, 158, 11, 0.1)'
                          : 'rgba(34, 197, 94, 0.1)',
                    }}
                    key={queuedRequestsCount}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                  >
                    {queuedRequestsCount} 项
                  </motion.span>
                </div>
              </div>

              {status !== 'online' && (
                <div className="p-3" style={{ background: 'var(--color-background-secondary)' }}>
                  <motion.button
                    onClick={handleReconnect}
                    disabled={isManualReconnect || status === 'reconnecting'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
                      color: 'var(--color-text-inverse)',
                      boxShadow: '0 4px 12px -2px var(--color-primary)',
                    }}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isAnimating ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>重新连接中...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        <span>重新连接</span>
                      </>
                    )}
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
