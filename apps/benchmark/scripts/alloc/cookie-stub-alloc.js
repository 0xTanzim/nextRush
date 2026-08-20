#!/usr/bin/env node

/**
 * Allocation micro-benchmark for the RFC-034 shared uninitialized cookie stub
 * (OpenSpec: ctx-cookies-capability, task 3.5).
 *
 * Proves the allocation gate: on a cookie-unused request the shipped `stub`
 * path (retain the process-shared frozen singleton) allocates measurably less
 * per request than the `store` path (one per-request cookie store object),
 * because RFC-034 moves the store construction behind middleware activation.
 * Runs each variant in its own `--expose-gc` child process for `--runs` runs
 * and reports mean bytes-per-request with a pass/fail verdict (stub strictly
 * lower), mirroring the shipped context-state-alloc.js.
 *
 * Usage:
 *   node scripts/alloc/cookie-stub-alloc.js                # 5 runs, N=200000
 *   node scripts/alloc/cookie-stub-alloc.js --runs 3 --n 100000
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

const CHILD_SCRIPT = join(import.meta.dirname, 'cookie-stub-alloc-child.js');

function runOnce(variant) {
  const result = spawnSync(
    process.execPath,
    ['--expose-gc', CHILD_SCRIPT, variant, String(N)],
    { encoding: 'utf-8', env: { ...process.env, NODE_ENV: 'production' } }
  );
  if (result.status !== 0) {
    throw new Error(`cookie-stub-alloc-child.js failed for ${variant}: ${result.stderr || result.stdout}`);
  }
  const line = result.stdout.trim().split('\n').pop();
  return JSON.parse(line).bytesPerOp;
}

function main() {
  logHeader('RFC-034 cookie stub allocation gate');
  ensureDir(RESULTS_DIR);

  const stubBytes = [];
  const storeBytes = [];

  for (let i = 1; i <= runs; i++) {
    logStep(`run ${i}/${runs} — N=${N}`);
    stubBytes.push(runOnce('stub'));
    storeBytes.push(runOnce('store'));
  }

  const stub = computeStats(stubBytes);
  const store = computeStats(storeBytes);

  logResult('stub (shared, shipped)', stub.mean, stubBytes);
  logResult('store (per-request, pre-change equivalent)', store.mean, storeBytes);

  const passed = stub.mean < store.mean;
  logResult('verdict', passed ? 1 : 0, []);
  console.log(
    passed
      ? 'PASS: the shared stub allocates strictly less per cookie-unused request.'
      : 'FAIL: the shared stub did not allocate strictly less than the per-request store.'
  );

  saveResults(
    RESULTS_DIR,
    'cookie-stub-alloc.json',
    {
      runs,
      N,
      stubMean: stub.mean,
      storeMean: store.mean,
      passed,
      generatedAt: timestamp(),
    }
  );
  process.exitCode = passed ? 0 : 1;
}

main();
