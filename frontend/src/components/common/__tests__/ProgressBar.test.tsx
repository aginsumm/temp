import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar, { LoadingOverlay } from '../ProgressBar';
import '@testing-library/jest-dom';

describe('ProgressBar', () => {
  it('should render with correct progress', () => {
    render(<ProgressBar progress={50} />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('should clamp progress between 0 and 100', () => {
    const { rerender } = render(<ProgressBar progress={150} />);
    expect(screen.getByText('100%')).toBeInTheDocument();

    rerender(<ProgressBar progress={-50} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should show custom label', () => {
    render(<ProgressBar progress={75} label="Loading..." />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should hide percentage when showPercentage is false', () => {
    render(<ProgressBar progress={50} showPercentage={false} />);

    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });
});

describe('LoadingOverlay', () => {
  it('should not render when isLoading is false', () => {
    render(<LoadingOverlay isLoading={false} />);

    expect(screen.queryByText(/加载/i)).not.toBeInTheDocument();
  });

  it('should render with default message', () => {
    render(<LoadingOverlay isLoading={true} />);

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    render(<LoadingOverlay isLoading={true} message="Custom loading..." />);

    expect(screen.getByText('Custom loading...')).toBeInTheDocument();
  });

  it('should render with progress bar when progress is provided', () => {
    render(<LoadingOverlay isLoading={true} progress={60} />);

    expect(screen.getByText('60%')).toBeInTheDocument();
  });
});
