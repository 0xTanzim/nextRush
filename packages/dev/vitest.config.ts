import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'threads',
    minWorkers: 1,
    maxWorkers: 2,
    // Multiple test files mutate the shared examples/dev-cli-fixture (build-e2e runs
    // the real CLI while swc-builder writes nested sources into the same fixture).
    // Running files sequentially removes the cross-worker race (seen on macOS CI).
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/__tests__/**'],
    },
  },
});
