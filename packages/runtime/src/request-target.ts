/**
 * @nextrush/runtime - Request Target Derivation
 *
 * A context needs three things out of `request.url`: the path, the query string,
 * and the two concatenated. `new URL()` answers all three — and also *reshapes*
 * the path, because WHATWG parsing resolves `.`/`..` segments including every
 * percent-encoded spelling of one (`%2e`, `.%2e`, `%2e%2e`). Whether a front
 * proxy already did the same before forwarding is exactly what the router's
 * dot-segment rejection exists to detect, and a segment resolved here can never
 * be rejected there.
 *
 * So the derivation is a scan of the target string. For an ordinary target it
 * agrees with `URL` character for character; for a target carrying a dot segment
 * it returns the bytes the client wrote; for a byte `URL` would have
 * percent-encoded it returns that byte, because the target is reported as the
 * platform delivered it rather than reshaped on the way through. It also removes
 * the single largest allocation a Web request used to make before its handler ran.
 *
 * @packageDocumentation
 */

/**
 * The path and query string of a request target, as they arrived.
 */
export interface RequestTarget {
  /**
   * Path portion, including a trailing slash and any dot segment; `/` when the
   * target carries no path at all.
   */
  readonly path: string;
  /** Query string including its leading `?`, or `''` when the target has none. */
  readonly search: string;
}

const SCHEME_SEPARATOR = '://';
const SLASH = 0x2f; // '/'
const QUERY_MARK = 0x3f; // '?'
const FRAGMENT_MARK = 0x23; // '#'

/**
 * Derive the path and query string of a request URL without constructing `URL`.
 *
 * @remarks
 * The scan is linear and allocation-free apart from the two returned slices:
 *
 *   - Everything up to `://` is the scheme; without one, the target starts at the
 *     first character (a relative-form target).
 *   - The authority ends at the first `/`, `?` or `#`. A target with no `/` has
 *     the path `/`, which is what `URL` reports for the same input.
 *   - The path ends at the first `?` or `#`; a fragment is never part of the path
 *     or the search, so `#frag` in the middle of a query is dropped the way
 *     `URL.search` drops it.
 *
 * No percent-decoding happens here, and no dot segment is resolved: those bytes
 * are the request's own, and the router is the layer that decides what they mean.
 * Bytes that `URL.pathname`/`URL.search` would re-encode are likewise published
 * as they arrived — the derivation reports the target the platform delivered, it
 * does not reshape it.
 *
 * @param url - The request URL (the `Request.url` string, or a raw target).
 * @returns The path and query string as the client wrote them.
 */
export function requestTargetFromUrl(url: string): RequestTarget {
  const length = url.length;
  const schemeEnd = url.indexOf(SCHEME_SEPARATOR);
  const scanFrom = schemeEnd === -1 ? 0 : schemeEnd + SCHEME_SEPARATOR.length;

  let pathStart = -1;
  let authorityMark = -1;
  for (let i = scanFrom; i < length; i++) {
    const code = url.charCodeAt(i);
    if (code === SLASH) {
      pathStart = i;
      break;
    }
    if (code === QUERY_MARK || code === FRAGMENT_MARK) {
      authorityMark = i;
      break;
    }
  }

  if (pathStart === -1) {
    const hasQuery = authorityMark !== -1 && url.charCodeAt(authorityMark) === QUERY_MARK;
    return { path: '/', search: hasQuery ? url.slice(authorityMark) : '' };
  }

  let pathEnd = length;
  let queryMark = -1;
  for (let i = pathStart; i < length; i++) {
    const code = url.charCodeAt(i);
    if (code === QUERY_MARK) {
      pathEnd = i;
      queryMark = i;
      break;
    }
    if (code === FRAGMENT_MARK) {
      pathEnd = i;
      break;
    }
  }

  if (queryMark === -1) return { path: url.slice(pathStart, pathEnd), search: '' };

  const fragmentMark = url.indexOf('#', queryMark);
  const queryEnd = fragmentMark === -1 ? length : fragmentMark;
  return { path: url.slice(pathStart, pathEnd), search: url.slice(queryMark, queryEnd) };
}
