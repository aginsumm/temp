import { create } from 'zustand';
import {
  connectionManager,
  ConnectionStatus,
  ConnectionState,
  QueuedRequest,
} from '../services/connectionManager';

interface NetworkState {
  status: ConnectionStatus;
  latency: number | null;
  lastConnected: Date | null;
  reconnectAttempts: number;
  queuedRequestsCount: number;
  httpAvailable: boolean;
  wsAvailable: boolean;
  isManualReconnect: boolean;

  forceReconnect: () => Promise<boolean>;
  checkHealth: () => Promise<boolean>;
  getQueuedRequests: () => QueuedRequest[];
  clearQueue: () => void;
  setManualReconnect: (value: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  status: 'online',
  latency: null,
  lastConnected: null,
  reconnectAttempts: 0,
  queuedRequestsCount: 0,
  httpAvailable: true,
  wsAvailable: true,
  isManualReconnect: false,

  forceReconnect: async () => {
    set({ isManualReconnect: true });
    const result = await connectionManager.forceReconnect();
    set({ isManualReconnect: false });
    return result;
  },

  checkHealth: async () => {
    return connectionManager.checkHealth();
  },

  getQueuedRequests: () => {
    return connectionManager.getQueuedRequests();
  },

  clearQueue: () => {
    connectionManager.clearQueue();
    set({ queuedRequestsCount: 0 });
  },

  setManualReconnect: (value: boolean) => {
    set({ isManualReconnect: value });
  },
}));

connectionManager.subscribe((state: ConnectionState) => {
  useNetworkStore.setState({
    status: state.status,
    latency: state.latency,
    lastConnected: state.lastConnected,
    reconnectAttempts: state.reconnectAttempts,
    queuedRequestsCount: state.queuedRequestsCount,
    httpAvailable: state.httpAvailable,
    wsAvailable: state.wsAvailable,
  });
});

export const getConnectionQuality = (
  latency: number | null
): 'excellent' | 'good' | 'poor' | 'unknown' => {
  if (latency === null) return 'unknown';
  if (latency < 100) return 'excellent';
  if (latency < 300) return 'good';
  return 'poor';
};

export const getStatusMessage = (status: ConnectionStatus): string => {
  switch (status) {
    case 'online':
      return '网络连接正常';
    case 'offline':
      return '网络已断开';
    case 'reconnecting':
      return '正在重新连接...';
    case 'degraded':
      return '部分服务不可用';
    default:
      return '未知状态';
  }
};

export const getStatusColor = (status: ConnectionStatus): string => {
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
