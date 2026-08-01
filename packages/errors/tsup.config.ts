import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  // Transport-agnostic error model — keep the bundle platform-neutral.
  platform: 'neutral',
  target: 'node20',
  outDir: 'dist',
  external: ['@nextrush/types'],
  skipNodeModulesBundle: true,
});
