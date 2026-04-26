import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  tsconfig: 'tsconfig.build.json',
  external: [
    // Node.js built-ins - keep node: prefix for Deno compatibility
    'node:string_decoder',
    'node:stream',
    'node:buffer',
  ],
});
