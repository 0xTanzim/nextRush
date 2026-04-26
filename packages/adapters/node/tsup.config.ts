import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig } from 'tsup';

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
  console.log('[tsup] Added node: prefix for Deno compatibility');
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: 'node20',
  outDir: 'dist',
  external: ['@nextrush/types', '@nextrush/core'],
  async onSuccess() {
    await addNodePrefix();
  },
});
