#!/usr/bin/env node

/**
 * Allocation micro-benchmark for the Web-adapter context/response microtrims
 * (OpenSpec: web-adapters-context-response-microtrims, task 5.2). Sibling of
 * web-context-alloc.js (HP-1/HP-7); this one isolates the two allocations THIS
 * change removes on a query-less, raw-unread request:
 *
 *  - HP-2-web: `parseQueryString('')` now returns a shared frozen EMPTY_QUERY
 *              instead of a fresh `Object.create(null)` per call. The `trimmed`
 *              path calls the SHIPPED `parseQueryString` (imported from the
 *              built @nextrush/runtime); `legacy` reproduces the old per-call
 *              `Object.create(null)`.
 *  - HP-5-web: the Bun/Deno/Edge context built `{ req, res: undefined }`
 *              eagerly per request; the shipped getter builds it only when
 *              `ctx.raw` is read. On a raw-unread request the `trimmed` path
 *              allocates nothing; `legacy` allocates the wrapper.
 *
 * Method (same allocation-RATE approach + caveats as web-context-alloc-child.js):
 * warm up, force a full GC, snapshot heapUsed, run N ops RETAINING every result
 * so mid-loop GC can't reclaim what we measure, snapshot again, report delta/N.
 * Absolute bytes-per-request of the ISOLATED removed work — NOT a percentage of
 * total request allocation, and no RPS claim (each trim is <1%).
 *
 * Requires a current @nextrush/runtime build:
 *   pnpm --filter @nextrush/runtime build
 *
 * Usage:
 *   node --expose-gc scripts/web-context-microtrims-alloc.js [N]
 */

import { parseQueryString } from '@nextrush/runtime';

const N = Number.parseInt(process.argv[2] ?? '200000', 10);

/** A shared stand-in Request the platform supplies; our code does not allocate it. */
const request = new Request('http://localhost/', { headers: {} });

/** HP-2-web trimmed: the shipped parser returns the shared frozen empty object. */
function hp2Trimmed() {
  return parseQueryString('');
}
/** HP-2-web legacy: the old early-return allocated a fresh null-proto object. */
function hp2Legacy() {
  return Object.create(null);
}

/** HP-5-web trimmed: a raw-unread request builds no wrapper. */
function hp5Trimmed() {
  return null; // ctx.raw never read → getter never runs → no allocation
}
/** HP-5-web legacy: the eager per-request `{ req, res }` wrapper. */
function hp5Legacy() {
  return { req: request, res: undefined };
}

function measure(op) {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('run under `node --expose-gc`');
  }
  // Warm up.
  for (let i = 0; i < 10_000; i++) op();
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;
  const retained = new Array(N);
  for (let i = 0; i < N; i++) retained[i] = op();
  const after = process.memoryUsage().heapUsed;
  // Keep `retained` live past the second snapshot.
  if (retained.length !== N) throw new Error('unreachable');
  return (after - before) / N;
}

function main() {
  const results = {
    timestamp: new Date().toISOString(),
    requestsPerRun: N,
    note: 'Absolute bytes-per-request of the ISOLATED removed work (empty-query object + raw wrapper) on a query-less, raw-unread request. Not a percentage of total request allocation; no RPS claim (<1% each).',
    hp2Web: {
      legacyBytesPerReq: Number(measure(hp2Legacy).toFixed(2)),
      trimmedBytesPerReq: Number(measure(hp2Trimmed).toFixed(2)),
    },
    hp5Web: {
      legacyBytesPerReq: Number(measure(hp5Legacy).toFixed(2)),
      trimmedBytesPerReq: Number(measure(hp5Trimmed).toFixed(2)),
    },
  };
  results.hp2Web.removedBytesPerReq = Number(
    (results.hp2Web.legacyBytesPerReq - results.hp2Web.trimmedBytesPerReq).toFixed(2)
  );
  results.hp5Web.removedBytesPerReq = Number(
    (results.hp5Web.legacyBytesPerReq - results.hp5Web.trimmedBytesPerReq).toFixed(2)
  );
  const pass =
    results.hp2Web.trimmedBytesPerReq < results.hp2Web.legacyBytesPerReq &&
    results.hp5Web.trimmedBytesPerReq < results.hp5Web.legacyBytesPerReq;
  results.verdict = pass
    ? 'PASS — both trims allocate strictly less on the query-less, raw-unread path'
    : 'FAIL — expected a strict allocation reduction';
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  if (!pass) process.exit(1);
}

main();
