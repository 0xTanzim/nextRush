/**
 * @nextrush/router - HP-12 unicode-correct case-normalization fast-path
 *
 * Pins design.md D3: `normalizePathForMatch` skips `toLowerCase()` only when the
 * path is PROVABLY case-stable (all ASCII, no `A`–`Z`), folding on any non-ASCII
 * or uppercase byte — so the result is byte-identical to always folding, and a
 * non-ASCII uppercase path is never wrongly skipped. Also pins that a
 * case-stable (lowercase-ASCII) request needs NO fold allocation and NO second
 * original-case normalize pass, via a `String.prototype.toLowerCase` spy.
 */

import type { RouteHandler } from '@nextrush/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizePathForMatch } from '../matching';
import { createRouter } from '../router';

const noop: RouteHandler = async () => {};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HP-12 — unicode-correct case-normalization fast-path', () => {
  it('does not call toLowerCase for a provably-lowercase ASCII path (case-insensitive)', () => {
    const spy = vi.spyOn(String.prototype, 'toLowerCase');
    const out = normalizePathForMatch('/users/abc', false, false);
    expect(out).toBe('/users/abc');
    expect(spy).not.toHaveBeenCalled();
  });

  it('still folds an ASCII-uppercase path byte-identically to toLowerCase()', () => {
    expect(normalizePathForMatch('/Users/AbC', false, false)).toBe('/Users/AbC'.toLowerCase());
  });

  it('still folds a NON-ASCII uppercase path byte-identically (fast-path does not wrongly skip)', () => {
    // '/ÜRL' contains non-ASCII uppercase; the fast-path must NOT skip folding.
    expect(normalizePathForMatch('/\u00dcRL', false, false)).toBe('/\u00dcRL'.toLowerCase());
    expect(normalizePathForMatch('/caf\u00c9', false, false)).toBe('/caf\u00c9'.toLowerCase());
  });

  it('collapses double slashes and strips a trailing slash identically after the fast-path', () => {
    expect(normalizePathForMatch('//a//b/', false, false)).toBe('/a/b');
    expect(normalizePathForMatch('//A//B/', false, false)).toBe('//A//B/'.toLowerCase().replace(/\/+/g, '/').replace(/\/$/, ''));
  });

  it('a case-stable param match resolves without ANY toLowerCase call (no second normalize pass)', () => {
    const router = createRouter();
    router.get('/users/:id', noop);
    // Warm registration is done; now spy only the match path.
    const spy = vi.spyOn(String.prototype, 'toLowerCase');
    const match = router.match('GET', '/users/42');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ id: '42' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('a case-insensitive param match preserves original-case param values', () => {
    const router = createRouter();
    router.get('/users/:id', noop);
    const match = router.match('GET', '/Users/AbC');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ id: 'AbC' });
  });
});
