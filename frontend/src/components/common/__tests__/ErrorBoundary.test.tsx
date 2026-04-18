import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

describe('ErrorBoundary', () => {
  const MockComponent = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
    if (shouldThrow) {
      throw new Error('Test error');
    }
    return <div>Success</div>;
  };

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <MockComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('should render fallback on error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>Error occurred</div>}>
        <MockComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error occurred')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('should render default error UI when no fallback provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <MockComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('组件加载出错')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('should call onError callback when error occurs', () => {
    const onError = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary onError={onError}>
        <MockComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
    consoleSpy.mockRestore();
  });

  it('should retry after error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;

    const ToggleComponent = () => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>Success after retry</div>;
    };

    render(
      <ErrorBoundary>
        <ToggleComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('组件加载出错')).toBeInTheDocument();

    shouldThrow = false;
    const retryButton = screen.getByText('重试');
    fireEvent.click(retryButton);

    expect(screen.getByText('Success after retry')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
