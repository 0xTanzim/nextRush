#!/usr/bin/env node

/**
 * Allocation micro-benchmark for the router match path
 * (OpenSpec: router-match-path-allocation-trim, tasks 1.3 / 2.3 / 3.3 / 5.5).
 *
 * Measures per-request bytes-per-op for a static-route hit and a param-route hit
 * via `router-match-alloc-child.js`, each in its own `--expose-gc` process for
 * `--runs` runs, and reports mean B/op ± stddev per variant.
 *
 * Before/after gating: pass `--baseline <file>` to compare against a previously
 * saved report (captured on the pre-change matcher) and print the reduction. On
 * a first run, save the printed JSON as the baseline. Requires a current
 * `@nextrush/router` build (child imports the workspace dist):
 *   pnpm --filter @nextrush/router build
 *
 * Usage:
 *   node scripts/router-match-alloc.js                       # 5 runs, N=200000
 *   node scripts/router-match-alloc.js --runs 3 --n 100000
 *   node scripts/router-match-alloc.js --baseline results/router-alloc-baseline.json
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { computeStats } from './lib/stats.js';
import { RESULTS_DIR } from './lib/paths.js';
import { logError, logHeader, logResult, logStep, parseArgs } from './utils.js';
import { ensureDir, saveResults } from './lib/fsx.js';
import { timestamp } from './lib/time.js';

const args = parseArgs();
const runs = args.runs ? Number.parseInt(String(args.runs), 10) : 5;
const N = args.n ? Number.parseInt(String(args.n), 10) : 200_000;
const baselineFile = args.baseline ? String(args.baseline) : null;

const CHILD_SCRIPT = join(import.meta.dirname, 'router-match-alloc-child.js');

function runOnce(variant) {
  const result = spawnSync(
    process.execPath,
    ['--expose-gc', CHILD_SCRIPT, variant, String(N)],
    { encoding: 'utf-8', env: { ...process.env, NODE_ENV: 'production' } }
  );
  if (result.status !== 0) {
    throw new Error(
      `router-match-alloc-child.js failed for ${variant}: ${result.stderr || result.stdout}`
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

function reportReduction(label, current, baseline) {
  if (!baseline) return;
  const reduction = baseline.mean > 0 ? (1 - current.mean / baseline.mean) * 100 : 0;
  const verdict = current.mean < baseline.mean ? 'reduced' : 'NO reduction';
  logResult(
    `${label} vs baseline`,
    `${baseline.mean.toFixed(1)} → ${current.mean.toFixed(1)} B/op`,
    `(${reduction.toFixed(1)}% ${verdict})`
  );
}

function main() {
  logHeader('Allocation Micro-Bench — router match path (static + param)');
  logResult('Runs per variant', runs);
  logResult('Matches per run (N)', N.toLocaleString());

  logStep('Measuring static-route hit...');
  const staticHit = measureVariant('static');
  logResult('Static', `${staticHit.mean.toFixed(1)} B/op ± ${staticHit.stddev.toFixed(1)}`, `(cv ${staticHit.cv}%)`);

  logStep('Measuring param-route hit...');
  const paramHit = measureVariant('param');
  logResult('Param', `${paramHit.mean.toFixed(1)} B/op ± ${paramHit.stddev.toFixed(1)}`, `(cv ${paramHit.cv}%)`);

  let baseline = null;
  if (baselineFile) {
    baseline = JSON.parse(readFileSync(baselineFile, 'utf-8'));
    reportReduction('Static', staticHit, baseline.static);
    reportReduction('Param', paramHit, baseline.param);
  }

  const report = {
    timestamp: new Date().toISOString(),
    runs,
    matchesPerRun: N,
    static: staticHit,
    param: paramHit,
  };

  const resultsDir = join(RESULTS_DIR, `router-match-alloc-${timestamp()}`);
  ensureDir(resultsDir);
  saveResults(resultsDir, 'router-match-alloc.json', report);
  logResult('Saved to', resultsDir);
}

try {
  main();
} catch (err) {
  logError(String(err?.stack ?? err));
  process.exit(1);
}
