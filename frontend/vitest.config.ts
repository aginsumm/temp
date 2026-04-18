import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['e2e/**/*.spec.ts', 'src/tests/edge-cases.test.ts'],
    pool: 'vmThreads',
    poolOptions: {
      vmThreads: {
        singleThread: true,
      },
    },
    maxConcurrency: 1,
    testTimeout: 30000,
    hookTimeout: 10000,
    coverage: {
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['node_modules/', 'src/tests/', '**/*.d.ts', '**/*.config.*', '**/mocks.ts', 'e2e/'],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
