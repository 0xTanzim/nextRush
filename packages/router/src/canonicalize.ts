/**
 * @nextrush/router - Canonical Request Path
 *
 * The single normalization owner (RFC-029): every consumer that needs to know
 * "what path does the router treat this request as" — the router's own match,
 * a mounted-router prefix test, a CSRF exclude-path match, an adapter's
 * published `ctx.path` — calls {@link canonicalizePath} instead of hand-rolling
 * its own fold/collapse/strip, so there is exactly one definition of "the same
 * path" across the framework (SEC-02, SEC-09, SEC-15).
 *
 * @see docs/RFC/request-data/029-canonical-request-path.md
 * @packageDocumentation
 */

import { collapseAndStrip, isProvablyLowerAscii } from './matching';

/** Result of {@link canonicalizePath}. */
export interface CanonicalPathResult {
  /**
   * `true` when the path contains a `.`/`..` path segment. A dot segment is
   * rejected outright (400), never resolved — resolving it locally would
   * diverge from how a front-end proxy already resolved (or didn't resolve)
   * the same segment before forwarding, reopening the desync this RFC closes.
   */
  readonly rejected: boolean;
  /**
   * The canonical path: query-stripped, dot-segment-free, case-folded (unless
   * `caseSensitive`), slash-collapsed, trailing-slash-stripped per `strict`.
   * Meaningless when {@link rejected} is `true`.
   */
  readonly path: string;
}

const DOT = 0x2e; // '.'
const SLASH = 0x2f; // '/'

/**
 * True when `path` (already query-stripped) contains a `.` or `..` segment —
 * a component that is exactly `.` or `..` between slash boundaries (or at the
 * start/end of the string). A single linear scan, no backtracking regex
 * (task 3.5): each character is visited at most once, so a pathological input
 * cannot degrade to worse than O(n).
 *
 * A dot as filename content (`archive.tar.gz`, `..hidden.txt`) is NOT a dot
 * segment — only a component whose entire text between slashes is `.` or `..`
 * counts.
 */
export function hasDotSegment(path: string): boolean {
  const len = path.length;
  let segStart = 0;

  for (let i = 0; i <= len; i++) {
    const atBoundary = i === len || path.charCodeAt(i) === SLASH;
    if (!atBoundary) continue;

    const segLen = i - segStart;
    if (segLen === 1 && path.charCodeAt(segStart) === DOT) return true;
    if (segLen === 2 && path.charCodeAt(segStart) === DOT && path.charCodeAt(segStart + 1) === DOT) {
      return true;
    }
    segStart = i + 1;
  }

  return false;
}

/**
 * Canonicalize a raw request target into the one path value every consumer
 * (router match, mount-prefix test, CSRF exclude match, published `ctx.path`)
 * treats as "this request's path" (RFC-029).
 *
 * Order: strip the query string, reject a dot segment before any further
 * normalization (a dot segment is a request-shape violation, not something to
 * fold case on first), then fold case (unless `caseSensitive`) and collapse
 * structure exactly as {@link import('./matching').normalizePathForMatch} does
 * — this function IS that normalization, extended with dot-segment rejection
 * and made a public, adapter-facing entry point.
 *
 * @param rawTarget - The raw request target, may include a query string.
 * @param caseSensitive - Router case-sensitivity option.
 * @param strict - Router strict-trailing-slash option.
 */
export function canonicalizePath(
  rawTarget: string,
  caseSensitive: boolean,
  strict: boolean
): CanonicalPathResult {
  const queryIdx = rawTarget.indexOf('?');
  const path = queryIdx === -1 ? rawTarget : rawTarget.slice(0, queryIdx);

  if (hasDotSegment(path)) {
    return { rejected: true, path };
  }

  const folded = caseSensitive || isProvablyLowerAscii(path) ? path : path.toLowerCase();
  return { rejected: false, path: collapseAndStrip(folded, strict) };
}
