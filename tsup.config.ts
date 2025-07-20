import { defineConfig } from 'tsup';

export default defineConfig({
  // 🎯 ENTRY POINT: Only process files from src/ directory
  // tsup will follow imports starting from src/index.ts and bundle only what's needed
  entry: ['src/index.ts'],

  // Output formats
  format: ['cjs', 'esm'],

  // Generate TypeScript declarations
  dts: true,

  // Clean output directory before building
  clean: true,

  // Source maps for debugging
  sourcemap: true,

  // Minify output for production
  minify: false, // Can be enabled for production builds

  // Only bundle files that are imported from src/
  // tsup will automatically follow imports starting from src/index.ts
  noExternal: [], // Don't externalize any dependencies found in src/

  // 🚫 EXCLUDE: Directories outside src/ are automatically ignored
  // tsup only follows imports from the entry point, so files in benchmark/,
  // professional-benchmarks/, examples/, docs/, etc. are never processed
  external: [
    // Node.js built-ins (don't bundle these)
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

  // Target environment
  target: 'node18',

  // Code splitting for better tree-shaking
  splitting: false, // Disable for now to avoid complexity

  // Bundle configuration - ONLY process src directory
  bundle: true,

  // Output directory
  outDir: 'dist',

  // Skip node_modules bundling
  skipNodeModulesBundle: true,

  // TypeScript configuration - points to src files only
  tsconfig: 'tsconfig.build.json',

  // Ignore patterns - exclude everything outside src/
  ignoreWatch: [
    'benchmark/**',
    'professional-benchmarks/**',
    'examples/**',
    'docs/**',
    'scripts/**',
    'public/**',
    'dist/**',
    'node_modules/**',
    '.git/**',
    '.github/**',
    '.vscode/**',
    '*.md',
    '*.json',
    '*.js',
    '*.config.*',
    'tsconfig.*',
  ],

  // Additional options for better performance
  keepNames: true, // Preserve function names for debugging
  treeshake: true, // Remove unused code

  // Watch mode configuration (for development)
  watch: process.env.NODE_ENV === 'development',

  // Environment-specific configuration
  env: {
    NODE_ENV: process.env.NODE_ENV || 'production',
  },

  // Output file naming
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.js' : '.mjs',
    };
  },

  // Banner for built files
  banner: {
    js: '#!/usr/bin/env node',
  },

  // Platform target
  platform: 'node',

  // Shims for Node.js compatibility
  shims: false, // We're targeting Node.js, no need for shims

  // Define for build-time constants
  define: {
    'process.env.PACKAGE_VERSION': JSON.stringify(
      process.env.npm_package_version || '1.0.0'
    ),
  },
});
