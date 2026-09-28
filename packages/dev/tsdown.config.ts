import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'tsdown';
import { keepClassNames } from '../../tools/tsdown/keep-class-names.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

export default defineConfig({
  // Restore class names in the emitted chunk: `err.name` is public API, and rolldown's
  // `var X = class X` shape is renamed by downstream esbuild transforms.
  // See tools/tsdown/keep-class-names.mjs.
  plugins: [keepClassNames()],
  entry: [
    'src/index.ts',
    'src/cli.ts',
    'src/commands/index.ts',
    'src/commands/dev.ts',
    'src/commands/build.ts',
    'src/commands/codemod.ts',
    'src/codemods/index.ts',
    'src/codemods/consolidate-imports.ts',
    'src/runtime/index.ts',
    'src/runtime/detect.ts',
    'src/runtime/spawn.ts',
    'src/runtime/fs.ts',
    'src/runtime/node-modules.ts',
    'src/utils/config.ts',
  ],
  format: ['esm'],
  // Keep the published entry shape (./dist/index.js + ./dist/index.d.ts) exactly as
  // package.json declares it — tsdown otherwise emits .mjs/.d.mts.
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  splitting: false,
  treeshake: false,
  // Keep node: prefix imports external for Deno compatibility
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  // Bare Node built-ins are aliased to their `node:` form; combined with removing all
  // STATIC `node:*` imports from source (crypto→pure-JS hash, fs→variable-specifier), the
  // bundle contains no prefix-stripped builtin, so Deno can load it (RFC-019, F-01).
  esbuildOptions(options) {
    options.alias = {
      'fs': 'node:fs',
      'fs/promises': 'node:fs/promises',
      'path': 'node:path',
      'child_process': 'node:child_process',
      'module': 'node:module',
      'url': 'node:url',
      'process': 'node:process',
    };
  },
  // Copy the SWC loader after build
  onSuccess: async () => {
    try {
      mkdirSync('dist/loaders', { recursive: true });
      copyFileSync('src/loaders/swc-loader.mjs', 'dist/loaders/swc-loader.mjs');
      console.log('Copied swc-loader.mjs to dist/loaders/');
    } catch (e) {
      console.error('Failed to copy swc-loader.mjs:', e);
    }
  },
  deps: {
    neverBundle: [
    'node:fs',
    'node:fs/promises',
    'node:path',
    'node:child_process',
    'node:module',
    'node:url',
    'node:process',
    'glob',
  ],
  },
});
