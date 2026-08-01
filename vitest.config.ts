import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Cap worker threads so a full monorepo test run doesn't fan out to os.cpus() per
    // package and exhaust RAM/CPU when Turborepo runs many package test tasks in parallel.
    pool: 'threads',
    minWorkers: 1,
    maxWorkers: 2,
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/_archive/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '_archive/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
    reporters: ['default', 'verbose'],
    passWithNoTests: true,
  },
});
