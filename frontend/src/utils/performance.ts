import { useCallback, useRef, useState, useEffect } from 'react';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: {
    avgRenderTime: number;
    avgInteractionTime: number;
    memoryUsage: number | null;
    fps: number | null;
  };
}

/**
 * 防抖函数 - 延迟执行函数，直到等待时间结束后才执行
 * @param func 需要防抖的函数
 * @param wait 等待时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数 - 限制函数在指定时间内只执行一次
 * @param func 需要节流的函数
 * @param limit 时间限制（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 大数据量处理优化 - 分块处理大型数组
 * @param array 待处理的数组
 * @param processor 处理函数
 * @param chunkSize 分块大小
 * @returns Promise
 */
export async function processInChunks<T, R>(
  array: T[],
  processor: (chunk: T[]) => R[],
  chunkSize: number = 100
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    const chunkResults = processor(chunk);
    results.push(...chunkResults);

    // 让出主线程，避免阻塞 UI
    if (i + chunkSize < array.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return results;
}

/**
 * 使用 requestIdleCallback 进行低优先级处理
 * @param callback 回调函数
 * @param timeout 超时时间
 */
export function idleCallback(callback: (deadline: IdleDeadline) => void, timeout?: number): void {
  if ('requestIdleCallback' in window) {
    const requestIdleCallback = window.requestIdleCallback as (
      cb: (deadline: IdleDeadline) => void,
      opts?: { timeout?: number }
    ) => number;
    requestIdleCallback(callback, { timeout });
  } else {
    // Fallback: 使用 setTimeout
    setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => 50,
      } as IdleDeadline);
    }, 1);
  }
}

export function usePerformanceMonitor(componentName: string) {
  const metricsRef = useRef<PerformanceMetric[]>([]);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsIntervalRef = useRef<number | null>(null);

  const [fps, setFps] = useState<number | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);

  const recordMetric = useCallback(
    (name: string, value: number, unit: string = 'ms') => {
      const metric: PerformanceMetric = {
        name: `${componentName}.${name}`,
        value,
        unit,
        timestamp: performance.now(),
      };
      metricsRef.current.push(metric);
    },
    [componentName]
  );

  const measureRender = useCallback(
    (renderFn: () => void) => {
      const start = performance.now();
      renderFn();
      const duration = performance.now() - start;
      recordMetric('render', duration);
      return duration;
    },
    [recordMetric]
  );

  const measureAsync = useCallback(
    async <T>(name: string, asyncFn: () => Promise<T>): Promise<T> => {
      const start = performance.now();
      try {
        const result = await asyncFn();
        const duration = performance.now() - start;
        recordMetric(name, duration);
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        recordMetric(`${name}.error`, duration);
        throw error;
      }
    },
    [recordMetric]
  );

  const startFpsMonitor = useCallback(() => {
    if (fpsIntervalRef.current !== null) {
      return;
    }

    const measureFps = () => {
      frameCountRef.current++;
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 1000) {
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
        setFps(currentFps);
        recordMetric('fps', currentFps, 'fps');
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      fpsIntervalRef.current = requestAnimationFrame(measureFps);
    };

    fpsIntervalRef.current = requestAnimationFrame(measureFps);
  }, [recordMetric]);

  const stopFpsMonitor = useCallback(() => {
    if (fpsIntervalRef.current !== null) {
      cancelAnimationFrame(fpsIntervalRef.current);
      fpsIntervalRef.current = null;
    }
  }, []);

  const measureMemory = useCallback(() => {
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    if (memory) {
      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      setMemoryUsage(usedMB);
      recordMetric('memory', usedMB, 'MB');
      return usedMB;
    }
    return null;
  }, [recordMetric]);

  const getReport = useCallback((): PerformanceReport => {
    const metrics = [...metricsRef.current];

    const renderMetrics = metrics.filter((m) => m.name.includes('.render'));
    const interactionMetrics = metrics.filter(
      (m) => !m.name.includes('.render') && !m.name.includes('.fps') && !m.name.includes('.memory')
    );

    return {
      metrics,
      summary: {
        avgRenderTime:
          renderMetrics.length > 0
            ? renderMetrics.reduce((sum, m) => sum + m.value, 0) / renderMetrics.length
            : 0,
        avgInteractionTime:
          interactionMetrics.length > 0
            ? interactionMetrics.reduce((sum, m) => sum + m.value, 0) / interactionMetrics.length
            : 0,
        memoryUsage,
        fps,
      },
    };
  }, [fps, memoryUsage]);

  const clearMetrics = useCallback(() => {
    metricsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      stopFpsMonitor();
    };
  }, [stopFpsMonitor]);

  return {
    recordMetric,
    measureRender,
    measureAsync,
    startFpsMonitor,
    stopFpsMonitor,
    measureMemory,
    getReport,
    clearMetrics,
    fps,
    memoryUsage,
  };
}

