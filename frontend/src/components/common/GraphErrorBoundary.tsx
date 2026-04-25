import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class GraphErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    if (
      error.message.includes('WebGL') ||
      error.message.includes('canvas') ||
      error.message.includes('ECharts')
    ) {
      return { hasError: true, error };
    }
    throw error;
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Graph rendering error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  public render() {
    if (this.state.hasError) {
      const isWebGLError = this.state.error?.message.includes('WebGL');

      return (
        <div
          className="flex flex-col items-center justify-center h-full min-h-[200px] p-4"
          style={{ background: 'var(--color-background)' }}
        >
          <div className="text-center max-w-sm">
            <div
              className="w-10 h-10 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-warning-light, #fef3c7)' }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ color: 'var(--color-warning, #f59e0b)' }}
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              {isWebGLError ? 'WebGL 渲染不可用' : '图谱渲染出错'}
            </h4>

            <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              {isWebGLError
                ? '您的浏览器或设备不支持 WebGL，图谱将以简化模式显示'
                : '图谱渲染时发生错误，请尝试重新加载'}
            </p>

            <button
              onClick={this.handleRetry}
              className="px-3 py-1.5 text-xs rounded-md transition-colors"
              style={{
                background: 'var(--color-primary)',
                color: 'white',
              }}
            >
              {isWebGLError ? '使用简化模式' : '重试'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GraphErrorBoundary;

// eslint-disable-next-line react-refresh/only-export-components
export function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function checkCanvasSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('2d');
  } catch {
    return false;
  }
}
