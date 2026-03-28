import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, X } from 'lucide-react';
import { networkStatusService } from '../../../services/networkStatus';

export default function OfflineBanner() {
  const [networkStatus, setNetworkStatus] = useState(networkStatusService.getStatus());
  const [dismissed, setDismissed] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const unsubscribe = networkStatusService.subscribe((status) => {
      setNetworkStatus(status);
      if (status.mode === 'online') {
        setDismissed(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    await networkStatusService.forceReconnect();
    setTimeout(() => setIsReconnecting(false), 1000);
  };

  const showBanner = networkStatus.mode === 'offline' && !dismissed;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <WifiOff size={18} className="flex-shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="font-medium text-sm">当前处于离线模式</span>
                  <span className="text-xs text-orange-100">
                    数据将保存在本地，恢复连接后自动同步
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isReconnecting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>连接中...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      <span>重新连接</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setDismissed(true)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="关闭提示"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
