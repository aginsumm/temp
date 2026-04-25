import { AxiosError } from 'axios';
import { randomId } from '../utils/randomId';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  BUSINESS = 'business',
  SYSTEM = 'system',
  UNKNOWN = 'unknown',
}

export interface AppError {
  id: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: string;
  stack?: string;
  context?: Record<string, unknown>;
  originalError?: unknown;
  userMessage: string;
  recoverable: boolean;
  retryable: boolean;
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  route?: string;
  component?: string;
  action?: string;
  additionalData?: Record<string, unknown>;
}

class ErrorService {
  private errors: AppError[] = [];
  private maxErrors = 100;
  private errorHandlers: Map<ErrorCategory, ((error: AppError) => void)[]> = new Map();
  private globalHandlers: ((error: AppError) => void)[] = [];

  categorizeError(error: unknown): ErrorCategory {
    if (error instanceof AxiosError) {
      if (!error.response) {
        return ErrorCategory.NETWORK;
      }
      const status = error.response.status;
      if (status === 401) return ErrorCategory.AUTHENTICATION;
      if (status === 403) return ErrorCategory.AUTHORIZATION;
      if (status === 400 || status === 422) return ErrorCategory.VALIDATION;
      if (status >= 500) return ErrorCategory.SYSTEM;
    }

    if (error instanceof TypeError) {
      return ErrorCategory.SYSTEM;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('network') || message.includes('fetch')) {
        return ErrorCategory.NETWORK;
      }
      if (message.includes('validation') || message.includes('invalid')) {
        return ErrorCategory.VALIDATION;
      }
    }

