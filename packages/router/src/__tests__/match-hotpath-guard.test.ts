/**
 * @nextrush/router - HP-18 deopt-pattern regression guard
 *
 * Static source guard for OpenSpec change `router-context-final-cleanup` (HP-18).
 * The P2 rewrite (`router-match-path-allocation-trim`) removed the two V8
 * deopt/allocation patterns from the router match path:
 *
 *  - the eager-bind + backtrack `Reflect.deleteProperty(params, name)` used to
 *    undo a stale param binding, and
 *  - the `Object.keys(...)`-based post-match loop that materialized params.
 *
 * Both are gone today (params are bound via deferred parallel stacks and a
 * bind-count loop). This guard fails if EITHER is reintroduced into the router
 * match sources, so a future edit cannot silently regress the hot path.
 *
 * WHY a source scan rather than a behavioral spy: the invariant is "this
 * mechanism never comes back", not "one probe doesn't trigger it". A spy
 * (see `match-safety.test.ts`) proves a specific match doesn't call them; this
 * proves the identifiers are absent from the source entirely — a stronger,
 * edit-resistant contract. Comments are stripped first because the source prose
 * deliberately NAMES these removed patterns to explain why they're gone.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..');

/**
 * The files that make up the router match path (design.md / proposal). `find-node.ts`
 * holds the method-agnostic walk split out of `matching.ts` during the HP-17
 * rewrite, so it is guarded alongside the two match sources.
 */
const MATCH_SOURCES = ['matching.ts', 'match-route.ts', 'find-node.ts'] as const;

/**
 * Remove block (`/* ... *\/`) and line (`// ...`) comments so the guard scans
 * only executable code — the source comments intentionally reference the very
 * patterns this guard forbids, to document that they were removed.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function readCode(file: string): string {
  return stripComments(readFileSync(join(SRC, file), 'utf-8'));
}

describe('HP-18 — router match path stays free of the removed deopt patterns', () => {
  it.each(MATCH_SOURCES)('%s contains no backtrack Reflect.deleteProperty', (file) => {
    expect(readCode(file)).not.toContain('Reflect.deleteProperty');
  });

  it.each(MATCH_SOURCES)('%s contains no Object.keys post-match loop', (file) => {
    expect(readCode(file)).not.toContain('Object.keys');
  });

  it('actually scanned real, non-empty match sources (guard is not vacuous)', () => {
    for (const file of MATCH_SOURCES) {
      const code = readCode(file);
      // Sanity: the file exists, has real content, and the comment-stripper
      // left the actual matcher code (so the negative assertions above are
      // scanning something, not an empty string).
      expect(code.length).toBeGreaterThan(200);
      expect(code).toContain('export function');
    }
  });
});
