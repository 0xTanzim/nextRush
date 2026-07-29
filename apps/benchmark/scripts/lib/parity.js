/**
 * Response-framing parity check — every server must send `Content-Length`
 * identically for identical-work scenarios, so no server pays a chunked-
 * transfer-encoding tax the others don't (reconciliation report F-03: the
 * raw-node baseline previously omitted it, inflating every "vs raw Node"
 * comparison). Deliberately symmetric rather than reference-based: the bug
 * this exists to catch is the reference server itself being the odd one out.
 */

/**
 * Compare every server's response-framing headers for one scenario.
 * @param {Record<string, Record<string, string | undefined>>} headersById
 *   Lower-cased response headers per framework id for one scenario.
 * @param {{ skip?: boolean, strictLength?: boolean }} [options]
 *   `skip` exempts scenarios with no body to frame (e.g. 204 No Content).
 *   `strictLength` (default true) requires an identical Content-Length value
 *   across servers. Set false for a scenario whose byte-identical WORK still
 *   produces a variable-length body (e.g. a randomized id echoed back) — the
 *   framing MECHANISM (fixed-length vs. chunked) is still checked either way.
 * @returns {string[]} Human-readable framing problems, empty when consistent.
 */
export function checkFramingParity(headersById, { skip = false, strictLength = true } = {}) {
  if (skip) return [];

  const ids = Object.keys(headersById);
  const anyContentLength = ids.some((id) => headersById[id]['content-length'] !== undefined);
  if (!anyContentLength) return [];

  const expectedLength = strictLength
    ? ids.map((id) => headersById[id]['content-length']).find((length) => length !== undefined)
    : undefined;

  const problems = [];
  for (const id of ids) {
    const headers = headersById[id];
    const length = headers['content-length'];
    const transferEncoding = headers['transfer-encoding'];

    if (transferEncoding === 'chunked') {
      problems.push(`${id}: responds with Transfer-Encoding: chunked while other servers set Content-Length`);
      continue;
    }

    if (length === undefined) {
      problems.push(`${id}: missing Content-Length header while other servers set one`);
      continue;
    }

    if (strictLength && length !== expectedLength) {
      problems.push(`${id}: Content-Length ${length} (expected ${expectedLength}, matching other servers)`);
    }
  }

  return problems;
}
