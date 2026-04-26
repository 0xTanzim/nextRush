import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  minify: false,
  sourcemap: true,
  treeshake: true,
  target: 'node20',
  outDir: 'dist',
  skipNodeModulesBundle: true,
  external: ['@nextrush/core', '@nextrush/types'],
});
