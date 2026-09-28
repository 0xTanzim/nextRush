/**
 * In-repo SWC hooks for `nextrush dev` (Node.js).
 *
 * Transforms `.ts` / `.tsx` / `.mts` / `.cts` sources with `@swc/core`, emitting
 * `design:paramtypes` decorator metadata so constructor-injection DI resolves at
 * runtime — the exact behavior the legacy third-party loader used to provide.
 *
 * WHY this exists (finish-ts7-toolchain-migration, D3): the legacy loader package
 * (v1.12.1) declares `peerDependencies.typescript: ">= 4.3 < 7"` and imports the TypeScript
 * compiler's JavaScript API (~21 root APIs), which TypeScript 7 removed from its main
 * entry. This module imports NO TypeScript compiler API at all — only `@swc/core`
 * (already a pinned dependency) plus Node builtins — so the dev loader works unchanged
 * on any installed TypeScript major.
 *
 * SWC OPTION PROVENANCE (D5): the parser/decorator constants below
 * (`syntax: 'typescript'`, `decorators: true`, `legacyDecorator: true`,
 * `decoratorMetadata: true`, `keepClassNames: true`) intentionally mirror
 * `packages/dev/src/commands/build/swc-transform-options.ts`, the single source of
 * truth the Node/Deno builders share. This file is plain `.mjs` (no TS syntax) so Node
 * can load it directly as a hook module from BOTH `src/` (tests, src-context spawns)
 * and `dist/` (copied verbatim by tsdown's `onSuccess`, exactly like its sibling
 * `swc-loader.mjs`) — importing the TS seam at runtime is impossible here without a
 * build step, and bundling this file would couple loader availability to the build and
 * risk inlining the native `@swc/core` binding. Drift between the two is guarded by
 * `src/__tests__/swc-hooks-loader.test.ts`, whose `design:paramtypes` assertions fail
 * the moment either side stops emitting decorator metadata.
 *
 * SCOPE: Node-only dev path. Files under `node_modules/` and declaration files are
 * passed through to the next loader untouched (they are already runnable / never
 * executed). `.cts` maps to CommonJS, everything else to ESM — matching the module
 * system Node itself would assign those extensions.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transformSync } from '@swc/core';

/** Extensions this hook transforms. Declaration files are excluded in `load`. */
const TRANSFORMABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);

/** Suffixes that are never transformed, even though they end in `.ts`. */
const PASSTHROUGH_SUFFIXES = ['.d.ts', '.d.mts', '.d.cts'];

/**
 * Whether a file path (or file URL string) names a TypeScript source this hook owns.
 * Exported for unit tests; the hook entry points use it internally.
 *
 * @param {string} pathOrUrl
 * @returns {boolean}
 */
export function isTransformableFile(pathOrUrl) {
  const path = pathOrUrl.startsWith('file:') ? fileURLToPath(new URL(pathOrUrl)) : pathOrUrl;
  const lower = path.toLowerCase();
  if (PASSTHROUGH_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return false;
  const dot = lower.lastIndexOf('.');
  if (dot === -1) return false;
  return TRANSFORMABLE_EXTENSIONS.has(lower.slice(dot));
}

/**
 * Build the `@swc/core` transform options for one file.
 * Constants mirror `buildSwcTransformOptions` (see module docblock for why they live here).
 * Exported for unit tests.
 *
 * @param {string} filename
 * @returns {import('@swc/core').Options}
 */
export function buildHookTransformOptions(filename) {
  const lower = filename.toLowerCase();
  return {
    filename,
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: lower.endsWith('.tsx'),
        decorators: true,
      },
      target: 'es2022',
      transform: {
        legacyDecorator: true,
        decoratorMetadata: true,
      },
      keepClassNames: true,
    },
    module: {
      type: lower.endsWith('.cts') ? 'commonjs' : 'es6',
    },
    sourceMaps: 'inline',
  };
}

/**
 * Whether a module *specifier* (not just a path) can name a file this hook owns:
 * relative/absolute paths and file URLs with a transformable extension. Bare package
 * specifiers are never handled here — their resolution belongs to Node.
 *
 * @param {string} specifier
 * @returns {boolean}
 */
function isResolvableTsSpecifier(specifier) {
  if (
    !specifier.startsWith('./') &&
    !specifier.startsWith('../') &&
    !specifier.startsWith('/') &&
    !specifier.startsWith('file:')
  ) {
    return false;
  }
  return isTransformableFile(specifier);
}

