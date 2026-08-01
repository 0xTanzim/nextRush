import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    passWithNoTests: false,
    pool: 'threads',
    minWorkers: 1,
    maxWorkers: 2,
    include: ['src/**/*.test.ts'],
  },
});
