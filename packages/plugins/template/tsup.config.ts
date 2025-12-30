import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: 'node20',
  outDir: 'dist',
  external: [
    '@nextrush/types',
    '@nextrush/core',
    // Node.js built-ins - keep node: prefix for Deno compatibility
    'node:fs',
    'node:fs/promises',
    'node:path',
  ],
});
