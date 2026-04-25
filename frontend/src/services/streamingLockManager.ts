/**
 * 流式响应锁管理器
 * 提供带超时的锁机制，防止流式响应永久阻塞
 */

const STREAMING_LOCK_TIMEOUT = 60000; // 60秒超时

type TimeoutCallback = (messageId: string) => void;

interface LockEntry {
  timestamp: number;
  timeoutId: NodeJS.Timeout;
  onTimeout?: TimeoutCallback;
}

class StreamingLockManager {
  private locks: Map<string, LockEntry> = new Map();
  private globalTimeoutCallback: TimeoutCallback | null = null;

  /**
   * 设置全局超时回调
   * @param callback 超时时的回调函数
   */
  setOnTimeout(callback: TimeoutCallback): void {
    this.globalTimeoutCallback = callback;
  }

  /**
   * 移除全局超时回调
   */
  removeOnTimeout(): void {
    this.globalTimeoutCallback = null;
  }

  /**
   * 尝试获取锁
   * @param messageId 消息ID
   * @param onTimeout 可选的超时回调，优先级高于全局回调
   * @returns 是否成功获取锁
   */
  acquire(messageId: string, onTimeout?: TimeoutCallback): boolean {
    // 清理过期锁
    this.cleanupExpiredLocks();

    if (this.locks.has(messageId)) {
      console.warn('Streaming request already in progress for message:', messageId);
      return false;
    }

    // 设置超时自动释放
    const timeoutId = setTimeout(() => {
      console.warn('Streaming lock timeout for message:', messageId);
      // 调用超时回调通知调用方
      const entry = this.locks.get(messageId);
      if (entry?.onTimeout) {
        entry.onTimeout(messageId);
      } else if (this.globalTimeoutCallback) {
        this.globalTimeoutCallback(messageId);
      }
      this.release(messageId);
    }, STREAMING_LOCK_TIMEOUT);

    this.locks.set(messageId, {
      timestamp: Date.now(),
      timeoutId,
      onTimeout,
    });

    return true;
  }

  /**
   * 释放锁
   * @param messageId 消息ID
   */
  release(messageId: string): void {
    const entry = this.locks.get(messageId);
    if (entry) {
      clearTimeout(entry.timeoutId);
      this.locks.delete(messageId);
    }
  }

  /**
   * 检查是否已锁定
   * @param messageId 消息ID
   */
  isLocked(messageId: string): boolean {
    return this.locks.has(messageId);
  }

  /**
   * 获取锁的信息
   * @param messageId 消息ID
   */
  getLockInfo(messageId: string): { timestamp: number; elapsed: number } | null {
    const entry = this.locks.get(messageId);
    if (!entry) return null;
    return {
      timestamp: entry.timestamp,
      elapsed: Date.now() - entry.timestamp,
    };
  }

  /**
   * 清理过期锁
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    this.locks.forEach((entry, messageId) => {
      if (now - entry.timestamp > STREAMING_LOCK_TIMEOUT) {
        console.warn('Cleaning up expired lock for message:', messageId);
        // 调用超时回调通知调用方
        if (entry.onTimeout) {
          entry.onTimeout(messageId);
        } else if (this.globalTimeoutCallback) {
          this.globalTimeoutCallback(messageId);
        }
        clearTimeout(entry.timeoutId);
        this.locks.delete(messageId);
      }
    });
  }

  /**
   * 清理所有锁
   */
  clear(): void {
    this.locks.forEach((entry) => {
      clearTimeout(entry.timeoutId);
    });
    this.locks.clear();
  }

  /**
   * 获取当前锁的数量
   */
  getLockCount(): number {
    return this.locks.size;
  }
}

export const streamingLockManager = new StreamingLockManager();
export default streamingLockManager;
