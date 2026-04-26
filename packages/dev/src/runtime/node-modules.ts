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
 * Get the path to @swc-node/register/esm-register
 *
 * This returns the path to our custom swc-loader.mjs which wraps
 * @swc-node/register and resolves dependencies from this package.
 */
export function getSwcNodeRegisterPath(): string {
  // import.meta.url gives us the URL of THIS file in the @nextrush/dev package
  const thisFileUrl = import.meta.url;
  const thisFilePath = thisFileUrl.replace('file://', '');

  // Navigate from dist/runtime/node-modules.js to dist/loaders/swc-loader.mjs
  const parts = thisFilePath.split('/');
  const distIndex = parts.lastIndexOf('dist');

  if (distIndex === -1) {
    // Fallback to standard import path (when running from src in dev mode)
    return '@swc-node/register/esm-register';
  }

  const packageRoot = parts.slice(0, distIndex).join('/');
  return `${packageRoot}/dist/loaders/swc-loader.mjs`;
}
