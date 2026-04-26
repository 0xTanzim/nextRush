import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig } from 'tsup';

/**
 * Post-process the output to add node: prefix for Deno compatibility.
 *
 * tsup/esbuild strips the node: prefix from built-in imports.
 * Deno requires the node: prefix for Node.js compatibility layer.
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
  console.log('[tsup] Added node: prefix for Deno compatibility');
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  outDir: 'dist',
  treeshake: true,
  minify: false,
  splitting: false,
  external: [
    '@nextrush/core',
    '@nextrush/decorators',
    '@nextrush/di',
    '@nextrush/errors',
    '@nextrush/router',
    '@nextrush/types',
    'reflect-metadata',
  ],
  async onSuccess() {
    await addNodePrefix();
  },
});
