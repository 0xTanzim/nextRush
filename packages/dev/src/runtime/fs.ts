/* eslint-disable nextrush/no-runtime-identity-capability -- dev CLI runtime-specific filesystem APIs (Deno/Bun/Node differ); platform optimization, not a request-path capability decision */
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
import { getDenoGlobal } from './runtime-globals.js';
import { NODE_PATH, getNodeFsPromises, getNodeModule, getNodePath } from './node-modules.js';

// Cache the runtime detection (called once at module load)
const runtime: Runtime = detectRuntime();

// Cache the fs module for sync operations (loaded lazily)
let cachedFs: typeof import('node:fs') | null = null;

// Cache resolved path module for sync operations
let cachedPath: typeof import('node:path') | null = null;

// Initialize node:path eagerly for Node.js/Bun to avoid ordering hazards
function initPathSync(): void {
  if (cachedPath || runtime === 'deno') return;

  // In Bun, require is available globally, and it is the ONLY synchronous module-loading
  // primitive available in an ESM context — there is no synchronous `import()`. Bare
  // `require()` is intentional here, not an oversight; scoped inline (not file-wide)
  // because this is genuinely the one call site in this function that needs it.
  if (runtime === 'bun' && typeof require === 'function') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- see comment above
      cachedPath = require(NODE_PATH) as typeof import('node:path');
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

  // In Bun, require is available globally — same rationale as initPathSync above.
  if (runtime === 'bun' && typeof require === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see initPathSync's comment
    cachedFs = require('node:fs') as typeof import('node:fs');
    return cachedFs;
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
  // node:path works on every runtime (Deno supports it). Cache it everywhere so path
  // semantics (`..` collapse, absolute-segment reset) are identical across runtimes and
  // resolvePath/joinPath never diverge (RFC-019 F-13) — Deno's old manual string-join
  // doubled an absolute segment, breaking `nextrush build` there.
  cachedPath ??= await getNodePath();

  if (runtime === 'deno') return; // Deno uses Deno.* for fs; only node:path is needed above.

  cachedFs ??= await (async (): Promise<typeof import('node:fs')> => {
    const nodeModule = await getNodeModule();
    const require = nodeModule.createRequire(import.meta.url);
    return require('node:fs') as typeof import('node:fs');
  })();
}

// Initialize path module at module load time for Bun (it has require)
initPathSync();

/**
 * Check if a file or directory exists
 */
export async function exists(path: string): Promise<boolean> {
  if (runtime === 'deno') {
    return getDenoGlobal()
      .stat(path)
      .then(() => true)
      .catch(() => false);
  }

  // Node.js and Bun use Node.js fs API
  // Use variable to prevent esbuild from stripping node: prefix
  const fs = await getNodeFsPromises();
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
      getDenoGlobal().statSync(path);
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
    return getDenoGlobal().readTextFile(path);
  }

  // Node.js and Bun use Node.js fs API
  const fs = await getNodeFsPromises();
  return fs.readFile(path, 'utf-8');
}

/**
 * Read a file as text (sync version)
 */
export function readFileSync(path: string): string {
  if (runtime === 'deno') {
    return getDenoGlobal().readTextFileSync(path);
  }

  const fs = getFsSync();
  return fs.readFileSync(path, 'utf-8');
}

/**
 * Get current working directory
 */
export function getCwd(): string {
  if (runtime === 'deno') {
    return getDenoGlobal().cwd();
  }

  return process.cwd();
}

/**
 * Write a file with content, creating parent directories as needed
 */
export async function writeFile(path: string, content: string): Promise<void> {
  if (runtime === 'deno') {
    await getDenoGlobal().writeTextFile(path, content);
    return;
  }

  const fs = await getNodeFsPromises();
  await fs.writeFile(path, content, 'utf-8');
}

/**
 * Create a directory recursively
 */
export async function mkdir(path: string): Promise<void> {
  if (runtime === 'deno') {
    await getDenoGlobal().mkdir(path, { recursive: true });
    return;
  }

  const fs = await getNodeFsPromises();
  await fs.mkdir(path, { recursive: true });
}

/**
 * Resolve a path (cross-runtime compatible)
 * Uses node:path.resolve semantics on all platforms.
 * For Deno, falls back to manual path handling.
 */
export function resolvePath(...paths: string[]): string {
  // Prefer node:path.resolve on ALL runtimes for identical semantics (F-13).
  if (cachedPath) {
    return cachedPath.resolve(...paths);
  }

  // Fallback only before initFsSync has run — best-effort manual join.
  // Normalize backslashes so Windows base paths don't produce mixed separators.
  const base = getCwd();
  const segments = [base, ...paths];
  return segments.map((segment) => segment.replace(/\\/g, '/')).join('/').replace(/\/+/g, '/');
}

/**
 * Join path segments (cross-runtime compatible)
 * Uses node:path.join semantics on all platforms.
 * For Deno, falls back to manual path handling.
 */
export function joinPath(...paths: string[]): string {
  // Prefer node:path.join on ALL runtimes for identical semantics (F-13).
  if (cachedPath) {
    return cachedPath.join(...paths);
  }

  // Fallback only before initFsSync has run.
  return paths.join('/').replace(/\/+/g, '/');
}
