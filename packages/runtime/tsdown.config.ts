import { defineConfig } from 'tsdown';
import { keepClassNames } from '../../tools/tsdown/keep-class-names.mjs';

export default defineConfig({
  // Restore class names in the emitted chunk: `err.name` is public API, and rolldown's
  // `var X = class X` shape is renamed by downstream esbuild transforms.
  // See tools/tsdown/keep-class-names.mjs.
  plugins: [keepClassNames()],
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
  // Keep the published entry shape (./dist/index.js + ./dist/index.d.ts) exactly as
  // package.json declares it — tsdown otherwise emits .mjs/.d.mts.
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  deps: {
    neverBundle: true,
  },
});