    return ErrorCategory.UNKNOWN;
  }

  determineSeverity(error: unknown, category: ErrorCategory): ErrorSeverity {
    if (category === ErrorCategory.AUTHENTICATION || category === ErrorCategory.AUTHORIZATION) {
      return ErrorSeverity.HIGH;
    }

    if (error instanceof AxiosError) {
      const status = error.response?.status;
      if (status && status >= 500) return ErrorSeverity.CRITICAL;
      if (status && status >= 400) return ErrorSeverity.MEDIUM;
    }

    if (category === ErrorCategory.NETWORK) {
      return ErrorSeverity.HIGH;
    }

    if (category === ErrorCategory.VALIDATION) {
      return ErrorSeverity.LOW;
    }

    return ErrorSeverity.MEDIUM;
  }

  generateUserMessage(error: unknown, category: ErrorCategory): string {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const data = error.response?.data as { detail?: string; message?: string };

      if (data?.detail || data?.message) {
        return data.detail ?? data.message ?? '';
      }

      if (category === ErrorCategory.NETWORK) {
        return '网络连接失败，请检查网络设置';
      }

      switch (status) {
        case 400:
          return '请求参数有误，请检查输入';
        case 401:
          return '登录已过期，请重新登录';
        case 403:
          return '您没有权限执行此操作';
        case 404:
          return '请求的资源不存在';
        case 429:
          return '请求过于频繁，请稍后再试';
        case 500:
          return '服务器内部错误，请稍后再试';
        case 502:
        case 503:
        case 504:
          return '服务暂时不可用，请稍后再试';
        default:
          if (!error.response) {
            return '网络连接失败，请检查网络设置';
          }
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return '发生未知错误，请稍后再试';
  }

  isRecoverable(category: ErrorCategory): boolean {
    return category !== ErrorCategory.AUTHENTICATION && category !== ErrorCategory.AUTHORIZATION;
  }

  isRetryable(error: unknown, category: ErrorCategory): boolean {
    if (category === ErrorCategory.NETWORK) return true;
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      return status ? status >= 500 || status === 429 : true;
    }
    return false;
  }

  handleError(
    error: unknown,
    context?: ErrorContext,
    options?: { silent?: boolean; reraise?: boolean }
  ): AppError {
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(error, category);
    const userMessage = this.generateUserMessage(error, category);

    const appError: AppError = {
      id: randomId(),
      message: error instanceof Error ? error.message : String(error),
      category,
      severity,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined,
      context: context as Record<string, unknown>,
      originalError: error,
      userMessage,
      recoverable: this.isRecoverable(category),
      retryable: this.isRetryable(error, category),
    };

    this.errors.push(appError);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    this.logError(appError);

    if (!options?.silent) {
      this.notifyHandlers(appError);
    }

    if (options?.reraise) {
      throw error;
    }

    return appError;
  }

  private logError(error: AppError): void {
    const logData = {
      id: error.id,
      category: error.category,
      severity: error.severity,
      message: error.message,
      userMessage: error.userMessage,
      timestamp: error.timestamp,
      context: error.context,
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('[CRITICAL]', logData);
        break;
      case ErrorSeverity.HIGH:
        console.error('[HIGH]', logData);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('[MEDIUM]', logData);
        break;
      default:
        console.info('[LOW]', logData);
    }
  }

  private notifyHandlers(error: AppError): void {
    const categoryHandlers = this.errorHandlers.get(error.category) || [];
    categoryHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (e) {
        console.error('Error in error handler:', e);
      }
    });

    this.globalHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (e) {
        console.error('Error in global error handler:', e);
      }
    });
  }

  registerHandler(category: ErrorCategory, handler: (error: AppError) => void): () => void {
    if (!this.errorHandlers.has(category)) {
      this.errorHandlers.set(category, []);
    }
    this.errorHandlers.get(category)!.push(handler);

    return () => {
      const handlers = this.errorHandlers.get(category);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  registerGlobalHandler(handler: (error: AppError) => void): () => void {
    this.globalHandlers.push(handler);
    return () => {
      const index = this.globalHandlers.indexOf(handler);
      if (index > -1) {
        this.globalHandlers.splice(index, 1);
      }
    };
  }

  getErrors(options?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    limit?: number;
  }): AppError[] {
    let filtered = [...this.errors];

    if (options?.category) {
      filtered = filtered.filter((e) => e.category === options.category);
    }

    if (options?.severity) {
      filtered = filtered.filter((e) => e.severity === options.severity);
    }

    const limit = options?.limit || 50;
    return filtered.slice(-limit);
  }

  getErrorStats(): {
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    recentErrors: Array<{ id: string; message: string; timestamp: string }>;
  } {
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    this.errors.forEach((error) => {
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    });

    return {
      total: this.errors.length,
      byCategory,
      bySeverity,
      recentErrors: this.errors.slice(-10).map((e) => ({
        id: e.id,
        message: e.message,
        timestamp: e.timestamp,
      })),
    };
  }

  clearErrors(): void {
    this.errors = [];
  }

  setupGlobalErrorHandling(): void {
    window.addEventListener('error', (event) => {
      this.handleError(event.error, {
        component: 'global',
        action: 'uncaught_error',
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, {
        component: 'global',
        action: 'unhandled_promise_rejection',
      });
    });
  }
}

export const errorService = new ErrorService();

export function handleApiError(error: unknown, context?: ErrorContext): AppError {
  return errorService.handleError(error, context);
}

export function withErrorHandling<T extends (...args: unknown[]) => unknown>(
  fn: T,
  context?: ErrorContext
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((error) => {
          errorService.handleError(error, context);
          throw error;
        });
      }
      return result;
    } catch (error) {
      errorService.handleError(error, context);
      throw error;
    }
  }) as T;
}

export function useErrorHandling() {
  return {
    handleError: errorService.handleError.bind(errorService),
    registerHandler: errorService.registerHandler.bind(errorService),
    registerGlobalHandler: errorService.registerGlobalHandler.bind(errorService),
    getErrors: errorService.getErrors.bind(errorService),
    getErrorStats: errorService.getErrorStats.bind(errorService),
  };
}
