/**
 * @nextrush/runtime - parseQueryString tests
 *
 * Executable contract for OpenSpec change
 * `web-adapters-context-response-microtrims` (HP-2-web): the empty and
 * over-limit early-return branches SHALL return a single shared frozen empty
 * query object instead of allocating a fresh `Object.create(null)` per call,
 * while the non-empty parse path is unchanged and returns its own object.
 *
 * The three Web contexts (Bun/Deno/Edge) call `parseQueryString` on every
 * request; a query-less request must therefore allocate no throwaway object.
 * `ctx.query` is `readonly`, so a shared frozen instance changes no observable
 * behavior (and turns any future mutation into a loud failure).
 */

import { describe, expect, it } from 'vitest';
import { parseQueryString } from '../query.js';

/** A raw query string longer than the parser's MAX_QUERY_LENGTH (2048). */
const OVER_LIMIT = `${'a=1&'.repeat(600)}`; // ~2400 chars, > 2048

describe('parseQueryString — HP-2-web shared frozen empty query', () => {
  it('returns the shared frozen empty object for an empty input, identity-stable across calls', () => {
    const a = parseQueryString('');
    const b = parseQueryString('');
    expect(a).toEqual({});
    // Identity-stable: no fresh per-request object is allocated.
    expect(a).toBe(b);
    // Read-only contract: the shared instance is frozen.
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('returns the same shared frozen empty object for an over-limit query (reject-to-empty)', () => {
    expect(OVER_LIMIT.length).toBeGreaterThan(2048);
    const empty = parseQueryString('');
    const overLimit = parseQueryString(OVER_LIMIT);
    expect(overLimit).toEqual({});
    // Over-limit rejects to the SAME shared empty instance as the empty path.
    expect(overLimit).toBe(empty);
  });

  it('returns its own parsed object (not the shared instance) for a non-empty query, values unchanged', () => {
    const shared = parseQueryString('');
    const parsed = parseQueryString('a=1&b=2');
    // A real parse must not return the shared empty instance...
    expect(parsed).not.toBe(shared);
    // ...and its values are unchanged from today's behavior.
    expect(parsed).toEqual({ a: '1', b: '2' });
    // The non-empty result is a mutable own object (not the frozen shared one).
    expect(Object.isFrozen(parsed)).toBe(false);
  });
});
