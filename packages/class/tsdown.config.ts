import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig } from 'tsdown';
import { keepClassNames } from '../../tools/tsdown/keep-class-names.mjs';

/**
 * Post-process the output to add node: prefix for Deno compatibility.
 *
 * Re-adding the node: prefix keeps Deno loading this file through its Node.js
 * compatibility layer, whichever bundler/transformer touched the specifier first.
 */
async function addNodePrefix() {
  const distPath = join(import.meta.dirname, 'dist', 'index.js');
  let content = await readFile(distPath, 'utf-8');

  // List of Node.js built-in modules that need the prefix
  const builtins = [
    'fs/promises',
    'fs',
    'path',
    'url',
    'crypto',
    'events',
    'stream',
    'util',
    'buffer',
    'http',
    'https',
    'net',
    'os',
    'string_decoder',
  ];

  for (const mod of builtins) {
    // Match: from 'fs/promises' or from "fs/promises"
    const regex = new RegExp(`from ['"]${mod.replace('/', '\\/')}['"]`, 'g');
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
  target: 'node20',
  outDir: 'dist',
  // Keep the published entry shape (./dist/index.js + ./dist/index.d.ts) exactly as
  // package.json declares it — tsdown otherwise emits .mjs/.d.mts.
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  treeshake: true,
  minify: false,
  splitting: false,
  async onSuccess() {
    await addNodePrefix();
  },
  deps: {
    neverBundle: [
    '@nextrush/core',
    '@nextrush/di',
    '@nextrush/errors',
    '@nextrush/router',
    '@nextrush/types',
    'reflect-metadata',
  ],
  },
});
