/**
 * 全局错误处理和通知服务
 * 提供统一的错误处理、用户通知和日志记录功能
 */

export type NotificationType = 'success' | 'info' | 'warning' | 'error';

export interface NotificationOptions {
  type: NotificationType;
  message: string;
  description?: string;
  duration?: number; // 毫秒，0 表示不自动关闭
  showClose?: boolean;
}

export interface ErrorHandlerOptions {
  showToast?: boolean;
  logError?: boolean;
  retryable?: boolean;
  maxRetries?: number;
  onRetry?: () => void;
  onError?: (error: Error) => void;
}

class NotificationService {
  private static instance: NotificationService;
  private container: HTMLElement | null = null;

  private constructor() {
    this.initContainer();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private initContainer(): void {
    // 创建通知容器
    const container = document.createElement('div');
    container.id = 'notification-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
    this.container = container;
  }

  show(options: NotificationOptions): void {
    const { type, message, description, duration = 3000, showClose = true } = options;

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
      background: white;
      border-left: 4px solid;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      padding: 12px 16px;
      min-width: 300px;
      max-width: 450px;
      pointer-events: auto;
      animation: slideIn 0.3s ease-out;
      border-color: ${this.getBorderColor(type)};
    `;

    const icon = this.getIcon(type);
    const titleColor = this.getTitleColor(type);

    notification.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: start;">
        <span style="font-size: 18px;">${icon}</span>
        <div style="flex: 1;">
          <div style="font-weight: 500; color: ${titleColor}; margin-bottom: 4px;">
            ${message}
          </div>
          ${description ? `<div style="font-size: 13px; color: #666;">${description}</div>` : ''}
        </div>
        ${
          showClose
            ? `
          <button 
            onclick="this.parentElement.parentElement.remove()" 
            style="background: none; border: none; cursor: pointer; padding: 0; font-size: 16px; color: #999;"
          >
            ×
          </button>
        `
            : ''
        }
      </div>
    `;

    this.container?.appendChild(notification);

    // 自动关闭
    if (duration > 0) {
      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
      }, duration);
    }
  }

  private getBorderColor(type: NotificationType): string {
    const colors = {
      success: '#52c41a',
      info: '#1890ff',
      warning: '#faad14',
      error: '#ff4d4f',
    };
    return colors[type];
  }

  private getIcon(type: NotificationType): string {
    const icons = {
      success: '✓',
      info: 'ℹ',
      warning: '⚠',
      error: '✕',
    };
    return icons[type];
  }

  private getTitleColor(type: NotificationType): string {
    const colors = {
      success: '#52c41a',
      info: '#1890ff',
      warning: '#faad14',
      error: '#ff4d4f',
    };
    return colors[type];
  }

  success(message: string, description?: string): void {
    this.show({ type: 'success', message, description });
  }

  info(message: string, description?: string): void {
    this.show({ type: 'info', message, description });
  }

  warning(message: string, description?: string): void {
    this.show({ type: 'warning', message, description });
  }

  error(message: string, description?: string): void {
    this.show({ type: 'error', message, description });
  }
}

class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private notificationService: NotificationService;
  private errorQueue: Map<string, number> = new Map(); // 错误去重

  private constructor() {
    this.notificationService = NotificationService.getInstance();
    this.initGlobalHandler();
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  private initGlobalHandler(): void {
    // 全局未捕获错误
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message));
    });

    // 全局未捕获 Promise 错误
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason || new Error('Unhandled promise rejection'));
    });
  }

  handleError(error: Error | unknown, options: ErrorHandlerOptions = {}): void {
    const {
      showToast = true,
      logError = true,
      retryable = false,
      maxRetries = 3,
      onRetry,
      onError,
    } = options;

    const errorObj = error instanceof Error ? error : new Error(String(error));
    const errorKey = this.getErrorKey(errorObj);

    // 错误去重（避免相同错误频繁提示）
    const now = Date.now();
    const lastShow = this.errorQueue.get(errorKey) || 0;
    if (now - lastShow < 1000) {
      // 1 秒内相同错误只显示一次
      return;
    }
    this.errorQueue.set(errorKey, now);

    // 记录错误日志
    if (logError) {
      console.error('[GlobalErrorHandler]', errorObj);
    }

    // 显示错误提示
    if (showToast) {
      const message = this.getErrorMessage(errorObj);
      const description = retryable ? `将自动重试（最多 ${maxRetries} 次）` : undefined;

      this.notificationService.error(message, description);
    }

    // 调用错误回调
    if (onError) {
      onError(errorObj);
    }

    // 处理可重试错误
    if (retryable && onRetry) {
      this.handleRetry(errorObj, onRetry, maxRetries);
    }
  }

  private async handleRetry(_error: Error, onRetry: () => void, maxRetries: number): Promise<void> {
    let retries = 0;

    while (retries < maxRetries) {
      retries++;

      // 指数退避
      const delay = Math.min(1000 * Math.pow(2, retries), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        await onRetry();
        return; // 成功则退出
      } catch (retryError) {
        if (retries === maxRetries) {
          this.notificationService.error('操作失败', `重试 ${maxRetries} 次后仍然失败，请稍后再试`);
        }
      }
    }
  }

  private getErrorKey(error: Error): string {
    return `${error.name}:${error.message}`;
  }

  private getErrorMessage(error: Error): string {
    // 常见错误类型映射
    const errorMessages: Record<string, string> = {
      TypeError: '类型错误',
      ReferenceError: '引用错误',
      SyntaxError: '语法错误',
      RangeError: '范围错误',
      URIError: 'URI 错误',
      NetworkError: '网络错误',
      TimeoutError: '请求超时',
    };

    if (errorMessages[error.name]) {
      return errorMessages[error.name];
    }

    // HTTP 错误
    if (error.message.includes('404')) {
      return '请求的资源不存在';
    }
    if (error.message.includes('401') || error.message.includes('403')) {
      return '权限不足，请登录后重试';
    }
    if (error.message.includes('500')) {
      return '服务器错误，请稍后再试';
    }
    if (error.message.includes('502') || error.message.includes('503')) {
      return '服务暂时不可用，请稍后再试';
    }

    // 默认错误消息
    return error.message || '发生未知错误';
  }
}

// 导出单例
export const notificationService = NotificationService.getInstance();
export const globalErrorHandler = GlobalErrorHandler.getInstance();

// 辅助函数：包装异步操作
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options: ErrorHandlerOptions & {
    successMessage?: string;
  } = {}
): Promise<T> {
  const { successMessage, ...errorOptions } = options;

  try {
    const result = await operation();

    if (successMessage) {
      notificationService.success(successMessage);
    }

    return result;
  } catch (error) {
    globalErrorHandler.handleError(error, {
      ...errorOptions,
      showToast: true,
    });
    throw error;
  }
}

// 添加 CSS 动画
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
