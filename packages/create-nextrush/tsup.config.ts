import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node22',
  sourcemap: true,
  splitting: false,
  define: {
    // Only used for CLI version display (create-nextrush vX.Y.Z)
    __VERSION__: JSON.stringify(pkg.version),
  },
});
