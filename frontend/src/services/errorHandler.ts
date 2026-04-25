import { LLMErrorType, classifyLLMError, getUserFriendlyMessage } from './llmErrorClassifier';

export enum ErrorCategory {
  NETWORK = 'network',
  AUTH = 'auth',
  SERVER = 'server',
  TIMEOUT = 'timeout',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
  LLM_SERVICE = 'llm_service',
}

export interface ErrorInfo {
  category: ErrorCategory;
  userMessage: string;
  technicalMessage: string;
  recoverable: boolean;
  retryable: boolean;
  isUserError: boolean;
  actionLabel?: string;
  actionCallback?: () => void;
  llmErrorType?: LLMErrorType;
}

export function categorizeError(error: Error | string | unknown): ErrorInfo {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // 首先尝试使用 LLM 错误分类器
  const llmErrorType = classifyLLMError(error);
  if (llmErrorType !== LLMErrorType.UNKNOWN) {
    return getLLMErrorInfo(llmErrorType);
  }

  if (error instanceof Error && 'status' in error) {
    const httpError = error as { status?: number };
    if (httpError.status === 401) {
      return {
        category: ErrorCategory.AUTH,
        userMessage: '登录已过期，请重新登录',
        technicalMessage: errorMessage,
        recoverable: true,
        retryable: false,
        isUserError: false,
        actionLabel: '重新登录',
      };
    }
    if (httpError.status === 429) {
      return {
        category: ErrorCategory.SERVER,
        userMessage: '请求过于频繁，请稍后再试',
        technicalMessage: errorMessage,
        recoverable: true,
        retryable: true,
        isUserError: false,
        actionLabel: '稍后重试',
      };
    }
    if (httpError.status === 404) {
      return {
        category: ErrorCategory.VALIDATION,
        userMessage: '请求的资源不存在',
        technicalMessage: errorMessage,
        recoverable: false,
        retryable: false,
        isUserError: false,
      };
    }
    if (httpError.status !== undefined && httpError.status >= 500 && httpError.status < 600) {
      return {
        category: ErrorCategory.SERVER,
        userMessage: '服务器暂时不可用，请稍后重试',
        technicalMessage: errorMessage,
        recoverable: true,
        retryable: true,
        isUserError: false,
        actionLabel: '重试',
      };
    }
  }

  if (
    lowerMessage.includes('401') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('auth')
  ) {
    return {
      category: ErrorCategory.AUTH,
      userMessage: '登录已过期，请重新登录',
      technicalMessage: errorMessage,
      recoverable: true,
      retryable: false,
      isUserError: false,
      actionLabel: '重新登录',
    };
  }

  if (
    lowerMessage.includes('429') ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('too many')
  ) {
    return {
      category: ErrorCategory.SERVER,
      userMessage: '请求过于频繁，请稍后再试',
      technicalMessage: errorMessage,
      recoverable: true,
      retryable: true,
      isUserError: false,
      actionLabel: '稍后重试',
    };
  }

  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('网络')
  ) {
    return {
      category: ErrorCategory.NETWORK,
      userMessage: '网络连接失败，请检查网络后重试',
      technicalMessage: errorMessage,
      recoverable: true,
      retryable: true,
      isUserError: false,
      actionLabel: '重试',
    };
  }

  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('超时') ||
    lowerMessage.includes('timed out')
  ) {
    return {
      category: ErrorCategory.TIMEOUT,
      userMessage: '请求超时，服务器响应较慢，请稍后重试',
      technicalMessage: errorMessage,
      recoverable: true,
      retryable: true,
      isUserError: false,
      actionLabel: '重试',
    };
  }

  if (
    lowerMessage.includes('500') ||
    lowerMessage.includes('502') ||
    lowerMessage.includes('503')
  ) {
    return {
      category: ErrorCategory.SERVER,
      userMessage: '服务器暂时不可用，请稍后重试',
      technicalMessage: errorMessage,
      recoverable: true,
      retryable: true,
      isUserError: false,
      actionLabel: '重试',
    };
  }

  if (lowerMessage.includes('404') || lowerMessage.includes('not found')) {
    return {
      category: ErrorCategory.VALIDATION,
      userMessage: '请求的资源不存在',
      technicalMessage: errorMessage,
      recoverable: false,
      retryable: false,
      isUserError: false,
    };
  }

  if (
    lowerMessage.includes('无法创建') ||
    lowerMessage.includes('无法删除') ||
    lowerMessage.includes('无法更新') ||
    lowerMessage.includes('cannot create') ||
    lowerMessage.includes('cannot delete') ||
    lowerMessage.includes('cannot update')
  ) {
    return {
      category: ErrorCategory.VALIDATION,
      userMessage: '操作无法完成，请检查输入后重试',
      technicalMessage: errorMessage,
      recoverable: true,
      retryable: true,
      isUserError: true,
      actionLabel: '重试',
    };
  }

  return {
    category: ErrorCategory.UNKNOWN,
    userMessage: '操作失败，请稍后重试',
    technicalMessage: errorMessage,
    recoverable: true,
    retryable: true,
    isUserError: false,
    actionLabel: '重试',
  };
}

