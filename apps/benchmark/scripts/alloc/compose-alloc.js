#!/usr/bin/env node

/**
 * Allocation micro-benchmark for `compose()` (OpenSpec: core-single-middleware-fastpath, §7.1).
 *
 * Proves the design D7 claim: the `len === 1` fast path allocates measurably
 * less per invocation than the general `len >= 2` path, because it does NOT
 * build the recursive `dispatch` function closure the general path allocates
 * per request. It runs the `single` (len 1) and `general` (len 2) variants each
 * in their own `--expose-gc` child process for `--runs` runs, and reports mean
 * bytes-per-invocation with a pass/fail verdict (fast strictly lower).
 *
 * Requires a current `@nextrush/core` build (the child imports the workspace
 * package's dist). Build core first: `pnpm --filter @nextrush/core build`.
 *
 * Usage:
 *   node scripts/compose-alloc.js                # 5 runs, N=200000
 *   node scripts/compose-alloc.js --runs 3 --n 100000
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

const CHILD_SCRIPT = join(import.meta.dirname, 'compose-alloc-child.js');

function runOnce(variant) {
  const result = spawnSync(
    process.execPath,
    ['--expose-gc', CHILD_SCRIPT, variant, String(N)],
    { encoding: 'utf-8', env: { ...process.env, NODE_ENV: 'production' } }
  );
  if (result.status !== 0) {
    throw new Error(`compose-alloc-child.js failed for ${variant}: ${result.stderr || result.stdout}`);
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
  logHeader('Allocation Micro-Bench — compose() len===1 fast path');
  logResult('Runs per variant', runs);
  logResult('Invocations per run (N)', N.toLocaleString());

  logStep('Measuring len === 1 (fast path)...');
  const single = measureVariant('single');
  logResult('Fast (len 1)', `${single.mean.toFixed(1)} B/op ± ${single.stddev.toFixed(1)}`, `(cv ${single.cv}%)`);

  logStep('Measuring len === 2 (general dispatch path)...');
  const general = measureVariant('general');
  logResult('General (len 2)', `${general.mean.toFixed(1)} B/op ± ${general.stddev.toFixed(1)}`, `(cv ${general.cv}%)`);

  const reduction = general.mean > 0 ? (1 - single.mean / general.mean) * 100 : 0;
  const verdict = single.mean < general.mean ? 'PASS — fast path allocates less' : 'FAIL — no allocation reduction';
  logResult('Per-op reduction', `${reduction.toFixed(1)}%`, `→ ${verdict}`);

  logStep('Measuring len === 1 with a SYNCHRONOUS middleware (F-09 elision)...');
  const sync = measureVariant('sync');
  logResult('Sync (len 1)', `${sync.mean.toFixed(1)} B/op ± ${sync.stddev.toFixed(1)}`, `(cv ${sync.cv}%)`);

  const report = {
    timestamp: new Date().toISOString(),
    runs,
    invocationsPerRun: N,
    single,
    general,
    sync,
    reductionPercent: Number(reduction.toFixed(1)),
    verdict,
  };

  const resultsDir = join(RESULTS_DIR, `compose-alloc-${timestamp()}`);
  ensureDir(resultsDir);
  saveResults(resultsDir, 'compose-alloc.json', report);
  logResult('Saved to', resultsDir);

  if (single.mean >= general.mean) {
    logError('Allocation gate FAILED: len===1 did not allocate less than len===2.');
    process.exit(1);
  }
}

main();
