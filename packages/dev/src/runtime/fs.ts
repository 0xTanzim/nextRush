/**
 * @nextrush/dev - Cross-Runtime File System Operations
 *
 * Provides a unified API for file system operations across
 * Node.js, Bun, and Deno runtimes.
 *
 * Strategy:
 * - Deno: Use Deno global APIs (no Node.js imports)
 * - Node.js/Bun: Dynamically import node:fs modules
 *
 * The key challenge is avoiding static imports of Node.js modules
 * that would fail in Deno. We use dynamic import() and runtime
 * checks to achieve this.
 *
 * @packageDocumentation
 */

import { detectRuntime, type Runtime } from './detect.js';
import { NODE_FS, NODE_FS_PROMISES, NODE_MODULE } from './node-modules.js';

// Cache the runtime detection (called once at module load)
const runtime: Runtime = detectRuntime();

// Cache the fs module for sync operations (loaded lazily)
let cachedFs: typeof import('node:fs') | null = null;

/**
 * Get the fs module synchronously for Node.js/Bun
 * Uses createRequire from node:module to load fs synchronously in ESM context
 */
function getFsSync(): typeof import('node:fs') {
  if (cachedFs) return cachedFs;

  // In Bun, require is available globally
  if (runtime === 'bun' && typeof require === 'function') {
    cachedFs = require('node:fs');
    return cachedFs!;
  }

  // In Node.js ESM, we need to use createRequire
  // We use dynamic import to get the module, but cache it synchronously
  // This is initialized lazily on first sync call
  try {
    // Try the Function constructor first (works in CJS and some ESM contexts)
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const dynamicRequire = new Function('moduleName', 'return require(moduleName)');
    cachedFs = dynamicRequire('node:fs');
    return cachedFs!;
  } catch {
    // If require isn't available, we need createRequire
    // This requires async initialization, so throw an informative error
    throw new Error(
      'Sync fs operations require initialization. Call initFsSync() first or use async methods.'
    );
  }
}

/**
 * Initialize fs module for sync operations
 * Call this early in your application to enable sync fs methods
 */
export async function initFsSync(): Promise<void> {
  if (cachedFs) return;
  if (runtime === 'deno') return; // Deno doesn't need this

  const nodeModule = await import(/* @vite-ignore */ NODE_MODULE);
  const require = nodeModule.createRequire(import.meta.url);
  cachedFs = require(NODE_FS);
}

/**
 * Check if a file or directory exists
 */
export async function exists(path: string): Promise<boolean> {
  if (runtime === 'deno') {
    // @ts-expect-error Deno global exists in Deno runtime
    return globalThis.Deno.stat(path).then(() => true).catch(() => false);
  }

  // Node.js and Bun use Node.js fs API
  // Use variable to prevent esbuild from stripping node: prefix
  const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
  return fs.access(path).then(() => true).catch(() => false);
}

/**
 * Check if path exists (sync version)
 *
 * For sync operations in Node.js/Bun, we need synchronous module loading.
 * This function uses a cached fs module that should be initialized via initFsSync()
 * or will attempt to use the Function constructor fallback.
 */
export function existsSync(path: string): boolean {
  if (runtime === 'deno') {
    try {
      // @ts-expect-error Deno global exists in Deno runtime
      globalThis.Deno.statSync(path);
      return true;
    } catch {
      return false;
    }
  }

  try {
    const fs = getFsSync();
    fs.accessSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a file as text
 */
export async function readFile(path: string): Promise<string> {
  if (runtime === 'deno') {
    // @ts-expect-error Deno global exists in Deno runtime
    return globalThis.Deno.readTextFile(path);
  }

  // Node.js and Bun use Node.js fs API
  const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
  return fs.readFile(path, 'utf-8');
}

/**
 * Read a file as text (sync version)
 */
export function readFileSync(path: string): string {
  if (runtime === 'deno') {
    // @ts-expect-error Deno global exists in Deno runtime
    return globalThis.Deno.readTextFileSync(path);
  }

  const fs = getFsSync();
  return fs.readFileSync(path, 'utf-8');
}

/**
 * Get current working directory
 */
export function getCwd(): string {
  if (runtime === 'deno') {
    // @ts-expect-error Deno global exists in Deno runtime
    return globalThis.Deno.cwd();
  }

  return process.cwd();
}

/**
 * Resolve a path (cross-runtime compatible)
 */
export function resolvePath(...paths: string[]): string {
  const base = getCwd();
  let result = base;

  for (const p of paths) {
    if (p.startsWith('/')) {
      result = p;
    } else if (p === '..') {
      result = result.substring(0, result.lastIndexOf('/'));
    } else if (p !== '.') {
      result = result.replace(/\/+$/, '') + '/' + p;
    }
  }

  return result;
}

/**
 * Join path segments
 */
export function joinPath(...paths: string[]): string {
  return paths.join('/').replace(/\/+/g, '/');
}
