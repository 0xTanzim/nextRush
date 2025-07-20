import { defineConfig } from 'tsup';

export default defineConfig({
  // 🎯 Entry point - only src/index.ts
  entry: ['src/index.ts'],

  // Output formats
  format: ['cjs', 'esm'],

  // Generate TypeScript declarations
  dts: true,

  // Clean output directory
  clean: true,

  // 🚀 OPTIMIZATION SETTINGS
  minify: true, // Enable minification for smaller builds
  sourcemap: false, // Disable source maps to reduce size
  treeshake: true, // Aggressive tree-shaking
  keepNames: false, // Remove function names to save space

  // 📦 Bundle only src/ files
  bundle: true,
  splitting: false,

  // 🚫 External dependencies (don't bundle Node.js built-ins)
  external: [
    'node:*',
    'fs',
    'path',
    'http',
    'https',
    'url',
    'stream',
    'crypto',
    'buffer',
    'events',
    'util',
    'querystring',
    'worker_threads',
    'child_process',
    'cluster',
    'os',
    'zlib',
  ],

  // 🎯 Target and platform
  target: 'node18',
  platform: 'node',

  // 📁 Output configuration
  outDir: 'dist',
  tsconfig: 'tsconfig.build.json',

  // 🔧 Build optimizations
  esbuildOptions(options) {
    // Fix the named/default export warning
    options.mainFields = ['module', 'main'];
    options.conditions = ['node'];

    // Additional optimizations
    options.drop = ['console', 'debugger']; // Remove console.log and debugger statements
    options.legalComments = 'none'; // Remove legal comments to save space
  },

  // 🌍 Environment
  define: {
    'process.env.NODE_ENV': '"production"',
  },

  // 📝 Output extensions
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.js' : '.mjs',
    };
  },
});
