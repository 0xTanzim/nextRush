import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig } from 'tsdown';
import { keepClassNames } from '../../../tools/tsdown/keep-class-names.mjs';

/**
 * Post-process output to add node: prefix for Deno compatibility.
 */
async function addNodePrefix() {
  const distPath = join(import.meta.dirname, 'dist', 'index.js');
  let content = await readFile(distPath, 'utf-8');

  const builtins = ['http', 'https', 'net', 'stream', 'buffer', 'events', 'url', 'path', 'fs', 'crypto'];
  for (const mod of builtins) {
    const regex = new RegExp(`from ['"]${mod}['"]`, 'g');
    content = content.replace(regex, `from 'node:${mod}'`);
  }

  await writeFile(distPath, content);
  console.log('[tsdown] Added node: prefix for Deno compatibility');
}

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
  async onSuccess() {
    await addNodePrefix();
  },
  deps: {
    neverBundle: ['@nextrush/types', '@nextrush/core', '@nextrush/errors', '@nextrush/runtime', '@nextrush/stream'],
  },
});
