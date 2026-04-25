export enum LLMErrorType {
  API_KEY_MISSING = 'API_KEY_MISSING',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UNKNOWN = 'UNKNOWN',
}

export interface LLMServiceStatus {
  state: 'healthy' | 'degraded' | 'offline' | 'recovering';
  isDegraded: boolean;
  lastHealthCheck?: string;
  errorCounts: {
    total: number;
    consecutive: number;
    lastErrorTime?: string;
  };
}

export function getUserFriendlyMessage(errorType: LLMErrorType): string {
  const messages = {
    [LLMErrorType.API_KEY_MISSING]: 'AI服务暂未配置，已切换到智能助手模式（功能受限）',
    [LLMErrorType.NETWORK_ERROR]: '网络连接中断，正在尝试重新连接...',
    [LLMErrorType.TIMEOUT]: '响应超时，AI正在处理复杂问题，请耐心等待',
    [LLMErrorType.RATE_LIMIT]: '请求过于频繁，请稍后再试',
    [LLMErrorType.SERVICE_UNAVAILABLE]: 'AI服务暂时不可用，已切换到备用模式',
    [LLMErrorType.UNKNOWN]: 'AI服务出现异常，请稍后再试',
  };
  return messages[errorType] || messages[LLMErrorType.UNKNOWN];
}

export function classifyLLMError(error: unknown): LLMErrorType {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('api_key') || message.includes('dashscope_api_key')) {
      return LLMErrorType.API_KEY_MISSING;
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return LLMErrorType.TIMEOUT;
    }
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return LLMErrorType.NETWORK_ERROR;
    }
    
    if (message.includes('429') || message.includes('rate limit') || message.includes('too many requests')) {
      return LLMErrorType.RATE_LIMIT;
    }
    
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
      return LLMErrorType.SERVICE_UNAVAILABLE;
    }
  }
  
  return LLMErrorType.UNKNOWN;
}

export function shouldRetry(error: unknown): boolean {
  const errorType = classifyLLMError(error);
  return errorType !== LLMErrorType.API_KEY_MISSING && errorType !== LLMErrorType.RATE_LIMIT;
}

export function getRetryDelay(attempt: number): number {
  const delays = [1000, 2000, 5000];
  return delays[Math.min(attempt, delays.length - 1)] || 5000;
}

export async function checkLLMHealth(): Promise<LLMServiceStatus | null> {
  try {
    const response = await fetch('/api/v1/health');
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Health check failed:', error);
    return null;
  }
}
