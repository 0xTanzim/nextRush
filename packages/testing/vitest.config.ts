import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vitest 5 transforms via oxc, which does not inherit tsconfig's
  // experimentalDecorators/emitDecoratorMetadata; the tests use legacy
  // parameter decorators and design:type metadata, so enable them explicitly.
  oxc: {
    decorator: {
      legacy: true,
      emitDecoratorMetadata: true,
    },
  },
  test: {
    globals: false,
    environment: 'node',
    pool: 'threads',
    minWorkers: 1,
    maxWorkers: 2,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
    testTimeout: 10000,
  },
});
