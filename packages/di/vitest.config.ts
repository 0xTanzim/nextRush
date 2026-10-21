import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vitest 5 transforms via oxc, which does not inherit tsconfig's
  // experimentalDecorators/emitDecoratorMetadata; the DI tests use legacy
  // parameter decorators and design:type metadata, so enable them explicitly.
  oxc: {
    decorator: {
      legacy: true,
      emitDecoratorMetadata: true,
    },
  },
  test: {
    // Global tsyringe `container` is a singleton; parallel test files race on registrations + resolution tracking.
    fileParallelism: false,
    globals: true,
    environment: 'node',
    pool: 'threads',
    minWorkers: 1,
    maxWorkers: 2,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.test.ts', '**/index.ts'],
    },
  },
});
