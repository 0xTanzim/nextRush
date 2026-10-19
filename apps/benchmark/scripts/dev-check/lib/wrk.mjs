// wrk invocation and output parsing.
//
// Kept as pure functions so the stage can be tested without a socket: the argv
// shape and the POST script are what decide whether a run measures the intended
// request, and a typo there produces a plausible number for the wrong workload.
// Standalone rather than importing `scripts/lib/tools/wrk.js`: that module owns the
// legacy runner's config and logging, which dev-check deliberately does not depend on.

/** 1024-byte JSON body shared by the POST script and the pre-benchmark probe. */
export const WIRE_POST_BODY = `{"name":"${'x'.repeat(1013)}"}`;

/**
 * @param {{ url: string, threads?: number, connections?: number, duration?: string, script?: string }} options
 * @returns {string[]}
 */
export function wrkArgs({ url, threads = 2, connections = 64, duration = '3s', script }) {
  const args = ['-t', String(threads), '-c', String(connections), '-d', duration];
  if (script) args.push('-s', script);
  args.push(url);
  return args;
}

/** @param {string} stdout */
export function parseWrkRps(stdout) {
  const match = /Requests\/sec:\s+([\d.]+)/.exec(stdout);
  return match ? Number(match[1]) : 0;
}

/**
 * Lua script for `wrk -s`. JSON.stringify emits a Lua-compatible double-quoted
 * string for this payload (ASCII, quotes escaped), so the body cannot drift from
 * `WIRE_POST_BODY`.
 */
export function wrkPostScript(body = WIRE_POST_BODY) {
  return [
    'wrk.method = "POST"',
    `wrk.body = ${JSON.stringify(body)}`,
    'wrk.headers["Content-Type"] = "application/json"',
    '',
  ].join('\n');
}
