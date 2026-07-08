/**
 * @nextrush/dev - Node.js Module Constants
 *
 * This file defines Node.js module specifiers as runtime variables
 * to prevent bundlers (esbuild/tsup) from stripping the `node:` prefix.
 *
 * **Why this exists:**
 * - Deno REQUIRES the `node:` prefix for Node.js built-in modules
 * - esbuild/tsup transforms `import('node:fs')` to `import('fs')`
 * - Using variables like `import(NODE_FS)` prevents this transformation
 *
 * @packageDocumentation
 */

// Node.js built-in modules with node: prefix
// Using const variables prevents bundler from analyzing the string values
export const NODE_FS = 'node:fs';
export const NODE_FS_PROMISES = 'node:fs/promises';
export const NODE_PATH = 'node:path';
export const NODE_CHILD_PROCESS = 'node:child_process';
export const NODE_MODULE = 'node:module';
export const NODE_URL = 'node:url';
export const NODE_PROCESS = 'node:process';
export const NODE_UTIL = 'node:util';
export const NODE_OS = 'node:os';

/**
 * Resolve the SWC loader path from a file URL base.
 *
 * Pure function for testability — factors out URL resolution logic.
 * Handles both posix and Windows file:// URLs correctly.
 *
 * @param fileUrlBase The URL of THIS file (import.meta.url)
 * @returns Either a file:// URL to the loader or the npm package fallback
 */
export function resolveLoaderFromUrl(fileUrlBase: string): string {
  // Check if this is a dist location
  if (!fileUrlBase.includes('/dist/')) {
    // Dev mode: fallback to npm package
    return '@swc-node/register/esm-register';
  }

  // Resolve relative to the file URL using URL constructor
  // This handles Windows paths correctly (file:///C:/...) without corruption
  const loaderUrl = new URL('../loaders/swc-loader.mjs', fileUrlBase).href;
  return loaderUrl;
}

/**
 * Get the path to @swc-node/register/esm-register
 *
 * This returns the path to our custom swc-loader.mjs which wraps
 * @swc-node/register and resolves dependencies from this package.
 *
 * Uses the URL constructor to handle Windows file:// URLs correctly,
 * avoiding the old string.replace('file://','') + split('/') pattern
 * which corrupted Windows paths.
 */
export function getSwcNodeRegisterPath(): string {
  // import.meta.url gives us the URL of THIS file in the @nextrush/dev package
  // It is already in file:// URL form and is safe to use with the URL constructor
  return resolveLoaderFromUrl(import.meta.url);
}
