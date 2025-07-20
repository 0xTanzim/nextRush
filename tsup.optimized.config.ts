import { defineConfig } from 'tsup';

export default defineConfig([
  // 🔥 CommonJS build - require() support
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    outDir: 'dist',
    outExtension: () => ({ js: '.js' }),
    dts: true,
    sourcemap: false,
    clean: true,
    splitting: false,
    treeshake: false,
    minify: false,
    target: 'node18',
    platform: 'node',
    bundle: true,

    // 🚫 External Node.js built-ins for CommonJS
    external: [
      'node:*',
      'fs',
      'fs/promises',
      'path',
      'http',
      'https',
      'crypto',
      'os',
      'url',
      'stream',
      'events',
      'util',
      'zlib',
      'string_decoder',
      'buffer',
      'child_process',
      'cluster',
      'net',
      'tls',
      'dgram',
      'dns',
      'module',
      'querystring',
      'worker_threads',
    ],

    esbuildOptions(options) {
      options.keepNames = true;
      options.platform = 'node';
      options.format = 'cjs';
      options.packages = 'external';
      options.mainFields = ['main', 'module'];
      options.conditions = ['node', 'require', 'default'];
    },
  },

  // 🔥 ES Modules build - NEUTRAL platform to prevent require() polyfill
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'dist',
    outExtension: () => ({ js: '.mjs' }),
    dts: false,
    sourcemap: false,
    clean: false,
    splitting: false,
    treeshake: false,
    minify: false,
    target: 'esnext',
    platform: 'neutral',
    bundle: true,

    // 🚫 External Node.js built-ins to prevent require() polyfills
    external: [
      'node:*',
      'fs',
      'fs/promises',
      'path',
      'http',
      'https',
      'crypto',
      'os',
      'url',
      'stream',
      'events',
      'util',
      'zlib',
      'string_decoder',
      'buffer',
      'child_process',
      'cluster',
      'net',
      'tls',
      'dgram',
      'dns',
      'module',
      'querystring',
      'worker_threads',
    ],

    esbuildOptions(options) {
      options.keepNames = true;
      options.platform = 'node';
      options.format = 'esm';

      // 🎯 Force external packages to prevent bundling Node.js modules
      options.packages = 'external';
      options.mainFields = ['module', 'main'];
      options.conditions = ['node', 'import', 'module', 'default'];

      // � CRITICAL: Force pure ES module output
      // This prevents esbuild from injecting CommonJS compatibility code
      options.target = ['esnext'];
      options.supported = {
        'dynamic-import': true,
        'import-meta': true,
      };

      // 💡 Remove any CommonJS compatibility injections
      options.inject = [];
      options.banner = undefined;
      options.footer = undefined;
    },
  },
]);
