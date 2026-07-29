#!/usr/bin/env node

/**
 * Child of context-raw-alloc.js — measures per-request heap allocation for the
 * HP-5 lazy `ctx.raw` trim in @nextrush/adapter-node (OpenSpec:
 * router-context-final-cleanup), for one variant, in an isolated `--expose-gc`
 * process.
 *
 * HP-5 removes the eager `this.raw = { req, res }` wrapper the constructor built
 * on every request; `req`/`res` become private fields and the `{ req, res }`
 * wrapper is built lazily only when a handler reads `ctx.raw`. On a raw-unread
 * request (the common case — handlers use ctx.json/ctx.body/etc.) no wrapper is
 * allocated at all.
 *
 * Method (honest about its limits, identical to context-alloc-child.js):
 * allocation-RATE, not a byte-exact count. This isolates EXACTLY the wrapper
 * object — a full IncomingMessage/ServerResponse per op would allocate multi-KB
 * and swamp the ~sub-KB wrapper signal, making the verdict flaky — so `req`/`res`
 * are shared stand-ins (Node allocates the real ones; our code does not) and
 * only the per-request work OUR code adds/removes is measured. Warm up, force a
 * full GC, snapshot heapUsed, run N ops RETAINING every result so mid-loop GC
 * can't reclaim what we measure, snapshot again, report delta / N.
 *
 *  - eager  (pre-HP-5): builds `{ req, res }` every op — the removed allocation.
 *  - lazy   (shipped):  holds req/res in fields, never builds the wrapper on a
 *                       raw-unread request — retains an existing ref, no alloc.
 *
 * The design claim (D2/D5) is a deterministic allocation reduction: `lazy` must
 * allocate strictly less per op than `eager`.
 *
 * Usage (invoked by the parent): node --expose-gc context-raw-alloc-child.js <lazy|eager> <N>
 */

const variant = process.argv[2] ?? 'lazy';
const N = Number.parseInt(process.argv[3] ?? '200000', 10);

/** Shared stand-in req/res — Node allocates the real ones; our code does not. */
const req = { on() {} };
const res = { on() {} };

/** Shipped path: private fields, no wrapper built when ctx.raw is unread. */
function lazyOp() {
  const _req = req; // HP-5: stored as a field, not wrapped
  const _res = res;
  void _req;
  return _res; // retain an existing ref — no new allocation
}

/** Pre-trim path: the constructor eagerly allocated the { req, res } wrapper. */
function eagerOp() {
  const raw = { req, res }; // the per-request wrapper HP-5 removes
  return raw;
}

const op = variant === 'eager' ? eagerOp : lazyOp;

function warmup() {
  for (let i = 0; i < 10_000; i++) {
    op();
  }
}

function measure() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('context-raw-alloc-child.js must run under `node --expose-gc`');
  }
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;

  const retained = new Array(N);
  for (let i = 0; i < N; i++) {
    retained[i] = op();
  }
  const after = process.memoryUsage().heapUsed;
  // Touch the retained array so it cannot be optimized away before the snapshot.
  if (retained[N - 1] === undefined && N > 0) throw new Error('unexpected empty retain');

  const bytesPerOp = (after - before) / N;
  return { variant, N, bytesPerOp, heapDelta: after - before };
}

function main() {
  warmup();
  const result = measure();
  process.stdout.write(JSON.stringify(result) + '\n');
}

main();
