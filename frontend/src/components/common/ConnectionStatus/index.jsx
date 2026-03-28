import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import {
  subscribeToConnectionStatus,
  getConnectionStatus,
  forceReconnect,
} from '../../../api/client';

export default function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(getConnectionStatus());
  const [showTooltip, setShowTooltip] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToConnectionStatus((connected) => {
      setIsConnected(connected);
      if (connected) {
        setIsReconnecting(false);
      }
    });

    return unsubscribe;
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    const reconnected = await forceReconnect();
    if (reconnected) {
      setIsConnected(true);
    }
    setIsReconnecting(false);
  };

  return (
    <div className="relative">
      <motion.button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          isConnected
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isConnected ? (
          <>
            <CheckCircle size={14} />
            <span>已连接</span>
          </>
        ) : (
          <>
            <WifiOff size={14} />
            <span>离线模式</span>
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute top-full right-0 mt-2 p-4 bg-white rounded-xl shadow-lg border border-gray-200 w-72 z-50"
          >
            {isConnected ? (
              <div className="flex items-start gap-2">
                <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">网络连接正常</p>
                  <p className="text-xs text-gray-500 mt-1">所有功能均可正常使用</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start gap-2 mb-3">
                  <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">离线模式</p>
                    <p className="text-xs text-gray-500 mt-1">
                      后端服务暂时不可用，已切换到离线模式
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isReconnecting ? (
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
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
