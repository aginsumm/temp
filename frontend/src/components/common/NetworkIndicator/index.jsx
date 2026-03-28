import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff, Check, AlertCircle } from 'lucide-react';
import { networkStatusService } from '../../../services/networkStatus';
import { dataSyncService } from '../../../services/dataSync';

export default function NetworkIndicator() {
  const [networkStatus, setNetworkStatus] = useState(networkStatusService.getStatus());
  const [syncStatus, setSyncStatus] = useState('idle');
  const [showDetails, setShowDetails] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const unsubscribeNetwork = networkStatusService.subscribe(setNetworkStatus);
    const unsubscribeSync = dataSyncService.subscribe(setSyncStatus);

    const updatePendingCount = async () => {
      const count = await dataSyncService.getPendingOperationsCount();
      setPendingCount(count);
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);

    return () => {
      unsubscribeNetwork();
      unsubscribeSync();
      clearInterval(interval);
    };
  }, []);

  const handleReconnect = async () => {
    await networkStatusService.forceReconnect();
  };

  const handleSync = async () => {
    await dataSyncService.syncPendingOperations();
  };

  const getStatusColor = () => {
    if (networkStatus.mode === 'offline') return 'bg-red-500';
    if (networkStatus.mode === 'checking') return 'bg-yellow-500';
    const quality = networkStatusService.getConnectionQuality();
    switch (quality) {
      case 'excellent':
        return 'bg-green-500';
      case 'good':
        return 'bg-blue-500';
      case 'poor':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = () => {
    if (networkStatus.mode === 'offline') {
      return <WifiOff size={16} className="text-white" />;
    }
    if (networkStatus.mode === 'checking') {
      return <RefreshCw size={16} className="text-white animate-spin" />;
    }
    return <Wifi size={16} className="text-white" />;
  };

  const getSyncIcon = () => {
    if (syncStatus === 'syncing') {
      return <RefreshCw size={14} className="animate-spin text-blue-500" />;
    }
    if (pendingCount > 0) {
      return <CloudOff size={14} className="text-orange-500" />;
    }
    return <Cloud size={14} className="text-green-500" />;
  };

  return (
    <div className="relative">
      <motion.button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        {getStatusIcon()}
        <span className="text-xs font-medium text-gray-700">
          {networkStatusService.getStatusDescription()}
        </span>
        {pendingCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
            {pendingCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50"
          >
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">网络状态</h3>
                <div
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    networkStatus.mode === 'online'
                      ? 'bg-green-100 text-green-700'
                      : networkStatus.mode === 'offline'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {networkStatus.mode === 'online'
                    ? '在线'
                    : networkStatus.mode === 'offline'
                      ? '离线'
                      : '检测中'}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-gray-600">
                  <span>连接质量</span>
                  <span className="font-medium">
                    {networkStatusService.getConnectionQuality() === 'excellent' && '优秀'}
                    {networkStatusService.getConnectionQuality() === 'good' && '良好'}
                    {networkStatusService.getConnectionQuality() === 'poor' && '较差'}
                    {networkStatusService.getConnectionQuality() === 'offline' && '无连接'}
                  </span>
                </div>

                {networkStatus.latency && (
                  <div className="flex items-center justify-between text-gray-600">
                    <span>延迟</span>
                    <span className="font-medium">{Math.round(networkStatus.latency)}ms</span>
                  </div>
                )}

                {networkStatus.lastOnlineTime && (
                  <div className="flex items-center justify-between text-gray-600">
                    <span>上次在线</span>
                    <span className="font-medium">
                      {new Date(networkStatus.lastOnlineTime).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">数据同步</h3>
                {getSyncIcon()}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-gray-600">
                  <span>同步状态</span>
                  <span className="font-medium flex items-center gap-1">
                    {syncStatus === 'idle' && <Check size={14} className="text-green-500" />}
                    {syncStatus === 'syncing' && (
                      <RefreshCw size={14} className="animate-spin text-blue-500" />
                    )}
                    {syncStatus === 'completed' && <Check size={14} className="text-green-500" />}
                    {syncStatus === 'error' && <AlertCircle size={14} className="text-red-500" />}
                    {syncStatus === 'idle' && '已同步'}
                    {syncStatus === 'syncing' && '同步中...'}
                    {syncStatus === 'completed' && '同步完成'}
                    {syncStatus === 'error' && '同步失败'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-gray-600">
                  <span>待同步操作</span>
                  <span className={`font-medium ${pendingCount > 0 ? 'text-orange-600' : ''}`}>
                    {pendingCount} 项
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 flex gap-2">
              {networkStatus.mode === 'offline' && (
                <button
                  onClick={handleReconnect}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                >
                  <RefreshCw size={14} />
                  重新连接
                </button>
              )}

              {pendingCount > 0 && networkStatus.mode === 'online' && (
                <button
                  onClick={handleSync}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                >
                  <Cloud size={14} />
                  立即同步
                </button>
              )}

              <button
                onClick={() => setShowDetails(false)}
                className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                关闭
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