export function measureFunction<T>(name: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  performance.mark(`${name}-start`);
  performance.mark(`${name}-end`);
  performance.measure(name, `${name}-start`, `${name}-end`);

  console.debug(`[Performance] ${name}: ${duration.toFixed(2)}ms`);

  return result;
}

export async function measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  console.debug(`[Performance] ${name}: ${duration.toFixed(2)}ms`);

  return result;
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  opsPerSecond: number;
}

export async function benchmark(
  name: string,
  fn: () => Promise<void> | void,
  options: {
    iterations?: number;
    warmupIterations?: number;
  } = {}
): Promise<BenchmarkResult> {
  const { iterations = 100, warmupIterations = 10 } = options;

  for (let i = 0; i < warmupIterations; i++) {
    await fn();
  }

  const times: number[] = [];
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const iterStart = performance.now();
    await fn();
    times.push(performance.now() - iterStart);
  }

  const totalTime = performance.now() - start;

  return {
    name,
    iterations,
    totalTimeMs: totalTime,
    avgTimeMs: times.reduce((a, b) => a + b, 0) / times.length,
    minTimeMs: Math.min(...times),
    maxTimeMs: Math.max(...times),
    opsPerSecond: (iterations / totalTime) * 1000,
  };
}

export function measureComponentRender(
  componentName: string,
  onMeasure?: (duration: number) => void
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends new (...args: any[]) => object>(constructor: T) {
    return class extends constructor {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(...args: any[]) {
        super(...args);

        const originalRender = (this as unknown as { render?: () => unknown }).render;
        if (originalRender) {
          (this as unknown as { render: () => unknown }).render = function (this: unknown) {
            const start = performance.now();
            const result = originalRender.call(this);
            const duration = performance.now() - start;

            console.debug(`[Performance] ${componentName}.render: ${duration.toFixed(2)}ms`);
            onMeasure?.(duration);

            return result;
          };
        }
      }
    };
  };
}

export function useRenderTime(componentName: string): number {
  const renderTimeRef = useRef(0);
  const startTimeRef = useRef(performance.now());

  useEffect(() => {
    renderTimeRef.current = performance.now() - startTimeRef.current;
    startTimeRef.current = performance.now();
    console.debug(`[Performance] ${componentName} render time:`, renderTimeRef.current);
  });

  return renderTimeRef.current;
}

export function createPerformanceObserver(callback: (entry: PerformanceEntry) => void) {
  if (typeof PerformanceObserver === 'undefined') {
    return null;
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      callback(entry);
    }
  });

  return observer;
}

export function observeLongTasks(callback: (entry: PerformanceEntry) => void) {
  const observer = createPerformanceObserver(callback);

  if (observer) {
    observer.observe({ entryTypes: ['longtask'] });
    return () => observer.disconnect();
  }

  return () => {};
}

export function observeLayoutShifts(callback: (entry: PerformanceEntry) => void) {
  const observer = createPerformanceObserver(callback);

  if (observer) {
    observer.observe({ entryTypes: ['layout-shift'] });
    return () => observer.disconnect();
  }

  return () => {};
}

export function getWebVitals() {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

  if (!navigation) {
    return null;
  }

  return {
    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcp: navigation.connectEnd - navigation.connectStart,
    request: navigation.responseStart - navigation.requestStart,
    response: navigation.responseEnd - navigation.responseStart,
    domProcessing: navigation.domComplete - navigation.domInteractive,
    totalLoadTime: navigation.loadEventEnd - navigation.fetchStart,
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
    ttfb: navigation.responseStart - navigation.requestStart,
  };
}
