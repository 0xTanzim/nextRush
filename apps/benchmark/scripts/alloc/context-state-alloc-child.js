#!/usr/bin/env node

/**
 * Child of context-state-alloc.js — measures per-request heap allocation for the
 * NF-2 lazy `ctx.state` trim in @nextrush/adapter-node (OpenSpec:
 * hot-path-dispatch-deasync-and-lazy-state), for one variant, in an isolated
 * `--expose-gc` process.
 *
 * NF-2 removes the eager `state = {}` class-field initializer the constructor
 * ran on every request; `state` becomes a memoized lazy accessor over a private
 * `_state?` backing field. On a state-unread request (the common case —
 * Hello-World / route-params / POST handlers use ctx.json/ctx.body/ctx.params
 * but never touch `state`) no `{}` object is allocated at all.
 *
 * Method (honest about its limits, identical to context-raw-alloc-child.js):
 * allocation-RATE, not a byte-exact count. It isolates EXACTLY the `state`
 * object — a full NodeContext per op would swamp the sub-KB signal — so only the
 * per-request work NF-2 adds/removes is measured. Warm up, force a full GC,
 * snapshot heapUsed, run N ops RETAINING every result so mid-loop GC can't
 * reclaim what we measure, snapshot again, report delta / N.
 *
 *  - eager  (pre-NF-2): allocates `{}` every op — the removed allocation.
 *  - lazy   (shipped):  a state-unread request never builds `{}` — retains an
 *                       existing ref, no allocation.
 *
 * The design claim (D4/D5) is a deterministic allocation reduction: `lazy` must
 * allocate strictly less per op than `eager`.
 *
 * Usage (invoked by the parent): node --expose-gc context-state-alloc-child.js <lazy|eager> <N>
 */

const variant = process.argv[2] ?? 'lazy';
const N = Number.parseInt(process.argv[3] ?? '200000', 10);

/** Shared stand-in backing field — the lazy path retains this, never builds {}. */
const backing = {};

/** Shipped path: state-unread request — no `{}` built, retains an existing ref. */
function lazyOp() {
  let _state; // private `_state?` — undefined on a state-unread request
  void _state;
  return backing; // retain an existing ref — no new allocation
}

/** Pre-trim path: the constructor eagerly allocated `state = {}` every request. */
function eagerOp() {
  const state = {}; // the per-request object NF-2 removes on the unread path
  return state;
}

const op = variant === 'eager' ? eagerOp : lazyOp;

function warmup() {
  for (let i = 0; i < 10_000; i++) {
    op();
  }
}

function measure() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('context-state-alloc-child.js must run under `node --expose-gc`');
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
