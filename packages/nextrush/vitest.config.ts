import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@nextrush/body-parser': path.resolve(__dirname, '../middleware/body-parser/src'),
      '@nextrush/compression': path.resolve(__dirname, '../middleware/compression/src'),
      '@nextrush/cors': path.resolve(__dirname, '../middleware/cors/src'),
      '@nextrush/helmet': path.resolve(__dirname, '../middleware/helmet/src'),
      '@nextrush/errors': path.resolve(__dirname, '../errors/src'),
      '@nextrush/core': path.resolve(__dirname, '../core/src'),
      '@nextrush/router': path.resolve(__dirname, '../router/src'),
      '@nextrush/types': path.resolve(__dirname, '../types/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
    reporters: ['default', 'verbose'],
  },
});
