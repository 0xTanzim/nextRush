#!/usr/bin/env node

/**
 * Child of the Web-runner allocation check — bytes per request for the shared
 * runner's timeout decision, measured in an isolated `--expose-gc` process.
 *
 * The `@nextrush/runtime` runner had no allocation harness at all: the family
 * covered the Node adapter's `createHandler` and the Web contexts, but not the
 * wrapper every Web adapter entry point shares. That gap is why the settle
 * wrapper's cost was only ever visible as a timing delta.
 *
 * Method (the same contract as the other `*-alloc-child.js` scripts): warm up,
 * force a full GC, snapshot `heapUsed`, run N dispatches, snapshot again, report
 * the delta over N. A run in which GC fired inside the measured window is
 * rejected, because a scavenge would hide part of the signal. The provider of the
 * final response is a single cached `Response`: `ctx.getResponse()` is not what
 * this script measures, and constructing one per request would swamp the
 * sub-KB runner overhead this harness exists to isolate.
 *
 * Two variants, matching the runner's two timeout branches:
 *   - `armed`    — `timeout > 0`; the request is a candidate for a timer.
 *   - `disabled` — `timeout < 0` is not a thing, so `0` (the control the runner
 *                  also exposes to callers).
 *
 * Usage:
 *   node --expose-gc --max-semi-space-size=256 web-runner-alloc-child.js <armed|disabled> <N>
 */

import { PerformanceObserver } from 'node:perf_hooks';
import { createWebRunner } from '@nextrush/runtime';

const variant = process.argv[2] ?? 'armed';
const N = Number.parseInt(process.argv[3] ?? '200000', 10);

const RESPONSE = new Response('{"ok":true}', {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

/** The provider of the response: `getResponse()` is reused, never rebuilt. */
class StubContext {
  method = 'GET';
  path = '/';
  status = 200;
  responded = false;
  triggerTimeout() {
    /* no timer is armed on the settled path, so this is never reached */
  }
  json() {
    this.responded = true;
  }
  getResponse() {
    return RESPONSE;
  }
}

const makeContext = () => new StubContext();

/** A structural application: only what the runner reads, and it settles at once. */
const app = {
  isReady: true,
  isProduction: true,
  logger: { error() {}, warn() {}, info() {}, debug() {} },
  ready: () => Promise.resolve(),
  start() {},
  callback: () => (ctx) => {
    ctx.json({ ok: true });
    return Promise.resolve();
  },
};

const run = createWebRunner(app, {
  label: 'alloc',
  timeout: variant === 'armed' ? 30_000 : 0,
  makeContext,
});

const REQUEST = new Request('http://localhost/');

let gcCount = 0;
const observer = new PerformanceObserver((list) => {
  gcCount += list.getEntries().length;
});
observer.observe({ entryTypes: ['gc'], buffered: false });

async function warmup() {
  for (let i = 0; i < 10_000; i++) await run(REQUEST, undefined);
}

async function measure() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('web-runner-alloc-child.js must run under `node --expose-gc`');
  }
  globalThis.gc();
  globalThis.gc();

  const before = process.memoryUsage().heapUsed;
  const retained = new Array(N);
  for (let i = 0; i < N; i++) {
    // Retain every response so a mid-loop scavenge cannot reclaim work the
    // snapshot is meant to count, and so the loop cannot be optimised away.
    retained[i] = await run(REQUEST, undefined);
  }
  const after = process.memoryUsage().heapUsed;
  if (retained[N - 1] === undefined && N > 0) throw new Error('unexpected empty retain');

  gcCount += observer.takeRecords().length;
  observer.disconnect();
  return { variant, N, bytesPerOp: (after - before) / N, heapDelta: after - before, gcCount };
}

async function main() {
  await warmup();
  const result = await measure();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

void main();
