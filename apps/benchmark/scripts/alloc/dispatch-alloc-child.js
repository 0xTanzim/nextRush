#!/usr/bin/env node

/**
 * Child of dispatch-alloc.js — measures per-request heap allocation for the
 * NF-1 router dispatch de-async in @nextrush/router (OpenSpec:
 * hot-path-dispatch-deasync-and-lazy-state), for one variant, in an isolated
 * `--expose-gc` process.
 *
 * NF-1 removes the TWO `async` frames the matched no-middleware dispatch path
 * used to cross: `createRoutesMiddleware` (`async`, awaited the executor) and
 * the `len === 0` compiled executor (`async`, awaited a SYNCHRONOUS handler).
 * Each `async` invocation allocates a promise + a state machine; the flattened
 * path forwards `Promise.resolve(handler(...))` directly, so a matched request
 * to a synchronous handler allocates materially fewer promise objects.
 *
 * Method (honest about its limits, identical to context-raw-alloc-child.js):
 * allocation-RATE, not a byte-exact count. It isolates EXACTLY the two dispatch
 * mechanisms in the shape the router uses them — a full Router.match + trie walk
 * per op would swamp the promise-frame signal — so `match`/params/context are
 * shared stand-ins and only the per-request work the de-async adds/removes is
 * measured. Warm up, force a full GC, snapshot heapUsed, invoke the dispatch
 * mechanism N times RETAINING every returned promise so mid-loop GC cannot
 * reclaim what we measure, snapshot again, report delta / N.
 *
 *  - async  (pre-NF-1): `async routes → await async executor → await handler` —
 *                       two async state machines + promises per matched request.
 *  - flat   (shipped):  `routes(ctx) → executor(ctx) → Promise.resolve(handler)` —
 *                       one resolved promise, no async state machines.
 *
 * The design claim (D1/D2/D5) is a deterministic allocation reduction: `flat`
 * must allocate strictly less per op than `async`.
 *
 * Usage (invoked by the parent): node --expose-gc dispatch-alloc-child.js <flat|async> <N>
 */

const variant = process.argv[2] ?? 'flat';
const N = Number.parseInt(process.argv[3] ?? '200000', 10);

/** Shared resolved promise + no-op next, mirroring the router's sentinels. */
const RESOLVED = Promise.resolve();
const NOOP_NEXT = () => RESOLVED;

/** Shared stand-in context — the dispatch mechanism is what we measure, not ctx. */
const ctx = { n: 0, setNext(fn) { this._next = fn; } };

/** Synchronous handler (the Hello-World shape: `ctx => ctx.json(...)` returns void). */
function handler(c) {
  c.n++;
}

/**
 * Pre-NF-1: two async frames — createRoutesMiddleware awaited an async executor
 * which awaited the synchronous handler. Each call allocates two async state
 * machines and their promises.
 */
const asyncExecutor = async (c) => {
  if (c.setNext) c.setNext(NOOP_NEXT);
  await handler(c, NOOP_NEXT);
};
const asyncRoutes = async (c) => {
  await asyncExecutor(c);
};

/**
 * Shipped: flattened promise forwarding — the executor returns
 * `Promise.resolve(handler(...))` and createRoutesMiddleware returns it directly.
 */
const flatExecutor = (c) => {
  if (c.setNext) c.setNext(NOOP_NEXT);
  try {
    return Promise.resolve(handler(c, NOOP_NEXT));
  } catch (err) {
    return Promise.reject(err instanceof Error ? err : new Error(String(err)));
  }
};
const flatRoutes = (c) => flatExecutor(c);

const dispatch = variant === 'async' ? asyncRoutes : flatRoutes;

function warmup() {
  const retained = [];
  for (let i = 0; i < 10_000; i++) {
    retained.push(dispatch(ctx));
  }
  // Settle warmup promises so their microtasks drain before measuring.
  return Promise.allSettled(retained);
}

function measure() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('dispatch-alloc-child.js must run under `node --expose-gc`');
  }
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;

  const retained = new Array(N);
  for (let i = 0; i < N; i++) {
    // Retain the returned promise so the per-request async frames/promises
    // cannot be reclaimed before the snapshot — that allocation is the signal.
    retained[i] = dispatch(ctx);
  }
  const after = process.memoryUsage().heapUsed;
  if (retained[N - 1] === undefined && N > 0) throw new Error('unexpected empty retain');

  const bytesPerOp = (after - before) / N;
  return { variant, N, bytesPerOp, heapDelta: after - before };
}

async function main() {
  await warmup();
  const result = measure();
  process.stdout.write(JSON.stringify(result) + '\n');
}

void main();
