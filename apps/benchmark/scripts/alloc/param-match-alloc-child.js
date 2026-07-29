#!/usr/bin/env node

/**
 * Child of param-match-alloc.js — measures GROSS (transient-included) per-match
 * heap allocation for one `Router.match()` variant in an isolated process
 * (OpenSpec: router-param-path-profile-gate, tasks 2.1–2.4 / D1).
 *
 * Why a new child instead of router-match-alloc-child.js: that one measures
 * NET-RETAINED heap with a SMALL young generation, so mid-loop scavenges reclaim
 * the transient garbage (per-node `WalkFrame` objects, the `bindNames`/
 * `bindValues` stacks) and it can never see them. This child enlarges the young
 * generation via `--max-semi-space-size` (set by the parent) so NO scavenge
 * fires during the measured loop — then `heapUsed_after − heapUsed_before` ÷ N
 * is the TOTAL bytes allocated per match, transient included.
 *
 * TWO MODES, because V8 escape analysis is a first-class variable here
 * (design.md Risk 1):
 *   - `retain`  (default) — every result is kept in an array, so the returned
 *     `RouteMatch`/`params` genuinely ESCAPES (as it does in production, where
 *     the adapter reads `ctx.params`). This is the realistic gross figure and
 *     defeats scalar-replacement of the escaping objects. With the young gen
 *     enlarged and no GC, the retained results AND the transient garbage both
 *     stay on the heap uncollected, so the delta counts both.
 *   - `discard` — every result is dropped (only a null-check). This lets V8's
 *     optimizer scalar-replace the whole non-escaping allocation; the resulting
 *     near-zero figure is REPORTED AS EVIDENCE of how escape-analysis-eligible
 *     the param-match allocation is (the cross-check the design mandates).
 *
 * Determinism guard: a `PerformanceObserver` on `gc` counts any GC in the
 * measured window; the parent REJECTS any run with `gcCount > 0` (a scavenge
 * would reclaim transient garbage and under-count). `MEASURE_START`/
 * `MEASURE_END` stderr markers let a `--trace-gc` parent bracket the trace for
 * the task-2.3 calibration.
 *
 * Imports the workspace `@nextrush/router` dist — the REAL built matcher, not a
 * reconstruction escape analysis could trivially elide.
 *
 * Usage (invoked by the parent):
 *   node --expose-gc --max-semi-space-size=<MB> param-match-alloc-child.js <static|depth2|depth8> <N> [retain|discard]
 */

import { PerformanceObserver } from 'node:perf_hooks';

import { createRouter } from '@nextrush/router';

const variant = process.argv[2] ?? 'static';
const N = Number.parseInt(process.argv[3] ?? '200000', 10);
const mode = process.argv[4] ?? 'retain';

const noop = async () => {
  /* no-op handler */
};

// One router: static route, depth-2 param route, depth-8 deep param route, and a
// wildcard — so `hasParamRoutes` is true and the trie is realistic.
const router = createRouter();
router.get('/users/list', noop); // static-hit target (O(1) static map fast-path)
router.get('/users/:id', noop); // depth-2 single-param target
router.get('/api/v1/orgs/:o/teams/:t/members/:m', noop); // depth-8, 3-param target
router.get('/files/*', noop); // wildcard — keep hasParamRoutes true / realistic trie

/** variant → [method, path]. All-lowercase-ASCII paths exercise the HP-12 fold fast-path (the common case). */
const TARGETS = {
  static: ['GET', '/users/list'],
  depth2: ['GET', '/users/42'],
  depth8: ['GET', '/api/v1/orgs/acme/teams/core/members/42'],
};

const [method, path] = TARGETS[variant] ?? TARGETS.static;

function warmup() {
  for (let i = 0; i < 20_000; i++) {
    router.match(method, path);
  }
}

function measure() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('param-match-alloc-child.js must run under `node --expose-gc`');
  }

  let gcCount = 0;
  const obs = new PerformanceObserver((list) => {
    gcCount += list.getEntries().length;
  });
  obs.observe({ entryTypes: ['gc'], buffered: true });

  // In retain mode, allocate the holder array BEFORE the baseline so its own
  // ~8N bytes are not attributed to the matcher.
  const retained = mode === 'retain' ? new Array(N) : null;

  globalThis.gc();
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;

  process.stderr.write('MEASURE_START\n'); // --trace-gc calibration bracket (task 2.3)

  let sink = 0;
  if (mode === 'retain') {
    // Force the result to escape (realistic: `ctx.params` is consumed downstream).
    for (let i = 0; i < N; i++) {
      retained[i] = router.match(method, path);
    }
  } else {
    // Discard: let the optimizer scalar-replace the non-escaping allocation.
    for (let i = 0; i < N; i++) {
      const m = router.match(method, path);
      if (m !== null) sink++;
    }
  }

  const after = process.memoryUsage().heapUsed;
  process.stderr.write('MEASURE_END\n');

  // Touch the retained batch so the JIT cannot dead-code-eliminate it.
  if (retained) {
    for (let i = 0; i < N; i++) {
      if (retained[i]) sink++;
    }
  }

  gcCount += obs.takeRecords().length;
  obs.disconnect();

  const bytesPerOp = (after - before) / N;
  return { variant, mode, N, bytesPerOp, heapDelta: after - before, gcCount, sink };
}

function main() {
  warmup();
  const result = measure();
  process.stdout.write(JSON.stringify(result) + '\n');
}

main();
