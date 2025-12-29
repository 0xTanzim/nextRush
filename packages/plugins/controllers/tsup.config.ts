import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  outDir: 'dist',
  treeshake: true,
  minify: false,
  splitting: false,
  external: [
    '@nextrush/core',
    '@nextrush/decorators',
    '@nextrush/di',
    '@nextrush/errors',
    '@nextrush/router',
    '@nextrush/types',
    'reflect-metadata',
  ],
});
