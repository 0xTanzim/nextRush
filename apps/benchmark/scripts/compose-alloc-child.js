#!/usr/bin/env node

/**
 * Child of compose-alloc.js — measures per-invocation heap allocation for a
 * single `compose()` variant in an isolated process with `--expose-gc`.
 *
 * Method (honest about its limits): warm up the composed function, force a full
 * GC, snapshot `heapUsed`, then run N invocations while RETAINING every returned
 * promise in an array (so the batch's allocations are not collected mid-measure),
 * snapshot `heapUsed` again, and report the delta / N as bytes-per-invocation.
 * This is an allocation-RATE measurement, not a byte-exact closure count — but it
 * robustly reflects the design claim (D7): the `len === 1` fast path does not
 * allocate the recursive `dispatch` function closure the general (`len >= 2`)
 * path builds per request, so its per-invocation allocation must be strictly
 * lower. Run in its own process so one variant's JIT/GC warmth never biases the
 * next, matching the rest of this harness.
 *
 * Usage (invoked by the parent): node --expose-gc compose-alloc-child.js <single|general> <N>
 */

import { compose } from '@nextrush/core';

const variant = process.argv[2] ?? 'single';
const N = Number.parseInt(process.argv[3] ?? '200000', 10);

/** A no-op middleware that calls next() exactly once (the common shape). */
const passthrough = async (_ctx, next) => {
  await next();
};

/**
 * A genuinely SYNCHRONOUS middleware: returns `undefined`, never awaits, never
 * calls next(). This is the only shape that can observe the shared-resolved-
 * promise elision (elide-resolved-promise-allocation / F-09) — an `async`
 * middleware already returns a promise, and `Promise.resolve(p) === p`, so the
 * `single`/`general` variants above are expected to be FLAT for that change.
 */
const passthroughSync = (ctx) => {
  ctx.state.n = (ctx.state.n ?? 0) + 1;
};

// single → len === 1 fast path; general → len === 2 general dispatch path;
// sync → len === 1 fast path with a synchronous (undefined-returning) middleware.
const stack =
  variant === 'single'
    ? [passthrough]
    : variant === 'sync'
      ? [passthroughSync]
      : [passthrough, passthrough];
const composed = compose(stack);

/** Minimal context whose setNext/next mirror the real Context surface. */
function makeCtx() {
  let stored = () => Promise.resolve();
  return {
    responded: false,
    state: {},
    setNext(fn) {
      stored = fn;
    },
    next() {
      return stored();
    },
  };
}

const tail = () => Promise.resolve();

async function warmup() {
  for (let i = 0; i < 10_000; i++) {
    await composed(makeCtx(), tail);
  }
}

async function measure() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('compose-alloc-child.js must run under `node --expose-gc`');
  }
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;

  // Retain the batch so mid-loop GC cannot reclaim the allocations we are
  // trying to measure. Kick off synchronously (this is where the per-call
  // closures + promise chain are allocated), then drain.
  const retained = new Array(N);
  for (let i = 0; i < N; i++) {
    retained[i] = composed(makeCtx(), tail);
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
