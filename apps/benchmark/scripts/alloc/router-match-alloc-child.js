#!/usr/bin/env node

/**
 * Child of router-match-alloc.js — measures per-request heap allocation for one
 * `Router.match()` variant in an isolated `--expose-gc` process.
 *
 * Variants map to the match-path allocation sources the
 * `router-match-path-allocation-trim` change removes:
 *   - `static` — a static-route hit (HP-9 `staticKey` string, HP-10 duplicate
 *     result/wrapper object).
 *   - `param`  — a single-param route hit (HP-11 per-segment tuple arrays +
 *     second original-case extraction, HP-13 `Object.keys` array, plus HP-10).
 *
 * Method mirrors compose-alloc-child.js: warm up, force GC, snapshot heapUsed,
 * run N matches while RETAINING every returned match object so the batch is not
 * collected mid-measure, snapshot again, report delta / N as bytes-per-request.
 * This is an allocation-RATE measurement (not a byte-exact object count), run in
 * its own process so JIT/GC warmth never biases another variant.
 *
 * Usage (invoked by the parent): node --expose-gc router-match-alloc-child.js <static|param> <N>
 */

import { createRouter } from '@nextrush/router';

const variant = process.argv[2] ?? 'static';
const N = Number.parseInt(process.argv[3] ?? '200000', 10);

const noop = async () => {
  /* no-op handler */
};

const router = createRouter();
router.get('/users/list', noop); // static hit target
router.get('/users/:id', noop); // param hit target
router.get('/files/*', noop); // keep hasParamRoutes true / realistic trie

const [method, path] = variant === 'param' ? ['GET', '/users/42'] : ['GET', '/users/list'];

function warmup() {
  for (let i = 0; i < 10_000; i++) {
    router.match(method, path);
  }
}

function measure() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('router-match-alloc-child.js must run under `node --expose-gc`');
  }
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;

  // Retain every match result so mid-loop GC cannot reclaim the per-request
  // allocations we are measuring.
  const retained = new Array(N);
  for (let i = 0; i < N; i++) {
    retained[i] = router.match(method, path);
  }
  const after = process.memoryUsage().heapUsed;

  // Touch the batch so the JIT cannot dead-code-eliminate the retained array.
  let live = 0;
  for (let i = 0; i < N; i++) {
    if (retained[i]) live++;
  }

  const bytesPerOp = (after - before) / N;
  return { variant, N, bytesPerOp, heapDelta: after - before, live };
}

function main() {
  warmup();
  const result = measure();
  process.stdout.write(JSON.stringify(result) + '\n');
}

main();
