import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../../');

/** Read version from a workspace package.json. */
function readVer(...segments: string[]): string {
  try {
    return JSON.parse(readFileSync(join(ROOT, ...segments, 'package.json'), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}

// Core packages (fixed changeset group: nextrush, @nextrush/types, @nextrush/dev).
// Read nextrush meta version rather than create-nextrush's own version,
// since create-nextrush is independently versioned.
const CORE_VER = readVer('packages', 'nextrush');
const MW_VER = readVer('packages', 'middleware', 'cors');

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node22',
  sourcemap: true,
  splitting: false,
  define: {
    __VERSION__: JSON.stringify(CORE_VER),
    __CORE_RANGE__: JSON.stringify('^' + CORE_VER),
    __MW_RANGE__: JSON.stringify('^' + MW_VER),
  },
});
