import { defineConfig } from 'tsup';
import { resolve } from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: process.env.NODE_ENV === 'production',
  treeshake: true,
  external: ['node:*'],
  noExternal: [],
  outDir: 'dist',
  target: 'node18',
  platform: 'node',
  esbuildOptions(options) {
    options.banner = {
      js: '// NextRush v2 - A modern Node.js web framework\n',
    };
  },
  alias: {
    '@': resolve(__dirname, './src'),
    '@/core': resolve(__dirname, './src/core'),
    '@/plugins': resolve(__dirname, './src/plugins'),
    '@/types': resolve(__dirname, './src/types'),
    '@/utils': resolve(__dirname, './src/utils'),
    '@/errors': resolve(__dirname, './src/errors'),
    '@/examples': resolve(__dirname, './src/examples'),
    '@/tests': resolve(__dirname, './src/tests'),
    '@/benchmarks': resolve(__dirname, './src/benchmarks')
  }
}); 