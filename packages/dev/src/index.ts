/**
 * @nextrush/dev - Development Tools for NextRush
 *
 * Development server and build tools with multi-runtime support.
 * Works across Node.js, Bun, and Deno.
 *
 * @packageDocumentation
 *
 * @example CLI Usage
 * ```bash
 * # Start development server
 * npx nextrush dev
 * npx nextrush dev ./src/app.ts --port 4000
 *
 * # Build for production
 * npx nextrush build
 * npx nextrush build --minify --outDir dist
 * ```
 *
 * @example Programmatic Usage
 * ```typescript
 * import { dev, build } from '@nextrush/dev';
 *
 * // Start dev server
 * await dev('./src/index.ts', { port: 3000 });
 *
 * // Build for production
 * await build('./src/index.ts', { outDir: 'dist', minify: true });
 * ```
 */

// CLI entry
export { cli, legacyDevCli } from './cli.js';

// Commands
export {
    build,
    buildCli,
    buildHelp, dev,
    devCli,
    devHelp, type BuildOptions, type DevOptions
} from './commands/index.js';

// Runtime detection and utilities
export {
    detectRuntime, getRuntimeExecutable, getRuntimeInfo, isBun,
    isDeno, isNode, type Runtime,
    type RuntimeInfo
} from './runtime/index.js';

// Utility re-exports for programmatic use
export {
    findEntry, getDefaultWatchPaths, loadConfig, type NextRushConfig
} from './utils/config.js';
