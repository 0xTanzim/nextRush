import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  // Runtime-agnostic bundle (BP-1): no Node built-ins are imported, so build for
  // a neutral platform. This surfaces any accidental node: dependency at build
  // time and keeps the package loadable on edge runtimes.
  platform: 'neutral',
  target: 'es2022',
});
