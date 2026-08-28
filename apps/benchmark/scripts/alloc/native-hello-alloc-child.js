#!/usr/bin/env node

/**
 * Child of native-hello-alloc.js — measures REAL per-request heap allocation
 * for the native NextRush hello-world path (`createApp` + one `ctx.json`
 * handler served through `@nextrush/adapter-node` `createHandler`), in an
 * isolated `--expose-gc` process. RFC-035 §8.10 / task 9.3: this is the
 * unused-path hard-gate harness — the bridge is deliberately NOT imported, so
 * the native hello path's measured bytes-per-request must never move; a delta
 * against the pinned baseline fails `check-alloc-regression --tolerance 0`.
 *
 * Method (identical to handler-alloc-child.js, restated here): a full
 * `IncomingMessage`/`ServerResponse` per op would allocate multi-KB from
 * Node's own HTTP internals and swamp the sub-KB signal this harness targets,
 * so minimal stand-in `req`/`res` objects are used instead. The stand-ins
 * cover exactly what a hello-world-shaped GET request exercises through
 * `createNodeContext`'s constructor and `ctx.json()`'s write path — verified
 * against `context.ts`. A future context.ts change that reads a new req/res
 * property on this path would need the stand-in extended, and would fail
 * loudly (a `TypeError`, not a silently wrong number).
 *
 * It drains one microtask turn after every request (`await null`) so each
 * request's handler timer settles before the next one is created — without
 * this, N live timers pile up (an artificial spike no real workload produces).
 *
 * Usage (invoked by the parent):
 *   node --expose-gc native-hello-alloc-child.js native-hello <N>
 */

import { PerformanceObserver } from 'node:perf_hooks';

import { createApp } from '@nextrush/core';
import { createHandler } from '@nextrush/adapter-node';

const variant = process.argv[2] ?? 'native-hello';
const N = Number.parseInt(process.argv[3] ?? '50000', 10);

/** Minimal stand-in for `IncomingMessage`/`ServerResponse` — see module doc. */
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

// Native hello-world: no express-bridge import anywhere on this path.
const app = createApp();
app.use((ctx) => {
  ctx.json({ message: 'Hello, World!' });
});

const handler = createHandler(app);

async function warmup() {
  for (let i = 0; i < 50_000; i++) {
    const { req, res } = makeReqRes();
    handler(req, res);
    await null; // drain — see measure()'s doc comment for why this matters
  }
}

async function measure() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('native-hello-alloc-child.js must run under `node --expose-gc`');
  }

  let gcCount = 0;
  const obs = new PerformanceObserver((list) => {
    gcCount += list.getEntries().length;
  });
  obs.observe({ entryTypes: ['gc'], buffered: false });

  globalThis.gc();
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;

  process.stderr.write('MEASURE_START\n'); // --trace-gc calibration bracket

  const retained = new Array(N);
  for (let i = 0; i < N; i++) {
    retained[i] = makeReqRes();
    handler(retained[i].req, retained[i].res);
    await null; // drain one microtask turn — settles this request's timer
  }

  const after = process.memoryUsage().heapUsed;
  process.stderr.write('MEASURE_END\n');

  // Touch the retained batch so the JIT cannot dead-code-eliminate it.
  let kept = 0;
  for (let i = 0; i < N; i++) kept += retained[i].req.method === 'GET' ? 1 : 0;
  void kept;

  obs.disconnect();
  const bytesPerOp = (after - before) / N;
  return { variant, N, bytesPerOp, heapDelta: after - before, gcCount };
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