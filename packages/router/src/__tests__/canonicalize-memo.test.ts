/**
 * @nextrush/router - Canonicalization memo correctness
 *
 * `canonicalizePath` memoizes its most recent result, and `matchesMountPrefix`
 * memoizes the canonical form of its (registration-fixed) prefix. Both exist to
 * remove the O(mounts) canonicalization cost a request paid falling through
 * prefix mounts — measured at ~557 ns per mounted router before, ~190 ns after.
 *
 * A memo is only sound if it can never return an answer that differs from
 * recomputing. The hazard is options: `caseSensitive` and `strict` change the
 * result for the same input string, and two routers with different options can
 * be mounted in the same application. These tests pin that.
 *
 * @see reports/investigations/post-audit-invariant-erosion-review.md F-1
 */

import { describe, expect, it } from 'vitest';
import { canonicalizePath } from '../canonicalize';
import { createRouter } from '../router';

describe('canonicalizePath memo cannot leak across option combinations', () => {
  it('returns the folded path for caseSensitive=false and the raw path for true', () => {
    // Same input, alternating options — a memo keyed only on the string would
    // return the first answer for both.
    for (let i = 0; i < 3; i++) {
      expect(canonicalizePath('/Users/List', false, false).path).toBe('/users/list');
      expect(canonicalizePath('/Users/List', true, false).path).toBe('/Users/List');
    }
  });

  it('respects strict for the same input string', () => {
    for (let i = 0; i < 3; i++) {
      expect(canonicalizePath('/users/', false, false).path).toBe('/users');
      expect(canonicalizePath('/users/', false, true).path).toBe('/users/');
    }
  });

  it('still rejects a dot segment after a non-rejected call for another path', () => {
    expect(canonicalizePath('/safe/path', false, false).rejected).toBe(false);
    expect(canonicalizePath('/a/../b', false, false).rejected).toBe(true);
    expect(canonicalizePath('/safe/path', false, false).rejected).toBe(false);
    expect(canonicalizePath('/a/./b', false, false).rejected).toBe(true);
  });

  it('is stable under repetition and equal to a first-call result', () => {
    const first = canonicalizePath('/A//b/', false, false);
    canonicalizePath('/something/else', true, true);
    const again = canonicalizePath('/A//b/', false, false);
    expect(again.path).toBe(first.path);
    expect(again.rejected).toBe(first.rejected);
    expect(again.path).toBe('/a/b');
  });

  it('strips the query string consistently whether memoized or not', () => {
    expect(canonicalizePath('/users?a=1', false, false).path).toBe('/users');
    expect(canonicalizePath('/users?a=1', false, false).path).toBe('/users');
    expect(canonicalizePath('/users?b=2', false, false).path).toBe('/users');
  });
});

describe('matchesMountPrefix prefix memo', () => {
  it('returns the correct remainder repeatedly for one prefix', () => {
    const router = createRouter();
    for (let i = 0; i < 3; i++) {
      expect(router.matchesMountPrefix('/api/v1/users/42', '/api/v1')).toBe('/users/42');
    }
  });

  it('handles a router tested against two different prefixes (memo miss path)', () => {
    const router = createRouter();
    expect(router.matchesMountPrefix('/api/users', '/api')).toBe('/users');
    expect(router.matchesMountPrefix('/admin/users', '/admin')).toBe('/users');
    expect(router.matchesMountPrefix('/api/users', '/api')).toBe('/users');
    // A prefix that does not match must still miss after the memo warmed.
    expect(router.matchesMountPrefix('/api/users', '/admin')).toBeUndefined();
  });

  it('tests the prefix boundary folded, but returns the client-cased remainder', () => {
    const insensitive = createRouter();
    // The boundary is a matching decision, so it folds: /ADMIN is under /admin.
    // The remainder becomes the mounted router's ctx.path, and that router both
    // re-canonicalizes it for matching and binds parameter values from it — so
    // it keeps the casing the client wrote.
    expect(insensitive.matchesMountPrefix('/ADMIN/Users', '/admin')).toBe('/Users');
    expect(insensitive.matchesMountPrefix('/admin/users', '/admin')).toBe('/users');

    const sensitive = createRouter({ caseSensitive: true });
    expect(sensitive.matchesMountPrefix('/ADMIN/Users', '/admin')).toBeUndefined();
    expect(sensitive.matchesMountPrefix('/admin/Users', '/admin')).toBe('/Users');
  });

  it('keeps the remainder correctly offset when a fold changes a character length', () => {
    const router = createRouter();
    // U+0130 folds to two code points, so the folded path is longer than the
    // case-preserved one — a remainder taken by character offset out of the
    // folded path cannot be reused against the preserved one.
    expect(router.matchesMountPrefix('/API/\u0130/X', '/api')).toBe('/\u0130/X');
    expect(router.matchesMountPrefix('/API/V1/Users/42', '/api/v1')).toBe('/Users/42');
  });

  it('enforces the segment boundary rather than a bare string prefix', () => {
    const router = createRouter();
    expect(router.matchesMountPrefix('/apifoo/bar', '/api')).toBeUndefined();
    expect(router.matchesMountPrefix('/api/bar', '/api')).toBe('/bar');
    expect(router.matchesMountPrefix('/api', '/api')).toBe('/');
  });

  it('rejects a dot-segment path', () => {
    const router = createRouter();
    expect(router.matchesMountPrefix('/api/../secret', '/api')).toBeUndefined();
  });

  it('gives two routers with different options independent answers', () => {
    const a = createRouter({ caseSensitive: false });
    const b = createRouter({ caseSensitive: true });
    // Interleaved, so a shared memo keyed only on the string would cross over.
    for (let i = 0; i < 3; i++) {
      expect(a.matchesMountPrefix('/API/X', '/api')).toBe('/X');
      expect(b.matchesMountPrefix('/API/X', '/api')).toBeUndefined();
    }
  });
});
