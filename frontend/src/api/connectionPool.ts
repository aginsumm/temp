import axios, { AxiosRequestConfig } from 'axios';

class ConnectionPool {
  private static instance: ConnectionPool;
  private activeConnections: Map<string, AbortController>;
  private maxConnections: number = 10;
  private connectionQueue: Array<() => void>;

  private constructor() {
    this.activeConnections = new Map();
    this.connectionQueue = [];
  }

  static getInstance(): ConnectionPool {
    if (!ConnectionPool.instance) {
      ConnectionPool.instance = new ConnectionPool();
    }
    return ConnectionPool.instance;
  }

  async request<T>(config: AxiosRequestConfig): Promise<T> {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const requestId = `${Date.now()}_${Math.random()}`;

      const executeRequest = async () => {
        try {
          this.activeConnections.set(requestId, controller);
          const response = await axios({
            ...config,
            signal: controller.signal,
          });
          this.activeConnections.delete(requestId);
          this.processQueue();
          resolve(response.data);
        } catch (error) {
          this.activeConnections.delete(requestId);
          this.processQueue();
          reject(error);
        }
      };

      if (this.activeConnections.size < this.maxConnections) {
        executeRequest();
      } else {
        this.connectionQueue.push(executeRequest);
      }
    });
  }

  private processQueue() {
    if (this.connectionQueue.length > 0 && this.activeConnections.size < this.maxConnections) {
      const nextRequest = this.connectionQueue.shift();
      if (nextRequest) {
        nextRequest();
      }
    }
  }

  cancelAll() {
    this.activeConnections.forEach((controller) => controller.abort());
    this.activeConnections.clear();
    this.connectionQueue = [];
  }

  getActiveCount(): number {
    return this.activeConnections.size;
  }

  getQueueCount(): number {
    return this.connectionQueue.length;
  }
}

export default ConnectionPool;
