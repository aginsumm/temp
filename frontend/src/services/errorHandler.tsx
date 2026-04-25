import React from 'react';
import { useToast } from '../components/common/Toast';

export interface AppError {
  code: string;
  message: string;
  details?: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

class ErrorHandler {
  private errors: AppError[] = [];
  private maxErrors = 100;

  handleError(error: Error | string, context?: Record<string, unknown>): AppError {
    const appError: AppError = {
      code: this.generateErrorCode(error),
      message: this.getUserFriendlyMessage(error),
      details: typeof error === 'object' ? error.message : error,
      timestamp: new Date().toISOString(),
      context,
    };

    this.errors.unshift(appError);
    if (this.errors.length > this.maxErrors) {
      this.errors.pop();
    }

    this.logError(appError);
    this.reportError();

    return appError;
  }

  private generateErrorCode(error: Error | string): string {
    if (typeof error === 'string') {
      return 'ERR_UNKNOWN';
    }

    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'ERR_NETWORK';
    }
    if (error.message.includes('timeout')) {
      return 'ERR_TIMEOUT';
    }
    if (error.message.includes('unauthorized') || error.message.includes('401')) {
      return 'ERR_AUTH';
    }
    if (error.message.includes('not found') || error.message.includes('404')) {
      return 'ERR_NOT_FOUND';
    }

    return 'ERR_UNKNOWN';
  }

  private getUserFriendlyMessage(error: Error | string): string {
    const message = typeof error === 'string' ? error : error.message;

    if (message.includes('network') || message.includes('fetch')) {
      return '网络连接失败，请检查网络设置';
    }
    if (message.includes('timeout')) {
      return '请求超时，请稍后重试';
    }
    if (message.includes('unauthorized') || message.includes('401')) {
      return '登录已过期，请重新登录';
    }
    if (message.includes('not found') || message.includes('404')) {
      return '请求的资源不存在';
    }
    if (message.includes('500')) {
      return '服务器错误，请稍后重试';
    }

    return '操作失败，请稍后重试';
  }

  private logError(error: AppError) {
    console.error('[ErrorHandler]', {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: error.timestamp,
      context: error.context,
    });
  }

  private reportError() {}

  getErrors(): AppError[] {
    return this.errors;
  }

  clearErrors() {
    this.errors = [];
  }

  getRecentErrors(count = 10): AppError[] {
    return this.errors.slice(0, count);
  }
}

export const errorHandler = new ErrorHandler();

export function useErrorHandler() {
  const toast = useToast();

  const handleError = (error: Error | string, context?: Record<string, unknown>) => {
    const appError = errorHandler.handleError(error, context);
    toast.error(appError.message);
    return appError;
  };

  const handleWarning = (message: string) => {
    toast.warning(message);
  };

  const handleSuccess = (message: string) => {
    toast.success(message);
  };

  const handleInfo = (message: string) => {
    toast.info(message);
  };

  return {
    handleError,
    handleWarning,
    handleSuccess,
    handleInfo,
    getErrors: errorHandler.getErrors.bind(errorHandler),
    clearErrors: errorHandler.clearErrors.bind(errorHandler),
  };
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    errorHandler.handleError(error, { componentStack: errorInfo.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[200px] p-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">出错了</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {this.state.error?.message || '发生了未知错误'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              重试
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
