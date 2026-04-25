/**
 * 统一的重试工具函数
 * 为 Chat 和 Knowledge 模块提供一致的重试机制
 */

export interface RetryOptions {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 基础延迟时间（毫秒） */
  baseDelay?: number;
  /** 延迟时间的倍增系数 */
  backoffMultiplier?: number;
  /** 最大延迟时间（毫秒） */
  maxDelay?: number;
  /** 是否使用指数退避 */
  useExponentialBackoff?: boolean;
  /** 自定义重试条件 */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** 重试回调 */
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000,
  useExponentialBackoff: true,
  shouldRetry: () => true,
  onRetry: () => {},
};

/**
 * 检查错误是否为网络错误
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  
  const errorObj = error as Record<string, unknown>;
  const message = (errorObj.message as string)?.toLowerCase() || '';
  const isNetwork =
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('networkerror') ||
    errorObj.code === 'NETWORK_ERROR' ||
    errorObj.code === 'TIMEOUT' ||
    errorObj.code === 'CONNECTION_REFUSED';
  
  const status = (errorObj.status as number) || ((errorObj.response as Record<string, unknown>)?.status as number);
  const isServerError = status >= 500 && status < 600;
  const isTooManyRequests = status === 429;
  
  return isNetwork || isServerError || isTooManyRequests;
}

/**
 * 延迟指定毫秒数
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的异步操作执行函数
 * @param operation 要执行的异步操作
 * @param operationName 操作名称（用于日志）
 * @param options 重试选项
 * @returns 操作结果
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 检查是否应该重试
      if (!opts.shouldRetry(lastError, attempt)) {
        throw lastError;
      }
      
      // 检查是否为网络错误（总是重试）
      const shouldRetryDueToNetwork = isNetworkError(lastError);
      
      if (!shouldRetryDueToNetwork && attempt === opts.maxRetries) {
        throw lastError;
      }
      
      // 计算延迟时间
      let delayMs: number;
      if (opts.useExponentialBackoff) {
        delayMs = Math.min(
          opts.baseDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
          opts.maxDelay
        );
      } else {
        delayMs = opts.baseDelay;
      }
      
      // 添加随机抖动（避免多个请求同时重试）
      const jitter = Math.random() * 0.3 * delayMs;
      delayMs += jitter;
      
      // 记录重试日志
      console.warn(
        `${operationName} failed (attempt ${attempt}/${opts.maxRetries}), retrying in ${Math.round(delayMs)}ms...`,
        lastError.message
      );
      
      // 调用重试回调
      opts.onRetry?.(lastError, attempt);
      
      // 等待后重试
      await delay(delayMs);
    }
  }

  throw lastError || new Error(`${operationName} failed after ${opts.maxRetries} retries`);
}

/**
 * 带超时和重试的操作执行函数
 * @param operation 要执行的异步操作
 * @param timeout 超时时间（毫秒）
 * @param operationName 操作名称
 * @param retryOptions 重试选项
 * @returns 操作结果
 */
export async function withRetryAndTimeout<T>(
  operation: () => Promise<T>,
  timeout: number,
  operationName: string,
  retryOptions: RetryOptions = {}
): Promise<T> {
  const operationWithTimeout = async (): Promise<T> => {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${operationName} timed out after ${timeout}ms`)), timeout)
      ),
    ]);
  };

  return withRetry(operationWithTimeout, operationName, retryOptions);
}

/**
 * 创建可取消的重试操作
 */
export class RetryableOperation<T> {
  private aborted = false;
  private currentTimeout: NodeJS.Timeout | null = null;

  constructor(
    private operation: () => Promise<T>,
    private operationName: string,
    private options: RetryOptions = {}
  ) {}

  /**
   * 执行操作
   */
  async execute(): Promise<T> {
    let lastError: Error | null = null;
    const opts = { ...DEFAULT_OPTIONS, ...this.options };

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      if (this.aborted) {
        throw new Error(`${this.operationName} was aborted`);
      }

      try {
        return await this.operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!isNetworkError(lastError) && attempt === opts.maxRetries) {
          throw lastError;
        }

        if (this.aborted) {
          throw new Error(`${this.operationName} was aborted`);
        }

        let delayMs = opts.useExponentialBackoff
          ? Math.min(opts.baseDelay * Math.pow(opts.backoffMultiplier, attempt - 1), opts.maxDelay)
          : opts.baseDelay;

        const jitter = Math.random() * 0.3 * delayMs;
        delayMs += jitter;

        opts.onRetry?.(lastError, attempt);

        await new Promise<void>((resolve) => {
          this.currentTimeout = setTimeout(resolve, delayMs);
        });
      }
    }

    throw lastError || new Error(`${this.operationName} failed after ${opts.maxRetries} retries`);
  }

  /**
   * 中止操作
   */
  abort(): void {
    this.aborted = true;
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
  }
}

/**
 * 创建可取消的重试操作
 */
export function createRetryableOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): RetryableOperation<T> {
  return new RetryableOperation(operation, operationName, options);
}
