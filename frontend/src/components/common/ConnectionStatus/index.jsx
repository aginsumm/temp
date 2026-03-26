import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { subscribeToConnectionStatus, getConnectionStatus } from '../../../api/client';

export default function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(getConnectionStatus());
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToConnectionStatus((connected) => {
      setIsConnected(connected);
    });

    return unsubscribe;
  }, []);

  return (
    <div className='relative'>
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
            <Wifi size={14} />
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
        {showTooltip && !isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className='absolute top-full right-0 mt-2 p-3 bg-white rounded-lg shadow-lg border border-gray-200 w-64 z-50'
          >
            <div className='flex items-start gap-2'>
              <AlertCircle size={16} className='text-amber-500 mt-0.5 flex-shrink-0' />
              <div>
                <p className='text-sm font-medium text-gray-900'>离线模式</p>
                <p className='text-xs text-gray-500 mt-1'>
                  后端服务暂时不可用，您仍可以继续使用界面功能，系统将提供模拟回复。
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
