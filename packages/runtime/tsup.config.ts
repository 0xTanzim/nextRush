import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  // Runtime-agnostic: emit a platform-neutral bundle so no Node-only resolution
  // assumptions leak into the output (audit R-9).
  platform: 'neutral',
  target: 'node20',
  outDir: 'dist',
  external: ['@nextrush/types', '@nextrush/errors'],
  skipNodeModulesBundle: true,
});
