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
import { NODE_FS, NODE_FS_PROMISES, NODE_MODULE, NODE_PATH } from './node-modules.js';

// Cache the runtime detection (called once at module load)
const runtime: Runtime = detectRuntime();

// Cache the fs module for sync operations (loaded lazily)
let cachedFs: typeof import('node:fs') | null = null;

// Cache resolved path module for sync operations
let cachedPath: typeof import('node:path') | null = null;

// Initialize node:path eagerly for Node.js/Bun to avoid ordering hazards
function initPathSync(): void {
  if (cachedPath || runtime === 'deno') return;

  // In Bun, require is available globally
  if (runtime === 'bun' && typeof require === 'function') {
    try {
      cachedPath = require(NODE_PATH);
    } catch {
      // Fallback to async
    }
  }
}

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

  // In Node.js ESM, require is not available directly.
  // Use initFsSync() to initialize, or use async methods.
  throw new Error(
    'Sync fs operations require initialization. Call initFsSync() first or use async methods.'
  );
}

/**
 * Initialize fs and path modules for sync operations
 * Call this early in your application to enable sync fs methods
 */
export async function initFsSync(): Promise<void> {
  if (runtime === 'deno') return; // Deno doesn't need this

  if (!cachedFs) {
    const nodeModule = await import(/* @vite-ignore */ NODE_MODULE);
    const require = nodeModule.createRequire(import.meta.url);
    cachedFs = require(NODE_FS);
  }

  if (!cachedPath) {
    const nodeModule = await import(/* @vite-ignore */ NODE_MODULE);
    const require = nodeModule.createRequire(import.meta.url);
    cachedPath = require(NODE_PATH);
  }
}

// Initialize path module at module load time for Bun (it has require)
initPathSync();

/**
 * Check if a file or directory exists
 */
export async function exists(path: string): Promise<boolean> {
  if (runtime === 'deno') {
    // @ts-expect-error Deno global exists in Deno runtime
    return globalThis.Deno.stat(path)
      .then(() => true)
      .catch(() => false);
  }

  // Node.js and Bun use Node.js fs API
  // Use variable to prevent esbuild from stripping node: prefix
  const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
  return fs
    .access(path)
    .then(() => true)
    .catch(() => false);
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
 * Write a file with content, creating parent directories as needed
 */
export async function writeFile(path: string, content: string): Promise<void> {
  if (runtime === 'deno') {
    // @ts-expect-error Deno global exists in Deno runtime
    await globalThis.Deno.writeTextFile(path, content);
    return;
  }

  const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
  await fs.writeFile(path, content, 'utf-8');
}

/**
 * Create a directory recursively
 */
export async function mkdir(path: string): Promise<void> {
  if (runtime === 'deno') {
    // @ts-expect-error Deno global exists in Deno runtime
    await globalThis.Deno.mkdir(path, { recursive: true });
    return;
  }

  const fs = await import(/* @vite-ignore */ NODE_FS_PROMISES);
  await fs.mkdir(path, { recursive: true });
}

/**
 * Resolve a path (cross-runtime compatible)
 * Uses node:path.resolve semantics on all platforms.
 * For Deno, falls back to manual path handling.
 */
export function resolvePath(...paths: string[]): string {
  if (runtime === 'deno') {
    // Deno: manual resolve
    const base = getCwd();
    const segments = [base, ...paths];
    return segments.join('/').replace(/\/+/g, '/');
  }

  // Node.js/Bun: use node:path.resolve
  if (cachedPath) {
    return cachedPath.resolve(...paths);
  }

  // Fallback (should not happen in production, but safe)
  // This is only reached before initFsSync in Node.js ESM
  const base = getCwd();
  const segments = [base, ...paths];
  return segments.join('/').replace(/\/+/g, '/');
}

/**
 * Join path segments (cross-runtime compatible)
 * Uses node:path.join semantics on all platforms.
 * For Deno, falls back to manual path handling.
 */
export function joinPath(...paths: string[]): string {
  if (runtime === 'deno') {
    // Deno: manual join
    return paths.join('/').replace(/\/+/g, '/');
  }

  // Node.js/Bun: use node:path.join
  if (cachedPath) {
    return cachedPath.join(...paths);
  }

  // Fallback (should not happen in production, but safe)
  // This is only reached before initFsSync in Node.js ESM
  return paths.join('/').replace(/\/+/g, '/');
}
