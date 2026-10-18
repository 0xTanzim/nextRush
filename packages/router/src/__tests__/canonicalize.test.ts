/**
 * @nextrush/router — dot-segment rejection covers every spelling of a dot.
 *
 * A dot segment is rejected, never resolved: resolving it locally diverges from
 * what a front proxy already did with the same segment before forwarding, which
 * is the desync the rejection exists to prevent. A client can therefore spell
 * the segment any way the receiving stack will decode — `.`, `%2e`, `.%2e`,
 * `%2e.`, `%2e%2e` — so the rejection has to see all of them, or the control is
 * bypassable by re-spelling the same path.
 *
 * A dot that is filename content, and a percent sign that does not encode a dot,
 * are not dot segments and must keep working.
 */

import { describe, expect, it } from 'vitest';
import { canonicalizePath, hasDotSegment } from '../canonicalize';

/** Every spelling that decodes to a `.` or `..` component, at every position. */
const REJECTED = [
  '/a/../b',
  '/a/./b',
  '/%2e',
  '/%2e%2e',
  '/a/%2e/b',
  '/a/%2E/b',
  '/a/%2e%2e/b',
  '/a/%2E%2E/b',
  '/a/%2e%2E/b',
  '/a/.%2e/b',
  '/a/%2e./b',
  '/a/.%2E/b',
  '/a/%2E./b',
  '/a/%2e%2e',
  '/a/%2e%2e/',
];

/**
 * Content that merely contains a dot or a percent sign. Each of these is a real
 * filename today and must stay one.
 */
const ACCEPTED = [
  '/a/b',
  '/a/...',
  '/a/%2e%2e%2e', // nine characters: decodes to `...`, not a dot segment
  '/archive.tar.gz',
  '/a/..hidden',
  '/a/.hidden',
  '/a/%2ehidden', // decodes to `.hidden`
  '/a/..hidden.txt',
  '/a/%252e%252e/b', // double-encoded: one decode leaves a literal `%2e%2e`
  '/a/%2e%2eb', // decodes to `..b`
  '/a/%2', // incomplete escape
  '/a/%2f', // `%2f` is a slash, deliberately not decoded here
  '/a/%2E%2e%2Fb', // `%2F` ends the segment as a non-dot character
];

describe('canonicalizePath rejects every encoded spelling of a dot segment', () => {
  it.each(REJECTED)('rejects %s', (target) => {
    expect(canonicalizePath(target, false, false).rejected).toBe(true);
  });

  it.each(ACCEPTED)('accepts %s', (target) => {
    expect(canonicalizePath(target, false, false).rejected).toBe(false);
  });

  it('reports the request target itself for a rejected path', () => {
    const result = canonicalizePath('/Files/%2e%2e/Admin', false, false);
    expect(result.rejected).toBe(true);
    expect(result.path).toBe('/Files/%2e%2e/Admin');
    expect(result.valuePath).toBe('/Files/%2e%2e/Admin');
  });

  it('keeps the canonical form for an accepted path that contains dots', () => {
    const result = canonicalizePath('/Files/archive.tar.gz', false, false);
    expect(result.rejected).toBe(false);
    expect(result.path).toBe('/files/archive.tar.gz');
  });
});

describe('hasDotSegment is the single definition of a dot segment', () => {
  it('matches the decoded form, not the spelling', () => {
    expect(hasDotSegment('/%2e')).toBe(true);
    expect(hasDotSegment('/%2e%2e')).toBe(true);
    expect(hasDotSegment('/a/.%2E/')).toBe(true);
  });

  it('does not match a segment that only starts with a dot or a percent', () => {
    expect(hasDotSegment('/..hidden')).toBe(false);
    expect(hasDotSegment('/%2ehidden')).toBe(false);
    expect(hasDotSegment('/%252e%252e')).toBe(false);
    expect(hasDotSegment('/archive.tar.gz')).toBe(false);
  });

  it('answers a long run of near-miss segments without rejecting any', () => {
    // The scan is a single pass with no backtracking, so this is correctness at
    // scale rather than a timing assertion: 36k characters of decoys, none of
    // which is a dot segment.
    const decoys = `/${'%2e%2e%2e/'.repeat(4000)}a`;
    expect(decoys.length).toBeGreaterThan(36000);
    expect(hasDotSegment(decoys)).toBe(false);
  });
});
