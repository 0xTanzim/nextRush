#!/usr/bin/env node

/**
 * Child of bun-request-path-alloc.js — measures per-request heap allocation for
 * the two Bun adapter request-path candidates (OpenSpec: reduce-bun-request-
 * path-cost, task 1.4), for one variant, in an isolated `--expose-gc` process.
 *
 * Both candidates remove per-request work from packages/adapters/bun:
 *
 *  - drain accounting (`serve()` → `trackedHandler`): the current path runs
 *    every request through an `async` wrapper with a try/finally counter; the
 *    post-trim path gives the base handler to Bun directly. Removed: one async
 *    frame (a fresh promise) plus the counter mutations.
 *  - client-address resolution (`createBunRequestRunner`): the current path
 *    allocates `() => server.requestIP(request)?.address ?? ''` per request;
 *    the post-trim path holds the platform refs and resolves on first read.
 *    Removed: one closure per request.
 *
 * Method (same as web-context-alloc-child.js): allocation-RATE over N retained
 * ops after a full GC. The surrounding Request/Context work is unchanged and
 * not measured — the reported bytes/op is the ISOLATED removed work, not a
 * whole-request percentage. Shapes are replicated 1:1 from adapter.ts (small
 * stand-ins; the platform supplies the real Request and server, which are
 * shared here). This instrument measures; accept/park is decided by the
 * change's RFC gate, so a delta at zero is a recorded measurement, not a
 * failure.
 *
 * Usage (invoked by the parent):
 *   node --expose-gc bun-request-path-alloc-child.js <wrapped|direct|thunk|refs> <N>
 */

const variant = process.argv[2] ?? 'wrapped';
const N = Number.parseInt(process.argv[3] ?? '200000', 10);

/* ---- drain pair (adapter.ts serve() → trackedHandler) ---- */

let activeRequests = 0;
let drainResolve = null; // never armed here; the branch below stays faithful

/** The shared handler response: the real handler allocates its own, unchanged. */
const HANDLER_RESPONSE = new Response('ok');

/** The base handler the wrapper forwards to (identical in both variants). */
async function baseHandler() {
  return HANDLER_RESPONSE;
}

/** Current path: one async wrapper frame + two counter mutations per request. */
async function wrappedOp() {
  activeRequests++;
  try {
    return await baseHandler();
  } finally {
    activeRequests--;
    if (activeRequests === 0 && drainResolve !== null) drainResolve();
  }
}

/** Post-trim path: Bun receives the base handler directly. */
function directOp() {
  return baseHandler();
}

/* ---- ip pair (adapter.ts createBunRequestRunner → makeContext) ---- */

/** Shared platform stand-ins — the runtime supplies both per request. */
const request = new Request('http://localhost/');
const server = { requestIP: () => ({ address: '203.0.113.7' }) };

/** Current path: the resolver thunk created for every request. */
function thunkOp() {
  return () => server.requestIP(request)?.address ?? '';
}

/** Post-trim path: platform refs held for first-read resolution; no closure. */
function refsOp() {
  return server;
}

const op = { wrapped: wrappedOp, direct: directOp, thunk: thunkOp, refs: refsOp }[variant];
if (typeof op !== 'function') {
  throw new Error(`unknown variant: ${variant}`);
}

async function warmup() {
  for (let i = 0; i < 10_000; i++) {
    await op();
  }
}

async function measure() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('bun-request-path-alloc-child.js must run under `node --expose-gc`');
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
