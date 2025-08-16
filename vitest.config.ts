import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Only measure coverage for source files
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'dist/',
        // Exclude top-level benchmarks folder from coverage
        'benchmarks/**',
        // Exclude all tests from coverage reports
        'src/tests/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/__tests__/**',
        'v1/',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/coverage/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        'src/examples/**',
      ],
    },
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'v1'],
    fileParallelism: false,
    // Run orchestration tests sequentially to avoid port conflicts
    sequence: {
      setupFiles: 'parallel',
      hooks: 'parallel',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/core': resolve(__dirname, './src/core'),
      '@/plugins': resolve(__dirname, './src/plugins'),
      '@/types': resolve(__dirname, './src/types'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/errors': resolve(__dirname, './src/errors'),
      '@/examples': resolve(__dirname, './src/examples'),
      '@/tests': resolve(__dirname, './src/tests'),
      '@/benchmarks': resolve(__dirname, './src/benchmarks'),
    },
  },
});
