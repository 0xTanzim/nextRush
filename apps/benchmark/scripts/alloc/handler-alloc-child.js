#!/usr/bin/env node

/**
 * Child of handler-alloc.js — measures GROSS per-request heap allocation for
 * `@nextrush/adapter-node`'s `createHandler` closure, in an isolated
 * `--expose-gc` process (reconciliation report F-01/F-13: `createHandler` had
 * no deterministic allocation harness, which is the specific coverage gap
 * that let the `d97734e3` regression land undetected).
 *
 * Method (identical tradeoff to context-raw-alloc-child.js, restated here):
 * a full `IncomingMessage`/`ServerResponse` per op would allocate multi-KB
 * from Node's own HTTP internals and swamp the sub-KB signal this harness
 * targets, so minimal stand-in `req`/`res` objects are used instead — Node
 * allocates the real ones in production; this measures only the additional
 * work `createHandler`'s own closure does per request. The stand-ins cover
 * exactly what a `hello-world`-shaped GET request exercises through
 * `createNodeContext`'s constructor (`method`, `url`, `headers`,
 * `socket.remoteAddress`) and `ctx.json()`'s write path (`headersSent`,
 * `writeHead`, `end`) — verified against `context.ts` at the commit this
 * harness was written against; a future context.ts change that reads a new
 * req/res property on this path would need the stand-in extended, and would
 * fail loudly (a `TypeError`, not a silently wrong number) since the missing
 * property would be `undefined` where a real value is expected.
 *
 * Two variants, matching `createHandler`'s two branches:
 *   - `enabled`  — `timeout > 0`, the handler-vs-timeout `Promise.race` path
 *                  (the branch `TIMEOUT_SENTINEL` lives in).
 *   - `disabled` — `timeout <= 0`, the pre-F-04 direct-await path with no
 *                  race at all — the harness's own cross-check that the
 *                  disabled path's allocation is unaffected by anything done
 *                  to the enabled path.
 *
 * Imports the workspace `@nextrush/adapter-node` and `@nextrush/core` dist —
 * the REAL built `createHandler`, not a reconstruction.
 *
 * Usage (invoked by the parent):
 *   node --expose-gc handler-alloc-child.js <enabled|disabled> <N>
 */

import { PerformanceObserver } from 'node:perf_hooks';

import { createApp } from '@nextrush/core';
import { createHandler } from '@nextrush/adapter-node';

const variant = process.argv[2] ?? 'enabled';
const N = Number.parseInt(process.argv[3] ?? '200000', 10);

/**
 * Minimal stand-in for `IncomingMessage`/`ServerResponse` covering exactly
 * what a bodyless GET request exercises through `createNodeContext` and
 * `ctx.json()` — see the module doc comment for the exact property list and
 * the fail-loudly guarantee if this drifts from `context.ts`.
 */
function makeReqRes() {
  const req = {
    method: 'GET',
    url: '/',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = {
    headersSent: false,
    writeHead() {
      res.headersSent = true;
      return res;
    },
    end() {
      res.headersSent = false; // reset so the stand-in is reusable across ops
    },
  };
  return { req, res };
}

const app = createApp();
app.use((ctx) => {
  ctx.json({ message: 'Hello, World!' });
});

const handler = createHandler(app, { timeout: variant === 'enabled' ? 50_000 : 0 });

async function warmup() {
  for (let i = 0; i < 50_000; i++) {
    const { req, res } = makeReqRes();
    handler(req, res);
    await null; // drain — see measure()'s doc comment for why this matters
  }
}

async function measure() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('handler-alloc-child.js must run under `node --expose-gc`');
  }

  let gcCount = 0;
  const obs = new PerformanceObserver((list) => {
    gcCount += list.getEntries().length;
  });
  // `buffered: false` — only live events from this point on are counted;
  // buffered replay would otherwise attribute warmup-phase GC (which runs
  // before this observer exists) to the measured window.
  obs.observe({ entryTypes: ['gc'], buffered: false });

  globalThis.gc();
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;

  process.stderr.write('MEASURE_START\n'); // --trace-gc calibration bracket

  // Retain every stand-in pair so its result genuinely escapes (realistic:
  // the request/response pair is referenced until the response completes).
  // The `enabled` variant registers a real `setTimeout` per request inside
  // `createHandler`; its own `Promise.race(...).then(...)` clears that timer
  // once the (synchronously-resolving) handler settles. Draining microtasks
  // after every op — not once at the very end — lets each request's timer
  // clear before the next one is created, matching how live traffic actually
  // behaves (thousands of timers never coexist at once). Without this, N
  // timers pile up simultaneously for the whole loop's duration, an
  // artificial spike no real workload produces, which pressures the heap
  // independently of `--max-semi-space-size` and contaminates the window.
  const retained = new Array(N);
  for (let i = 0; i < N; i++) {
    retained[i] = makeReqRes();
    handler(retained[i].req, retained[i].res);
    await null; // drain one microtask turn — settles this request's race
  }

  const after = process.memoryUsage().heapUsed;
  process.stderr.write('MEASURE_END\n');

  // Touch the retained batch so the JIT cannot dead-code-eliminate it.
  let sink = 0;
  for (let i = 0; i < N; i++) {
    if (retained[i].res.headersSent === false) sink++;
  }

  gcCount += obs.takeRecords().length;
  obs.disconnect();

  const bytesPerOp = (after - before) / N;
  return { variant, N, bytesPerOp, heapDelta: after - before, gcCount, sink };
}

async function main() {
  await warmup();
  const result = await measure();
  process.stdout.write(JSON.stringify(result) + '\n');
}

main();
