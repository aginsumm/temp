import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let connectionStatus = true;
const connectionListeners = new Set<(connected: boolean) => void>();

export const subscribeToConnectionStatus = (callback: (connected: boolean) => void) => {
  connectionListeners.add(callback);
  return () => connectionListeners.delete(callback);
};

export const getConnectionStatus = () => connectionStatus;

const notifyConnectionStatus = (connected: boolean) => {
  connectionStatus = connected;
  connectionListeners.forEach((callback) => callback(connected));
};

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    if (!connectionStatus) {
      notifyConnectionStatus(true);
    }
    return response;
  },
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || !error.response) {
      notifyConnectionStatus(false);
    } else if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (error.response?.status >= 500) {
      notifyConnectionStatus(false);
    }
    return Promise.reject(error);
  }
);

export const checkApiConnection = async (): Promise<boolean> => {
  try {
    await apiClient.get('/health', { timeout: 5000 });
    if (!connectionStatus) {
      notifyConnectionStatus(true);
    }
    return true;
  } catch {
    notifyConnectionStatus(false);
    return false;
  }
};

export default apiClient;
