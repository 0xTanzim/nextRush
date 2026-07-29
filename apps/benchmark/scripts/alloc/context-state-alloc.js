#!/usr/bin/env node

/**
 * Allocation micro-benchmark for the NF-2 lazy `ctx.state` trim
 * (OpenSpec: hot-path-dispatch-deasync-and-lazy-state, task 7.2 / design D4·D5).
 *
 * Proves the decision gate: on a state-unread request the shipped `lazy` path
 * allocates measurably less per request than the pre-trim `eager` path, because
 * NF-2 removes the per-request `state = {}` object the constructor used to build
 * unconditionally. Runs each variant in its own `--expose-gc` child process for
 * `--runs` runs and reports mean bytes-per-request with a pass/fail verdict
 * (lazy strictly lower), mirroring the shipped context-raw-alloc.js.
 *
 * This bench is the gate for whether NF-2 ships (design D4/D5): it ships only if
 * the `{}` is confirmed no longer allocated on a state-unread request AND the
 * adapter-node suite stays green.
 *
 * Usage:
 *   node scripts/context-state-alloc.js                # 5 runs, N=200000
 *   node scripts/context-state-alloc.js --runs 3 --n 100000
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { computeStats } from '../lib/stats.js';
import { RESULTS_DIR } from '../lib/paths.js';
import { logError, logHeader, logResult, logStep, parseArgs } from '../utils.js';
import { ensureDir, saveResults } from '../lib/fsx.js';
import { timestamp } from '../lib/time.js';

const args = parseArgs();
const runs = args.runs ? Number.parseInt(String(args.runs), 10) : 5;
const N = args.n ? Number.parseInt(String(args.n), 10) : 200_000;

const CHILD_SCRIPT = join(import.meta.dirname, 'context-state-alloc-child.js');

function runOnce(variant) {
  const result = spawnSync(
    process.execPath,
    ['--expose-gc', CHILD_SCRIPT, variant, String(N)],
    { encoding: 'utf-8', env: { ...process.env, NODE_ENV: 'production' } }
  );
  if (result.status !== 0) {
    throw new Error(
      `context-state-alloc-child.js failed for ${variant}: ${result.stderr || result.stdout}`
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
  logHeader('Allocation Micro-Bench — NF-2 lazy ctx.state (hot-path-dispatch-deasync-and-lazy-state)');
  logResult('Runs per variant', runs);
  logResult('Requests per run (N)', N.toLocaleString());

  logStep('Measuring lazy (shipped, state-unread) path...');
  const lazy = measureVariant('lazy');
  logResult('Lazy', `${lazy.mean.toFixed(1)} B/req ± ${lazy.stddev.toFixed(1)}`, `(cv ${lazy.cv}%)`);

  logStep('Measuring eager (pre-trim) path...');
  const eager = measureVariant('eager');
  logResult('Eager', `${eager.mean.toFixed(1)} B/req ± ${eager.stddev.toFixed(1)}`, `(cv ${eager.cv}%)`);

  const reduction = eager.mean > 0 ? (1 - lazy.mean / eager.mean) * 100 : 0;
  const verdict =
    lazy.mean < eager.mean ? 'PASS — lazy state allocates less' : 'FAIL — no allocation reduction';
  logResult('Per-request reduction', `${reduction.toFixed(1)}%`, `→ ${verdict}`);

  const report = {
    timestamp: new Date().toISOString(),
    runs,
    requestsPerRun: N,
    lazy,
    eager,
    reductionPercent: Number(reduction.toFixed(1)),
    verdict,
  };

  const resultsDir = join(RESULTS_DIR, `context-state-alloc-${timestamp()}`);
  ensureDir(resultsDir);
  saveResults(resultsDir, 'context-state-alloc.json', report);
  logResult('Saved to', resultsDir);

  if (lazy.mean >= eager.mean) {
    logError('Allocation gate FAILED: lazy path did not allocate less than eager.');
    process.exit(1);
  }
}

main();
