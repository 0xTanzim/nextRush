import { execFileSync } from 'node:child_process';

/**
 * Confirm a scenario's declared request body was actually received in full,
 * by checking that the server's response reflects the item count the declared
 * body implies — rather than trusting that whatever the load generator sent
 * matched the scenario's declaration. The response-body/framing checks below
 * only prove the RESPONSE is fair; they say nothing about what request the
 * server actually parsed.
 *
 * Scoped to scenarios whose declared body is a JSON object with an `items`
 * array (the shape every POST scenario in this suite uses) and whose response
 * is `{ itemCount: N }`. Any other shape is a no-op — this is not a general
 * request/response schema validator.
 *
 * @param {{ id: string, body?: string }} scenario
 * @param {string} responseBodyText Raw response body text from the server.
 * @returns {string[]} problems, empty when the full declared body was received
 */
export function checkRequestBodyFidelity(scenario, responseBodyText) {
  if (!scenario.body) return [];

  let declared;
  try {
    declared = JSON.parse(scenario.body);
  } catch {
    return [];
  }
  if (!Array.isArray(declared?.items)) return [];

  let response;
  try {
    response = JSON.parse(responseBodyText);
  } catch {
    return [];
  }
  if (typeof response?.itemCount !== 'number') return [];

  const expected = declared.items.length;
  if (response.itemCount !== expected) {
    return [
      `${scenario.id}: response itemCount ${response.itemCount} does not match the declared body's ` +
        `expected ${expected} — the server did not receive the full declared request body`,
    ];
  }
  return [];
}

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

/**
 * Headers whose value is legitimately different on every response and therefore
 * carry no fairness signal. Everything else is compared.
 */
const ALWAYS_DYNAMIC_HEADERS = ['date', 'x-timestamp'];

/**
 * Full response-header-set parity for one scenario.
 *
 * The body/content-type/framing checks prove the RESPONSE PAYLOAD is fair; they
 * say nothing about the rest of the header set, and that blind spot hid two real
 * skews at once: Express emitted an `ETag` — a SHA-1 over the full response body
 * — on every JSON response (measured at -14% RPS versus the same server with it
 * disabled), and Fastify advertised `Keep-Alive: timeout=72` against every other
 * server's `timeout=5`. Both passed every prior check.
 *
 * Deliberately symmetric rather than reference-based, for the same reason as
 * `checkFramingParity`: the odd server out may be the reference itself.
 *
 * @param {Record<string, Record<string, string | undefined>>} headersById
 *   Lower-cased response headers per framework id, for ONE scenario.
 * @param {{ ignore?: string[], strictLength?: boolean }} [options]
 *   `ignore` names headers a scenario is knowingly allowed to diverge on.
 *   `strictLength` false exempts `Content-Length` for a scenario whose
 *   byte-identical work still yields a variable-length body.
 * @returns {string[]} problems, empty when every server agrees
 */
export function checkHeaderSetParity(headersById, { ignore = [], strictLength = true } = {}) {
  const ids = Object.keys(headersById);
  if (ids.length < 2) {
    return [
      'response header set could not be compared (fewer than two servers) — header parity was NOT verified',
    ];
  }

  const ignored = new Set([...ALWAYS_DYNAMIC_HEADERS, ...ignore.map((name) => name.toLowerCase())]);
  if (!strictLength) ignored.add('content-length');

  const namesById = {};
  for (const id of ids) {
    namesById[id] = new Set(
      Object.keys(headersById[id] ?? {})
        .map((name) => name.toLowerCase())
        .filter((name) => !ignored.has(name))
    );
  }
  const union = [...new Set(ids.flatMap((id) => [...namesById[id]]))].sort();

  const problems = [];
  for (const name of union) {
    const withIt = ids.filter((id) => namesById[id].has(name));
    const without = ids.filter((id) => !namesById[id].has(name));

    if (without.length > 0) {
      // Report the minority group — on an exact split, report the servers that
      // ADD the header, since an additive divergence is the actionable one.
      if (withIt.length <= without.length) {
        problems.push(`${withIt.join(', ')}: emits headers no other server emits: ${name}`);
      } else {
        problems.push(`${without.join(', ')}: missing header every other server emits: ${name}`);
      }
      continue;
    }

    const values = new Set(ids.map((id) => headersById[id][name]));
    if (values.size > 1) {
      const detail = ids.map((id) => `${id}="${String(headersById[id][name])}"`).join(', ');
      problems.push(`servers disagree on header "${name}": ${detail}`);
    }
  }

  return problems;
}

/**
 * Read a listening socket's TCP accept-queue depth from the OS.
 *
 * Read back from `ss` rather than trusted from each server's source argument:
 * a framework may ignore, clamp, or silently drop a `backlog` option, and the
 * whole point of this check is to catch the case where the configured value and
 * the effective value disagree.
 *
 * @param {number} port
 * @returns {number | null} the backlog, or null when it could not be determined
 */
export function readListenBacklog(port) {
  try {
    // Send-Q on a LISTEN row is the accept-queue depth.
    const out = execFileSync('ss', ['-tln'], { encoding: 'utf8' });
    for (const line of out.split('\n')) {
      if (!line.includes('LISTEN')) continue;
      const cols = line.trim().split(/\s+/);
      const local = cols[3] ?? '';
      if (local.endsWith(`:${String(port)}`)) {
        const backlog = Number.parseInt(cols[2] ?? '', 10);
        return Number.isFinite(backlog) ? backlog : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fail when the compared servers do not share one accept-queue depth.
 *
 * A deeper queue absorbs connection bursts, so an unequal backlog silently
 * advantages one server at high concurrency while every response-level parity
 * check still passes — this is exactly how a 2x skew went unnoticed
 * (`equalize-benchmark-server-config`). Reported as a failure, not a warning,
 * matching how `checkFramingParity` treats a framing mismatch.
 *
 * @param {Record<string, number | null>} backlogById
 * @returns {string[]} problems, empty when every server agrees
 */
export function checkBacklogParity(backlogById) {
  const entries = Object.entries(backlogById);
  const readable = entries.filter(([, v]) => typeof v === 'number');
  const unreadable = entries.filter(([, v]) => typeof v !== 'number').map(([id]) => id);

  const problems = [];
  if (readable.length < 2) {
    // Cannot compare — surfaced explicitly rather than passing silently.
    problems.push(
      `accept-queue backlog could not be read for ${unreadable.join(', ') || 'any server'} ` +
        '(is `ss` available?) — backlog parity was NOT verified'
    );
    return problems;
  }

  const values = [...new Set(readable.map(([, v]) => v))];
  if (values.length > 1) {
    const detail = readable.map(([id, v]) => `${id}=${String(v)}`).join(', ');
    problems.push(
      `servers disagree on TCP accept-queue backlog (${detail}). A deeper queue ` +
        'advantages that server at high concurrency; set the same LISTEN_BACKLOG everywhere'
    );
  }
  if (unreadable.length > 0) {
    problems.push(`backlog unreadable for: ${unreadable.join(', ')} — not verified for those`);
  }
  return problems;
}
