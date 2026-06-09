import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'tsup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

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
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
});
