import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    pool: 'threads',
    minWorkers: 1,
    maxWorkers: 2,
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
