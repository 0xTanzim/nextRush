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

/**
 * The two strings one canonicalization pass yields.
 *
 * A request path answers two different questions — "which route is this?" and
 * "what values did the client write?" — and folding case is only correct for
 * the first. Folding the second changes the data a handler acts on, so both
 * strings come from the same pass: a matching decision and a bound value can
 * never describe different requests.
 */
export interface CanonicalPaths {
  /**
   * The canonical path: query-stripped, dot-segment-free, case-folded (unless
   * `caseSensitive`), slash-collapsed, trailing-slash-stripped per `strict`.
   * This is the string matching and every path-policy decision use.
   */
  readonly path: string;
  /**
   * The same query-stripped, slash-collapsed, trailing-slash-stripped path with
   * the request's own casing preserved — the string parameter and wildcard
   * values are extracted from. The identical segment and separator structure as
   * {@link path}, so segment N of one is segment N of the other.
   *
   * It is the same string value as {@link path} whenever no folding occurred, so
   * the common all-lowercase request allocates no second path.
   */
  readonly valuePath: string;
}

/** Result of {@link canonicalizePath}. */
export interface CanonicalPathResult extends CanonicalPaths {
  /**
   * `true` when the path contains a `.`/`..` segment, in any percent-encoded
   * spelling of one. A dot segment is rejected outright (400), never resolved —
   * resolving it locally would diverge from how a front-end proxy already
   * resolved (or didn't resolve) the same segment before forwarding, reopening
   * the desync this RFC closes.
   */
  readonly rejected: boolean;
}

const DOT = 0x2e; // '.'
const SLASH = 0x2f; // '/'
const PERCENT = 0x25; // '%'
const HEX_TWO = 0x32; // '2'
const LOWER_E = 0x65; // 'e'
const UPPER_E = 0x45; // 'E'

/** The longest spelling of a dot segment is `%2e%2e`; anything longer is content. */
const MAX_DOT_SEGMENT_LENGTH = 6;

/**
 * True when one component decodes to exactly one or two dots.
 *
 * `%2e`/`%2E` is the only escape decoded. `%2f`/`%5c` are deliberately left
 * alone: treating them as separators would invent a component boundary the
 * receiving stack never had, and a double-encoded `%252e` is the literal text
 * of a file name rather than a dot. Any other character means the component is
 * content, so the scan stops there.
 */
function isDotComponent(path: string, start: number, end: number): boolean {
  let dots = 0;
  let i = start;

  while (i < end) {
    const code = path.charCodeAt(i);
    if (code === DOT) {
      dots++;
      i++;
      continue;
    }
    if (
      code === PERCENT &&
      i + 3 <= end &&
      path.charCodeAt(i + 1) === HEX_TWO &&
      (path.charCodeAt(i + 2) === LOWER_E || path.charCodeAt(i + 2) === UPPER_E)
    ) {
      dots++;
      i += 3;
      continue;
    }
    return false;
  }

  return dots === 1 || dots === 2;
}

/**
 * True when `path` (already query-stripped) contains a `.` or `..` segment — a
 * component that decodes to exactly `.` or `..` between slash boundaries (or at
 * the start/end of the string). A single linear scan, no backtracking regex
 * (task 3.5): each character is visited at most once, so a pathological input
 * cannot degrade to worse than O(n).
 *
 * Every spelling is matched, not just the literal one. A client can write the
 * same component as `.`, `%2e`, `.%2e`, `%2e.` or `%2e%2e`, and a receiving
 * stack above the router may well decode one of them; matching only the literal
 * form would leave the rejection bypassable by re-spelling the path.
 *
 * A dot as filename content (`archive.tar.gz`, `..hidden.txt`) is NOT a dot
 * segment — only a component whose entire decoded text is `.` or `..` counts.
 */
export function hasDotSegment(path: string): boolean {
  const len = path.length;
  let segStart = 0;

  for (let i = 0; i <= len; i++) {
    const atBoundary = i === len || path.charCodeAt(i) === SLASH;
    if (!atBoundary) continue;

    const segLen = i - segStart;
    // A component that could decode to a dot segment starts with a dot or a
    // percent sign and is short; every other component costs one comparison.
    if (segLen !== 0 && segLen <= MAX_DOT_SEGMENT_LENGTH) {
      const first = path.charCodeAt(segStart);
      if ((first === DOT || first === PERCENT) && isDotComponent(path, segStart, i)) return true;
    }
    segStart = i + 1;
  }

  return false;
}

/**
 * Single-entry memo for {@link canonicalizePath}.
 *
 * Exists because a request falling through N prefix mounts asks for the
 * canonical form of the *same* path N times, once per mount — the O(mounts)
 * term that made a 10-module app spend most of its dispatch time deciding which
 * mount to enter. Each call also allocated its own result object, so the memo
 * removes an allocation as well as three string scans.
 *
 * Safe to share the result across callers: {@link CanonicalPathResult} declares
 * every field `readonly`, and no caller mutates it (verified across all three
 * call sites — the mount test, the router's own dispatch, and the adapter).
 * Keyed on all three inputs, so two routers with different `caseSensitive` or
 * `strict` options can never read each other's answer. A single entry means
 * interleaved requests simply miss rather than getting a wrong answer.
 *
 * This is a pure-function memo, not shared state: it cannot make
 * `canonicalizePath` return anything other than what recomputing would return.
 */
let memoTarget: string | undefined = undefined;
let memoCaseSensitive = false;
let memoStrict = false;
let memoResult: CanonicalPathResult = { rejected: false, path: '/', valuePath: '/' };

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
 * Callers receive both forms of the path ({@link CanonicalPaths}): `path` for
 * matching and path-policy decisions, `valuePath` for the values a handler is
 * given. A caller that publishes `ctx.path` publishes `path`; a caller that
 * matches supplies both, so the matcher never has to re-derive either.
 *
 * The most recent result is memoized; see the note above the memo fields for
 * why that is sound. Treat the returned object as immutable.
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
  if (rawTarget === memoTarget && caseSensitive === memoCaseSensitive && strict === memoStrict) {
    return memoResult;
  }

  const queryIdx = rawTarget.indexOf('?');
  const path = queryIdx === -1 ? rawTarget : rawTarget.slice(0, queryIdx);

  // One fold decision, at most two structural passes: when `path` is provably
  // case-stable the folded and preserved forms are the same string, so the value
  // path costs nothing — the common all-lowercase request allocates no second
  // path, which is what makes this affordable on every request.
  const caseStable = caseSensitive || isProvablyLowerAscii(path);
  const canonicalPath = caseStable
    ? collapseAndStrip(path, strict)
    : collapseAndStrip(path.toLowerCase(), strict);

  const result: CanonicalPathResult = hasDotSegment(path)
    ? { rejected: true, path, valuePath: path }
    : {
        rejected: false,
        path: canonicalPath,
        valuePath: caseStable ? canonicalPath : collapseAndStrip(path, strict),
      };

  memoTarget = rawTarget;
  memoCaseSensitive = caseSensitive;
  memoStrict = strict;
  memoResult = result;
  return result;
}