/**
 * TypeScript sources are authored with `.js`-style relative specifiers (verbatim module
 * syntax: `./config/index.js` meaning `./config/index.ts`) — the previous loader
 * resolved those back to their `.ts` counterparts, and generated projects rely on it
 * (see `cross-runtime-parity-smoke.test.ts`). When default resolution fails for a
 * relative/absolute specifier with a JS-ish extension, retry with TS counterparts.
 */
/**
 * @type {Record<string, string[] | undefined>}
 */
const JS_TO_TS_EXTENSIONS = {
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
};

/**
 * @param {string} specifier
 * @param {string[]} extensions
 * @returns {string[]}
 */
function withSwappedExtension(specifier, extensions) {
  const dot = specifier.lastIndexOf('.');
  const stem = specifier.slice(0, dot);
  return extensions.map((ext) => `${stem}${ext}`);
}

/**
 * Read the loader-relevant `code` off a caught resolution failure without letting an
 * `any`-typed catch variable leak into the logic below (the repo lints this file with
 * type-aware rules).
 *
 * @param {unknown} error
 * @returns {string | undefined}
 */
function resolutionErrorCode(error) {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = /** @type {{ code?: unknown }} */ (error).code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Node `resolve` hook: give TS extensions an explicit format when Node cannot.
 *
 * @param {string} specifier
 * @param {{ parentURL: string }} context
 * @param {(specifier: string, context: object) => Promise<{ url: string, format?: string }>} nextResolve
 * @returns {Promise<{ url: string, format?: string, shortCircuit?: boolean }>}
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (isResolvableTsSpecifier(specifier) && resolutionErrorCode(error) === 'ERR_UNKNOWN_FILE_EXTENSION') {
      // Node resolved the path but has no format for the extension. Re-resolve the
      // specifier against the parent so relative imports keep working, then assign
      // the format Node itself would use for the extension.
      const url = String(new URL(specifier, context.parentURL));
      return {
        url,
        format: url.toLowerCase().endsWith('.cts') ? 'commonjs' : 'module',
        shortCircuit: true,
      };
    }
    // Extension-mapped retry: `./x.js` → `./x.ts` / `./x.tsx` (first hit wins).
    // Only for file-relative specifiers; bare packages keep Node's original error.
    const lower = specifier.toLowerCase();
    const dot = lower.lastIndexOf('.');
    const candidates =
      dot !== -1 &&
      (specifier.startsWith('./') ||
        specifier.startsWith('../') ||
        specifier.startsWith('/') ||
        specifier.startsWith('file:'))
        ? JS_TO_TS_EXTENSIONS[lower.slice(dot)]
        : undefined;
    if (candidates) {
      for (const candidate of withSwappedExtension(specifier, candidates)) {
        try {
          const resolved = await nextResolve(candidate, context);
          return { ...resolved, shortCircuit: true };
        } catch (candidateError) {
          // Resolved to a real file Node has no format for — assign it directly.
          if (resolutionErrorCode(candidateError) === 'ERR_UNKNOWN_FILE_EXTENSION') {
            const url = String(new URL(candidate, context.parentURL));
            return {
              url,
              format: url.toLowerCase().endsWith('.cts') ? 'commonjs' : 'module',
              shortCircuit: true,
            };
          }
          // try the next counterpart
        }
      }
    }
    throw error;
  }
}

/**
 * Node `load` hook: transform owned TypeScript sources, pass everything else through.
 *
 * @param {string} url
 * @param {object} context
 * @param {(url: string, context: object) => Promise<{ format?: string, source?: string | Uint8Array, shortCircuit?: boolean }>} nextLoad
 * @returns {Promise<{ format: string, source?: string, shortCircuit: boolean }>}
 */
export async function load(url, context, nextLoad) {
  if (!url.startsWith('file:') || !isTransformableFile(url)) {
    return nextLoad(url, context);
  }
  const filename = fileURLToPath(url);
  // Already-runnable third-party code is never transformed (parity with the previous
  // loader, and avoids breaking shipped output or paying transform cost per import).
  if (/[/\\]node_modules[/\\]/.test(filename)) {
    return nextLoad(url, context);
  }
  const source = readFileSync(filename, 'utf-8');
  const { code } = transformSync(source, buildHookTransformOptions(filename));
  return {
    format: filename.toLowerCase().endsWith('.cts') ? 'commonjs' : 'module',
    source: code,
    shortCircuit: true,
  };
}
