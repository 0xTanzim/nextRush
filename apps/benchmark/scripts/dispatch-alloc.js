#!/usr/bin/env node

/**
 * Allocation micro-benchmark for the NF-1 router dispatch de-async
 * (OpenSpec: hot-path-dispatch-deasync-and-lazy-state, task 7.1 / design D1·D2·D5).
 *
 * Proves the decision gate: the flattened (shipped) matched no-middleware
 * dispatch path allocates measurably less per request than the pre-change
 * two-`async`-frame path, because NF-1 removes the `createRoutesMiddleware` and
 * `len === 0` executor `async` state machines (each an allocated promise + state
 * machine) in favor of direct `Promise.resolve(handler(...))` forwarding. Runs
 * each variant in its own `--expose-gc` child process for `--runs` runs and
 * reports mean bytes-per-request with a pass/fail verdict (flat strictly lower).
 *
 * This bench is the primary deterministic gate for whether NF-1 ships (design
 * D5): it ships on this reduction + byte-identical parity + the differential
 * golden, NOT on an end-to-end RPS number unpinned hardware cannot produce.
 *
 * Usage:
 *   node scripts/dispatch-alloc.js                # 5 runs, N=200000
 *   node scripts/dispatch-alloc.js --runs 3 --n 100000
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { computeStats } from './lib/stats.js';
import { RESULTS_DIR } from './lib/paths.js';
import { logError, logHeader, logResult, logStep, parseArgs } from './utils.js';
import { ensureDir, saveResults } from './lib/fsx.js';
import { timestamp } from './lib/time.js';

const args = parseArgs();
const runs = args.runs ? Number.parseInt(String(args.runs), 10) : 5;
const N = args.n ? Number.parseInt(String(args.n), 10) : 200_000;

const CHILD_SCRIPT = join(import.meta.dirname, 'dispatch-alloc-child.js');

function runOnce(variant) {
  const result = spawnSync(
    process.execPath,
    ['--expose-gc', CHILD_SCRIPT, variant, String(N)],
    { encoding: 'utf-8', env: { ...process.env, NODE_ENV: 'production' } }
  );
  if (result.status !== 0) {
    throw new Error(
      `dispatch-alloc-child.js failed for ${variant}: ${result.stderr || result.stdout}`
    );
  }
  const line = result.stdout.trim().split('\n').pop();
  return JSON.parse(line).bytesPerOp;
}

function measureVariant(variant) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    samples.push(runOnce(variant));
  }
  return computeStats(samples);
}

function main() {
  logHeader('Allocation Micro-Bench — NF-1 dispatch de-async (hot-path-dispatch-deasync-and-lazy-state)');
  logResult('Runs per variant', runs);
  logResult('Requests per run (N)', N.toLocaleString());

  logStep('Measuring flat (shipped, flattened dispatch) path...');
  const flat = measureVariant('flat');
  logResult('Flat', `${flat.mean.toFixed(1)} B/req ± ${flat.stddev.toFixed(1)}`, `(cv ${flat.cv}%)`);

  logStep('Measuring async (pre-change, 3-frame) path...');
  const asyncV = measureVariant('async');
  logResult('Async', `${asyncV.mean.toFixed(1)} B/req ± ${asyncV.stddev.toFixed(1)}`, `(cv ${asyncV.cv}%)`);

  const reduction = asyncV.mean > 0 ? (1 - flat.mean / asyncV.mean) * 100 : 0;
  const verdict =
    flat.mean < asyncV.mean
      ? 'PASS — flattened dispatch allocates less'
      : 'FAIL — no allocation reduction';
  logResult('Per-request reduction', `${reduction.toFixed(1)}%`, `→ ${verdict}`);

  const report = {
    timestamp: new Date().toISOString(),
    runs,
    requestsPerRun: N,
    flat,
    async: asyncV,
    reductionPercent: Number(reduction.toFixed(1)),
    verdict,
  };

  const resultsDir = join(RESULTS_DIR, `dispatch-alloc-${timestamp()}`);
  ensureDir(resultsDir);
  saveResults(resultsDir, 'dispatch-alloc.json', report);
  logResult('Saved to', resultsDir);

  if (flat.mean >= asyncV.mean) {
    logError('Allocation gate FAILED: flat path did not allocate less than async.');
    process.exit(1);
  }
}

main();
