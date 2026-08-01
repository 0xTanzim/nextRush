#!/usr/bin/env node

/**
 * Child of web-context-alloc.js — measures per-request heap allocation for the
 * two per-request-work trims in the Web adapters (@nextrush/adapter-bun,
 * -deno, -edge; OpenSpec: web-adapters-per-request-work-trim), for one adapter
 * and one variant, in an isolated `--expose-gc` process.
 *
 * The trims each REMOVE a per-request allocation while the surrounding Context
 * construction is unchanged — so this bench isolates exactly the removed work
 * (rather than building a full Request + Context per op, whose multi-KB
 * allocation would swamp the sub-KB trim signal and make the verdict flaky).
 * What differs between the shipped and pre-trim code, when `trustProxy` is
 * false (the default), is only:
 *
 *  - HP-1: the adapter reads the platform direct address directly — no
 *          per-request header-lookup closure (`webHeaderLookup`) and no
 *          `getClientIp`/`getEdgeClientIp` policy call (which itself allocates
 *          an options object per request).
 *            · bun  → `clientIp ?? ''`   (legacy called getClientIp when absent)
 *            · deno → `directIp`         (legacy always called getClientIp)
 *            · edge → `''`               (legacy always called getEdgeClientIp)
 *  - HP-7: `ctx.next()` forwards the dispatch thunk directly — no extra `async`
 *          frame (an `async` function allocates a fresh promise even when the
 *          thunk is unwired); the trimmed path returns a cached resolved promise.
 *
 * Method (honest about its limits): allocation-RATE, not a byte-exact object
 * count. Warm up, force a full GC, snapshot heapUsed, run N ops RETAINING every
 * result so mid-loop GC can't reclaim what we measure, snapshot again, report
 * delta / N. Same method and caveats as the Node context-alloc-child.js. The
 * design claim (D7) is a deterministic allocation reduction: `trimmed` must
 * allocate strictly less per op than `legacy`, per adapter.
 *
 * Usage (invoked by the parent):
 *   node --expose-gc web-context-alloc-child.js <bun|deno|edge> <trimmed|legacy> <N>
 */

import { getClientIp, getEdgeClientIp } from '@nextrush/runtime';

const adapter = process.argv[2] ?? 'bun';
const variant = process.argv[3] ?? 'trimmed';
const N = Number.parseInt(process.argv[4] ?? '200000', 10);

/** HP-7: the shipped ctx.next() returns this cached promise when unwired. */
const RESOLVED_NEXT = Promise.resolve();

/**
 * A shared stand-in Request: the platform provides it, our code does not
 * allocate it, so it is reused across ops. Only the per-request work OUR code
 * adds (the IP-lookup closure + policy call, the async next() frame) is measured.
 */
const request = new Request('http://localhost/', { headers: {} });
/** The direct/socket address the platform supplies (bun clientIp / deno hostname). */
const DIRECT_IP = '203.0.113.7';

/** Shipped path: direct IP value (no closure/policy), direct (cached) next(). */
function trimmedOp() {
  // HP-1: trustProxy false → platform address directly, no closure, no policy.
  let ip;
  if (adapter === 'bun') ip = DIRECT_IP; // `clientIp ?? ''` — present case, no call
  else if (adapter === 'deno') ip = DIRECT_IP; // `directIp`
  else ip = ''; // edge has no socket
  void ip;
  const next = null; // unwired hot path
  return next ? next() : RESOLVED_NEXT; // HP-7: no async frame
}

/** Pre-trim path: reproduces the eager IP-lookup closure + policy + async frame. */
function legacyOp() {
  // HP-1: eager header-lookup closure + policy call, even when trustProxy false.
  let ip;
  if (adapter === 'edge') {
    ip = getEdgeClientIp(request, false);
  } else {
    // bun's legacy `clientIp-absent` branch and deno's always-call branch both
    // funnel through getClientIp(request, directIp, false).
    ip = getClientIp(request, adapter === 'deno' ? DIRECT_IP : '', false);
  }
  void ip;
  const next = null; // unwired hot path
  // HP-7: extra async frame — an async function allocates a promise even when
  // the wrapped thunk is unwired.
  const asyncNext = async () => {
    if (next) await next();
  };
  return asyncNext();
}

const op = variant === 'legacy' ? legacyOp : trimmedOp;

async function warmup() {
  for (let i = 0; i < 10_000; i++) {
    await op();
  }
}

async function measure() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('web-context-alloc-child.js must run under `node --expose-gc`');
  }
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;

  const retained = new Array(N);
  for (let i = 0; i < N; i++) {
    retained[i] = op();
  }
  const after = process.memoryUsage().heapUsed;
  await Promise.all(retained);

  const bytesPerOp = (after - before) / N;
  return { adapter, variant, N, bytesPerOp, heapDelta: after - before };
}

async function main() {
  await warmup();
  const result = await measure();
  process.stdout.write(JSON.stringify(result) + '\n');
}

main().catch((err) => {
  process.stderr.write(String(err?.stack ?? err) + '\n');
  process.exit(1);
});
