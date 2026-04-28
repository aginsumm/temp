import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import { GlobalErrorBoundary } from './components/common/GlobalErrorBoundary';
import App from './app';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalErrorBoundary name="App">
      <AccessibilityProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </AccessibilityProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
