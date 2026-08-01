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

// ── Typed accessors for Node built-ins (RFC-019 D3) ────────────────────────────
// These wrap the variable-specifier `import(NODE_*)` pattern — which stops
// esbuild/tsup rewriting the `node:` prefix (Deno requires it) — in a typed cast so
// `tsc` verifies usage again. Importing via the bare const specifier alone yields
// `any`, which is how a runtime type error (a TypeScriptFile object passed where a
// path string was expected) shipped undetected in deno-builder.ts. Prefer these over
// a raw `await import(NODE_*)` anywhere the module's API is actually used.

/** `node:path`, typed, with the bundler-safe variable specifier preserved. */
export async function getNodePath(): Promise<typeof import('node:path')> {
  return (await import(/* @vite-ignore */ NODE_PATH)) as typeof import('node:path');
}

/** `node:fs/promises`, typed, with the bundler-safe variable specifier preserved. */
export async function getNodeFsPromises(): Promise<typeof import('node:fs/promises')> {
  return (await import(/* @vite-ignore */ NODE_FS_PROMISES)) as typeof import('node:fs/promises');
}

/** `node:child_process`, typed, with the bundler-safe variable specifier preserved. */
export async function getNodeChildProcess(): Promise<typeof import('node:child_process')> {
  return (await import(/* @vite-ignore */ NODE_CHILD_PROCESS)) as typeof import('node:child_process');
}

/** `node:fs`, typed, with the bundler-safe variable specifier preserved. */
export async function getNodeFs(): Promise<typeof import('node:fs')> {
  return (await import(/* @vite-ignore */ NODE_FS)) as typeof import('node:fs');
}

/** `node:os`, typed, with the bundler-safe variable specifier preserved. */
export async function getNodeOs(): Promise<typeof import('node:os')> {
  return (await import(/* @vite-ignore */ NODE_OS)) as typeof import('node:os');
}

/** `node:module`, typed, with the bundler-safe variable specifier preserved. */
export async function getNodeModule(): Promise<typeof import('node:module')> {
  return (await import(/* @vite-ignore */ NODE_MODULE)) as typeof import('node:module');
}

/** The `dist/` segment every build output lives under — the depth-independent anchor. */
const DIST_SEGMENT = '/dist/';

/** Path joined onto the resolved `dist/` root to locate the SWC loader. */
const LOADER_RELATIVE_PATH = 'loaders/swc-loader.mjs';

/**
 * Find the `dist/` root of a `file://` URL — the URL truncated right after its first
 * `/dist/` segment — regardless of how many directories deep under `dist/` the URL goes.
 *
 * Why this instead of a fixed relative climb (the original bug) or a real filesystem
 * walk-up to `package.json`: `packages/dev`'s `tsup.config.ts` builds with
 * `splitting: false`, so this module's code is inlined SEPARATELY into every one of the
 * package's 14 entry-point bundles — including `dist/cli.js` (the real CLI entry point).
 * Depending which bundle the caller ends up in, `import.meta.url` can be `dist/cli.js`
 * itself (zero directories under `dist/`) or `dist/runtime/node-modules.js` (one
 * directory under `dist/`). A hardcoded relative climb (`'../loaders/...'`) is only
 * correct for one of those depths. Anchoring on the literal `/dist/` segment sidesteps
 * the depth question entirely: the root is the same URL prefix regardless of which
 * bundle called in, and — unlike a `package.json` filesystem walk — this stays a pure
 * string/URL transform with no I/O, so it is testable with a synthetic `import.meta.url`
 * that has no real file backing it on disk (exactly what this file's own test suite does).
 *
 * `import.meta.resolve('@nextrush/dev/package.json')` was considered instead (design.md
 * D1) but rejected: `@nextrush/dev`'s `package.json` only declares an `exports["."]`
 * entry, not a `./package.json` subpath export, so that call throws
 * `ERR_PACKAGE_PATH_NOT_EXPORTED` even for a correctly workspace-linked install (verified
 * directly against this repo's fixture before choosing this approach, per design.md's
 * Open Question).
 *
 * @param fileUrlBase The `file://` URL to search (assumed to already contain `/dist/`
 *   — callers check that via {@link resolveLoaderFromUrl}'s dev-mode branch first)
 * @returns The `file://` URL of the `dist/` directory itself (trailing slash included)
 */
function findDistRoot(fileUrlBase: string): string {
  const distIndex = fileUrlBase.lastIndexOf(DIST_SEGMENT);
  // Slice up to and including the trailing slash of "/dist/" so the result is a
  // directory URL ready to have a relative path joined onto it. We anchor on the LAST
  // `/dist/` — the package's own build output — so an ancestor directory named `dist`
  // in the install path (e.g. `/home/u/dist/app/node_modules/@nextrush/dev/dist/cli.js`)
  // cannot win over the real one (RFC-019, F-12).
  return fileUrlBase.slice(0, distIndex + DIST_SEGMENT.length);
}

/**
 * Resolve the SWC loader path from a file URL base.
 *
 * Pure function for testability — factors out URL resolution logic.
 * Handles both posix and Windows file:// URLs correctly.
 *
 * Resolution is anchored to the URL's `/dist/` segment (via {@link findDistRoot}), not to
 * the calling module's own directory depth beneath it — see that function's doc comment
 * for why a depth-relative climb is unsafe here.
 *
 * @param fileUrlBase The URL of THIS file (import.meta.url)
 * @returns Either a file:// URL to the loader or the npm package fallback
 */
export function resolveLoaderFromUrl(fileUrlBase: string): string {
  // Check if this is a dist location
  if (!fileUrlBase.includes(DIST_SEGMENT)) {
    // Dev mode: fallback to npm package
    return '@swc-node/register/esm-register';
  }

  const distRoot = findDistRoot(fileUrlBase);
  const loaderUrl = new URL(LOADER_RELATIVE_PATH, distRoot).href;
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
