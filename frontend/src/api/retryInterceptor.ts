import axios, { AxiosError, AxiosRequestConfig } from 'axios';

interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryCondition?: (error: AxiosError) => boolean;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryCondition: (error) => {
    return (
      error.code === 'ECONNABORTED' ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNREFUSED' ||
      (error.response?.status ?? 0) >= 500
    );
  },
};

export function createRetryInterceptor(config: Partial<RetryConfig> = {}) {
  const retryConfig = { ...defaultRetryConfig, ...config };
  const retryMap = new Map<string, number>();

  return {
    requestInterceptor: (requestConfig: AxiosRequestConfig) => {
      const requestId = requestConfig.url || 'unknown';
      retryMap.set(requestId, 0);
      return requestConfig;
    },

    responseInterceptor: async (error: AxiosError) => {
      const requestId = error.config?.url || 'unknown';
      const retryCount = retryMap.get(requestId) || 0;

      if (retryCount < retryConfig.maxRetries && retryConfig.retryCondition?.(error)) {
        retryMap.set(requestId, retryCount + 1);

        const delay = retryConfig.retryDelay * Math.pow(2, retryCount);
        console.log(
          `Retrying request to ${requestId} (attempt ${retryCount + 1}/${retryConfig.maxRetries}) after ${delay}ms`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));

        if (error.config) {
          return axios(error.config as AxiosRequestConfig);
        }
      }

      retryMap.delete(requestId);
      return Promise.reject(error);
    },
  };
}

export default createRetryInterceptor;
