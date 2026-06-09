import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'tsup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cli.ts',
    'src/commands/index.ts',
    'src/commands/dev.ts',
    'src/commands/build.ts',
    'src/runtime/index.ts',
    'src/runtime/detect.ts',
    'src/runtime/spawn.ts',
    'src/runtime/fs.ts',
    'src/runtime/node-modules.ts',
    'src/utils/config.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  splitting: false,
  treeshake: false,
  // Keep node: prefix imports external for Deno compatibility
  external: [
    'node:fs',
    'node:fs/promises',
    'node:path',
    'node:child_process',
    'node:module',
    'node:url',
    'node:process',
  ],
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  // Use esbuild options to preserve node: prefix
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
});