export function getLLMErrorInfo(errorType: LLMErrorType): ErrorInfo {
  const errorInfoMap: Record<LLMErrorType, ErrorInfo> = {
    [LLMErrorType.API_KEY_MISSING]: {
      category: ErrorCategory.LLM_SERVICE,
      userMessage: getUserFriendlyMessage(LLMErrorType.API_KEY_MISSING),
      technicalMessage: 'API Key not configured',
      recoverable: false,
      retryable: false,
      isUserError: false,
      llmErrorType: LLMErrorType.API_KEY_MISSING,
    },
    [LLMErrorType.NETWORK_ERROR]: {
      category: ErrorCategory.NETWORK,
      userMessage: getUserFriendlyMessage(LLMErrorType.NETWORK_ERROR),
      technicalMessage: 'Network connection lost',
      recoverable: true,
      retryable: true,
      isUserError: false,
      actionLabel: '检查网络',
      llmErrorType: LLMErrorType.NETWORK_ERROR,
    },
    [LLMErrorType.TIMEOUT]: {
      category: ErrorCategory.TIMEOUT,
      userMessage: getUserFriendlyMessage(LLMErrorType.TIMEOUT),
      technicalMessage: 'Request timeout',
      recoverable: true,
      retryable: true,
      isUserError: false,
      actionLabel: '重试',
      llmErrorType: LLMErrorType.TIMEOUT,
    },
    [LLMErrorType.RATE_LIMIT]: {
      category: ErrorCategory.LLM_SERVICE,
      userMessage: getUserFriendlyMessage(LLMErrorType.RATE_LIMIT),
      technicalMessage: 'Rate limit exceeded',
      recoverable: true,
      retryable: true,
      isUserError: false,
      actionLabel: '稍后重试',
      llmErrorType: LLMErrorType.RATE_LIMIT,
    },
    [LLMErrorType.SERVICE_UNAVAILABLE]: {
      category: ErrorCategory.LLM_SERVICE,
      userMessage: getUserFriendlyMessage(LLMErrorType.SERVICE_UNAVAILABLE),
      technicalMessage: 'Service unavailable',
      recoverable: true,
      retryable: true,
      isUserError: false,
      actionLabel: '重试',
      llmErrorType: LLMErrorType.SERVICE_UNAVAILABLE,
    },
    [LLMErrorType.UNKNOWN]: {
      category: ErrorCategory.UNKNOWN,
      userMessage: getUserFriendlyMessage(LLMErrorType.UNKNOWN),
      technicalMessage: 'Unknown error',
      recoverable: true,
      retryable: true,
      isUserError: false,
      actionLabel: '重试',
      llmErrorType: LLMErrorType.UNKNOWN,
    },
  };

  return errorInfoMap[errorType] || errorInfoMap[LLMErrorType.UNKNOWN];
}

export function formatErrorMessage(error: Error | string | unknown, prefix = ''): string {
  const message = error instanceof Error ? error.message : String(error);
  return prefix ? `${prefix}: ${message}` : message;
}

export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorHandler?: (errorInfo: ErrorInfo) => void
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const errorInfo = categorizeError(error);
    console.error('Error occurred:', errorInfo);

    if (errorHandler) {
      errorHandler(errorInfo);
    }

    return null;
  }
}
