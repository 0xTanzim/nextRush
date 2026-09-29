import { defineConfig } from 'tsdown';
import { keepClassNames } from '../../../tools/tsdown/keep-class-names.mjs';

export default defineConfig({
  // Restore class names in the emitted chunk: `err.name` is public API, and rolldown's
  // `var X = class X` shape is renamed by downstream esbuild transforms.
  // See tools/tsdown/keep-class-names.mjs.
  plugins: [keepClassNames()],
  entry: ['src/index.ts'],
  format: ['esm'],
  // Keep the published entry shape (./dist/index.js + ./dist/index.d.ts) exactly as
  // package.json declares it — tsdown otherwise emits .mjs/.d.mts.
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  dts: true,
  clean: true,
  sourcemap: true,
  // Runtime-agnostic bundle (BP-1): no Node built-ins are imported, so build for
  // a neutral platform. This surfaces any accidental node: dependency at build
  // time and keeps the package loadable on edge runtimes.
  platform: 'neutral',
  target: 'es2022',
});
