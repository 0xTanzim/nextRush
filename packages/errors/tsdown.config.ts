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
  // Transport-agnostic error model — keep the bundle platform-neutral.
  platform: 'neutral',
  target: 'node20',
  outDir: 'dist',
  // Keep the published entry shape (./dist/index.js + ./dist/index.d.ts) exactly as
  // package.json declares it — tsdown otherwise emits .mjs/.d.mts.
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  deps: {
    neverBundle: true,
  },
  // Preserve class names in the emitted bundle. rolldown otherwise writes
  // `var X = class X`, and any downstream esbuild transform renames the INNER
  // class-expression binding (`class X2`) — which silently changes the PUBLIC
  // `name` property our errors derive from `this.constructor.name`.
  outputOptions: { keepNames: true },
});
