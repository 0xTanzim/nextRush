#!/usr/bin/env node

/**
 * Allocation micro-benchmark for the Node adapter per-request-work trims
 * (OpenSpec: node-adapter-per-request-work-trim, §7.1).
 *
 * Proves design D5's primary gate: the shipped `trimmed` path allocates
 * measurably less per request than the pre-trim `legacy` path, because the three
 * trims remove a per-request options object (HP-4), an eager IP-lookup closure +
 * policy call (HP-1), and an extra `async` frame in `ctx.next()` (HP-7). Runs
 * each variant in its own `--expose-gc` child process for `--runs` runs and
 * reports mean bytes-per-request with a pass/fail verdict (trimmed strictly
 * lower).
 *
 * Requires a current `@nextrush/runtime` build (the child imports the workspace
 * package's dist). Build first: `pnpm --filter @nextrush/runtime build`.
 *
 * Usage:
 *   node scripts/context-alloc.js                # 5 runs, N=200000
 *   node scripts/context-alloc.js --runs 3 --n 100000
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

const CHILD_SCRIPT = join(import.meta.dirname, 'context-alloc-child.js');

function runOnce(variant) {
  const result = spawnSync(
    process.execPath,
    ['--expose-gc', CHILD_SCRIPT, variant, String(N)],
    { encoding: 'utf-8', env: { ...process.env, NODE_ENV: 'production' } }
  );
  if (result.status !== 0) {
    throw new Error(
      `context-alloc-child.js failed for ${variant}: ${result.stderr || result.stdout}`
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
  logHeader('Allocation Micro-Bench — Node adapter per-request-work trims (HP-1/HP-4/HP-7)');
  logResult('Runs per variant', runs);
  logResult('Requests per run (N)', N.toLocaleString());

  logStep('Measuring trimmed (shipped) path...');
  const trimmed = measureVariant('trimmed');
  logResult('Trimmed', `${trimmed.mean.toFixed(1)} B/req ± ${trimmed.stddev.toFixed(1)}`, `(cv ${trimmed.cv}%)`);

  logStep('Measuring legacy (pre-trim) path...');
  const legacy = measureVariant('legacy');
  logResult('Legacy', `${legacy.mean.toFixed(1)} B/req ± ${legacy.stddev.toFixed(1)}`, `(cv ${legacy.cv}%)`);

  const reduction = legacy.mean > 0 ? (1 - trimmed.mean / legacy.mean) * 100 : 0;
  const verdict =
    trimmed.mean < legacy.mean ? 'PASS — trims allocate less' : 'FAIL — no allocation reduction';
  logResult('Per-request reduction', `${reduction.toFixed(1)}%`, `→ ${verdict}`);

  const report = {
    timestamp: new Date().toISOString(),
    runs,
    requestsPerRun: N,
    trimmed,
    legacy,
    reductionPercent: Number(reduction.toFixed(1)),
    verdict,
  };

  const resultsDir = join(RESULTS_DIR, `context-alloc-${timestamp()}`);
  ensureDir(resultsDir);
  saveResults(resultsDir, 'context-alloc.json', report);
  logResult('Saved to', resultsDir);

  if (trimmed.mean >= legacy.mean) {
    logError('Allocation gate FAILED: trimmed path did not allocate less than legacy.');
    process.exit(1);
  }
}

main();
