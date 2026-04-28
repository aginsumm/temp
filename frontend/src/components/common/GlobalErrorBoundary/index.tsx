import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // 调用自定义错误处理
    this.props.onError?.(error, errorInfo);

    // 记录错误到监控服务
    if (import.meta.env.PROD) {
      this.reportError(error, errorInfo);
    }

    // 在开发环境下打印详细错误
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  private async reportError(error: Error, errorInfo: ErrorInfo) {
    try {
      // 可以发送到错误监控服务
      await fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });
    } catch (e) {
      console.error('Failed to report error:', e);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // 重新加载页面或组件
    window.location.reload();
  };

  handleReportBug = () => {
    const { error, errorInfo } = this.state;
    const bugReport = {
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    // 复制到剪贴板
    navigator.clipboard.writeText(JSON.stringify(bugReport, null, 2));
    alert('错误报告已复制到剪贴板，请提交给开发团队');
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"
              >
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </motion.div>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">出错了</h2>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {this.props.name ? `${this.props.name} 组件发生错误` : '应用程序遇到意外错误'}
              </p>

              {import.meta.env.DEV && this.state.error && (
                <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg text-left">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    错误详情
                  </h3>
                  <pre className="text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40">
                    {this.state.error.message}
                  </pre>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={this.handleRetry}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  重新加载
                </button>

                <button
                  onClick={this.handleReportBug}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
                >
                  <Bug className="w-4 h-4" />
                  报告问题
                </button>
              </div>

              {this.state.errorInfo && (
                <details className="mt-6 text-left">
                  <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                    技术详情
                  </summary>
                  <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-60">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 函数组件错误边界（使用 Hook 方式）
 */
interface FunctionErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
  name?: string;
}

export function FunctionErrorBoundary({ children, fallback, name }: FunctionErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);

  const handleError = (err: Error) => {
    setError(err);
  };

  const resetError = () => {
    setError(null);
  };

  if (error) {
    if (fallback) {
      return fallback(error, resetError);
    }

    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          {name ? `${name} 组件出错` : '组件错误'}
        </h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error.message}</p>
        <button
          onClick={resetError}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return <ErrorMonitor onError={handleError}>{children}</ErrorMonitor>;
}

/**
 * 错误监控器（内部使用）
 */
function ErrorMonitor({
  children,
  onError,
}: {
  children: ReactNode;
  onError: (error: Error) => void;
}) {
  useEffect(() => {
    const errorHandler = (error: ErrorEvent) => {
      onError(error.error);
    };

    const promiseRejectionHandler = (event: PromiseRejectionEvent) => {
      onError(event.reason);
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', promiseRejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', promiseRejectionHandler);
    };
  }, [onError]);

  return <>{children}</>;
}
