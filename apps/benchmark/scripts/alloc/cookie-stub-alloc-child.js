#!/usr/bin/env node

/**
 * Child of cookie-stub-alloc.js — measures per-request heap allocation for the
 * RFC-034 shared uninitialized cookie stub (OpenSpec: ctx-cookies-capability),
 * for one variant, in an isolated `--expose-gc` process.
 *
 * The design claim (RFC-034 §30): the uninitialized `ctx.cookies` slot is a
 * process-shared frozen singleton, so a request that never activates cookies
 * allocates NO per-request cookie object — the `stub` variant retains the
 * shared ref. The `store` variant models the pre-change equivalent of building
 * a cookie store object per request (the activated-path cost, unchanged).
 *
 * Method (identical to context-state-alloc-child.js): allocation-RATE, not a
 * byte-exact count. Warm up, force a full GC, snapshot heapUsed, run N ops
 * RETAINING every result, snapshot again, report delta / N.
 *
 * Usage (invoked by the parent): node --expose-gc cookie-stub-alloc-child.js <stub|store> <N>
 */

const variant = process.argv[2] ?? 'stub';
const N = Number.parseInt(process.argv[3] ?? '200000', 10);

/** The shared uninitialized stub (mirrors UNINITIALIZED_COOKIES' shape). */
const sharedStub = Object.freeze({
  get: () => undefined,
  set: () => undefined,
  delete: () => undefined,
  all: () => ({}),
  has: () => false,
  signed: Object.freeze({}),
});

/** Shipped path: a non-cookie request retains the shared stub — no allocation. */
function stubOp() {
  return sharedStub;
}

/** Activated path (unchanged cost): one per-request cookie store object. */
function storeOp() {
  const store = {
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
    all: () => ({}),
    has: () => false,
    signed: sharedStub.signed,
  };
  return store;
}

const op = variant === 'store' ? storeOp : stubOp;

function warmup() {
  for (let i = 0; i < 10_000; i++) {
    op();
  }
}

function measure() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('cookie-stub-alloc-child.js must run under `node --expose-gc`');
  }
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;

  const retained = new Array(N);
  for (let i = 0; i < N; i++) {
    retained[i] = op();
  }
  const after = process.memoryUsage().heapUsed;
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
