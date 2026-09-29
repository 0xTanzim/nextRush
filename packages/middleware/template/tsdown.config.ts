import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'tsdown';
import { keepClassNames } from '../../../tools/tsdown/keep-class-names.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

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
  target: 'node20',
  outDir: 'dist',
  // Keep the published entry shape (./dist/index.js + ./dist/index.d.ts) exactly as
  // package.json declares it — tsdown otherwise emits .mjs/.d.mts.
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  deps: {
    neverBundle: [
    '@nextrush/types',
    '@nextrush/core',
    // Node.js built-ins - keep node: prefix for Deno compatibility
    'node:fs',
    'node:fs/promises',
    'node:path',
  ],
  },
});
