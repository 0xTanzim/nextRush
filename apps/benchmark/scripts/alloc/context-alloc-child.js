#!/usr/bin/env node

/**
 * Child of context-alloc.js — measures per-request heap allocation for the three
 * per-request-work trims in @nextrush/adapter-node (OpenSpec:
 * node-adapter-per-request-work-trim, §7.1), for one variant, in an isolated
 * `--expose-gc` process.
 *
 * The trims each REMOVE a per-request allocation while the surrounding
 * NodeContext construction is unchanged — so this bench isolates exactly the
 * removed work (rather than building a full IncomingMessage/ServerResponse per
 * op, whose multi-KB allocation would swamp the ~sub-KB trim signal and make the
 * verdict flaky). What differs between the shipped and pre-trim code is only:
 *
 *  - HP-1: `trustProxy:false` reads the socket address directly — no per-request
 *          header-lookup closure and no `resolveClientIp` call (which itself
 *          allocated an options object per request).
 *  - HP-4: the `{ trustProxy }` context-options object is hoisted and reused —
 *          not allocated per request.
 *  - HP-7: `ctx.next()` forwards the dispatch thunk directly — no extra `async`
 *          frame (an `async` function allocates a fresh promise even when the
 *          thunk is unwired); the trimmed path returns a cached resolved promise.
 *
 * Method (honest about its limits): allocation-RATE, not a byte-exact object
 * count. Warm up, force a full GC, snapshot heapUsed, run N ops RETAINING every
 * result so mid-loop GC can't reclaim what we measure, snapshot again, report
 * delta / N. Same method and caveats as compose-alloc-child.js. The design
 * claim (D5) is a deterministic allocation reduction: `trimmed` must allocate
 * strictly less per op than `legacy`.
 *
 * Usage (invoked by the parent): node --expose-gc context-alloc-child.js <trimmed|legacy> <N>
 */

import { resolveClientIp } from '@nextrush/runtime';

const variant = process.argv[2] ?? 'trimmed';
const N = Number.parseInt(process.argv[3] ?? '200000', 10);

/** HP-4: the shipped adapter builds this once and reuses it across requests. */
const SHARED_OPTS = Object.freeze({ trustProxy: false });
/** HP-7: the shipped ctx.next() returns this cached promise when unwired. */
const RESOLVED_NEXT = Promise.resolve();

/**
 * A stand-in request: Node provides `req`, our code does not allocate it, so it
 * is shared across ops. Only the per-request work OUR code adds is measured.
 */
const req = { socket: { remoteAddress: '203.0.113.7' }, headers: {} };

/** Shipped path: shared options, direct socket IP, direct (cached) next(). */
function trimmedOp() {
  const opts = SHARED_OPTS; // HP-4: reused, no allocation
  const ip = req.socket.remoteAddress ?? ''; // HP-1: no closure, no policy call
  void opts;
  void ip;
  const next = null; // unwired hot path
  return next ? next() : RESOLVED_NEXT; // HP-7: no async frame
}

/** Pre-trim path: reproduces the three removed per-request allocations. */
function legacyOp() {
  const opts = { trustProxy: false }; // HP-4: fresh object per request
  // HP-1: eager header-lookup closure + policy call (which allocs its own options object).
  const directIp = req.socket.remoteAddress ?? '';
  const ip = resolveClientIp(
    (name) => {
      const value = req.headers[name];
      return Array.isArray(value) ? value[0] : value;
    },
    { trustProxy: opts.trustProxy, directIp }
  );
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
    throw new Error('context-alloc-child.js must run under `node --expose-gc`');
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
  return { variant, N, bytesPerOp, heapDelta: after - before };
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
