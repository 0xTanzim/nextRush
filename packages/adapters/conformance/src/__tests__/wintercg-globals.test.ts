/**
 * WinterCG allowed-globals assertion (runtime-proof-harness, R3 / task group 4).
 *
 * Enumerates the WinterCG Minimum Common Web Platform API surface the request
 * path may use, and scans the core request-path source for forbidden Node-only
 * globals (`process`, `Buffer`, `__dirname`, `__filename`) — real usages, not
 * incidental substring matches (comments, JSDoc, or local variables that share
 * a name like `buffer.length`).
 *
 * Scope is deliberately the REQUEST PATH, not every file in the core layer:
 * `@nextrush/runtime`'s `detection.ts` legitimately reads `process.versions`/
 * `process.env` — its entire job is one-time platform detection at startup,
 * not per-request handling, and this is a documented, guarded invariant (see
 * `07-runtime-architecture.md`'s "Runtime assumptions today" section: "process.*
 * in the core is confined to runtime detection"). Flagging it here would either
 * force a false failure on legitimate, already-reviewed code, or force an
 * overly-broad exemption that defeats the assertion's purpose. `detection.ts`
 * is excluded by file name, not by a blanket exemption comment, so the
 * exclusion itself is visible and reviewable.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..', '..', '..');

/**
 * WinterCG Minimum Common Web Platform API — the allowed global surface for
 * the request path. Curated snapshot (see design.md's "Open Questions": kept
 * intentionally reviewable rather than sourced from a live spec fetch).
 */
export const WINTERCG_ALLOWED_GLOBALS = [
  'Request',
  'Response',
  'URL',
  'URLSearchParams',
  'fetch',
  'Headers',
  'AbortController',
  'AbortSignal',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'TextEncoder',
  'TextDecoder',
  'crypto',
  'structuredClone',
  'setTimeout',
  'clearTimeout',
  'queueMicrotask',
  'globalThis',
] as const;

/** Forbidden Node-only globals — real usage of these breaks on edge/WinterCG runtimes. */
const FORBIDDEN_NODE_GLOBALS = ['process', 'Buffer', '__dirname', '__filename'] as const;

/**
 * Request-path source files: the core layer's implementation files (not
 * tests, not the platform-detection module — see the file header).
 */
const REQUEST_PATH_FILES = [
  'packages/core/src/application.ts',
  'packages/core/src/middleware.ts',
  'packages/core/src/error-handler.ts',
  'packages/core/src/route-mount.ts',
  'packages/core/src/errors.ts',
  'packages/router/src/router.ts',
  'packages/router/src/dispatch.ts',
  'packages/router/src/matching.ts',
  'packages/router/src/match-route.ts',
  'packages/router/src/composition.ts',
  'packages/router/src/middleware-adapter.ts',
  'packages/router/src/registration.ts',
  'packages/router/src/segment-trie.ts',
  'packages/router/src/state.ts',
  'packages/router/src/redirect.ts',
  'packages/router/src/group-router.ts',
  'packages/runtime/src/body-source.ts',
  'packages/runtime/src/response-builder.ts',
  'packages/runtime/src/request-signal.ts',
  'packages/runtime/src/headers.ts',
  'packages/runtime/src/query.ts',
  'packages/runtime/src/server-error.ts',
  'packages/errors/src/base.ts',
  'packages/errors/src/http-errors.ts',
  'packages/errors/src/factory.ts',
  'packages/errors/src/middleware.ts',
  'packages/errors/src/validation.ts',
  'packages/stream/src/writers.ts',
  'packages/stream/src/run.ts',
  'packages/stream/src/stream-controller.ts',
  'packages/stream/src/sse-format.ts',
];

/**
 * Matches a real reference to `name` as an identifier — not a substring
 * inside another word, a comment, prose inside a string/template literal
 * (e.g. "kill the process using that port" is English text, not a reference
 * to the global `process`), or a differently-named local variable (e.g. a
 * local `buffer` must not match the global `Buffer`).
 */
function usesForbiddenGlobal(source: string, name: string): boolean {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments (incl. JSDoc)
    .replace(/\/\/.*$/gm, ''); // line comments
  // Strip string/template literal contents (keep the surrounding code intact
  // so identifier positions elsewhere on the line are unaffected). Handles
  // escaped quotes within the literal.
  const withoutStrings = withoutComments
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
  const identifierPattern = new RegExp(`(?<![.\\w])${name}(?![\\w])`, 'g');
  return identifierPattern.test(withoutStrings);
}

describe('WinterCG allowed-globals assertion', () => {
  it('enumerates a non-empty allowed-global surface', () => {
    expect(WINTERCG_ALLOWED_GLOBALS.length).toBeGreaterThan(0);
  });

  it('request-path source references no forbidden Node-only global', () => {
    const violations: string[] = [];

    for (const relativePath of REQUEST_PATH_FILES) {
      const source = readFileSync(join(repoRoot, relativePath), 'utf8');
      for (const forbidden of FORBIDDEN_NODE_GLOBALS) {
        if (usesForbiddenGlobal(source, forbidden)) {
          violations.push(`${relativePath}: uses forbidden global '${forbidden}'`);
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });
});
