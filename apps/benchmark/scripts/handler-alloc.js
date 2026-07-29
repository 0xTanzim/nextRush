#!/usr/bin/env node

/**
 * GROSS-allocation micro-benchmark for `@nextrush/adapter-node`'s
 * `createHandler` per-request closure (OpenSpec:
 * fix-benchmark-measurement-integrity, task 5 / design.md Goal 5).
 *
 * Measures the REAL, built `createHandler`'s TOTAL (transient included)
 * bytes-per-request for both branches — `enabled` (the `timeout > 0`
 * handler-vs-timeout `Promise.race` path `TIMEOUT_SENTINEL` lives in) and
 * `disabled` (the `timeout <= 0` pre-F-04 direct-await path). This closes the
 * specific coverage gap (reconciliation report F-01/F-13) that let the
 * `d97734e3` regression land undetected: no allocation harness existed for
 * this function at all.
 *
 * The `enabled` figure is this harness's primary, gate-worthy signal — it is
 * the deterministic before/after check for the `TIMEOUT_SENTINEL` module-scope
 * hoist (D5), and is stable to well under 1% CV across repeated runs. The
 * `disabled` figure is reported for completeness (its own path is simpler and
 * unaffected by the hoist) but is measurably noisier across process
 * invocations — treat an `enabled` vs. `disabled` delta as directional only,
 * never as a precise number to cite.
 *
 * Same method as `param-match-alloc.js`: each variant runs in its own process
 * under an enlarged young generation (`--max-semi-space-size`) so no scavenge
 * fires mid-loop; `heapUsed` delta ÷ N is the total bytes allocated per
 * request. A run in which GC fired during the measured window is REJECTED and
 * retried, matching the calibration contract of the existing `*-alloc.js`
 * family. The child additionally drains one microtask turn after every
 * request (`await null`) so each request's timer clears via
 * `createHandler`'s own `clearTimeout` before the next one is created —
 * without this, thousands of live timers pile up simultaneously (an
 * artificial spike no real workload produces) and contaminate the window
 * independently of `--max-semi-space-size`.
 *
 * Requires current `@nextrush/core` and `@nextrush/adapter-node` builds
 * (child imports the workspace dist):
 *   pnpm --filter @nextrush/core --filter @nextrush/adapter-node build
 *
 * Usage:
 *   node scripts/handler-alloc.js                      # 5 runs, N=50000, semi=256MB
 *   node scripts/handler-alloc.js --runs 5 --n 50000 --semi 256
 *   node scripts/handler-alloc.js --trace-gc           # zero-GC calibration
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { computeStats } from './lib/stats.js';
import { RESULTS_DIR } from './lib/paths.js';
import { logError, logHeader, logResult, logStep, logWarn, parseArgs } from './utils.js';
import { ensureDir, saveResults } from './lib/fsx.js';
import { timestamp } from './lib/time.js';

const args = parseArgs();
const runs = args.runs ? Number.parseInt(String(args.runs), 10) : 5;
const N = args.n ? Number.parseInt(String(args.n), 10) : 50_000;
const SEMI = args.semi ? Number.parseInt(String(args.semi), 10) : 256;
const TRACE_GC = Boolean(args['trace-gc']);
const MAX_RETRIES = 3;

const CHILD_SCRIPT = join(import.meta.dirname, 'handler-alloc-child.js');

const VARIANTS = [
  { id: 'enabled', label: 'timeout > 0 (handler-vs-timeout Promise.race)' },
  { id: 'disabled', label: 'timeout <= 0 (pre-F-04 direct-await, no race)' },
];

function nodeArgs() {
  const flags = ['--expose-gc', `--max-semi-space-size=${SEMI}`];
  if (TRACE_GC) flags.push('--trace-gc');
  return flags;
}

function parseChildResult(stdout) {
  const lines = String(stdout).trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('{') && line.includes('"bytesPerOp"')) {
      return JSON.parse(line);
    }
  }
  throw new Error(`no result JSON in child stdout:\n${stdout}`);
}

function countGcBetweenMarkers(stderr) {
  const lines = String(stderr).split('\n');
  let inWindow = false;
  let count = 0;
  for (const line of lines) {
    if (line.includes('MEASURE_START')) inWindow = true;
    else if (line.includes('MEASURE_END')) inWindow = false;
    else if (inWindow && /\b(Scavenge|Mark-Compact|Mark-sweep)\b/.test(line)) count++;
  }
  return count;
}

function runOnce(variantId) {
  const result = spawnSync(
    process.execPath,
    [...nodeArgs(), CHILD_SCRIPT, variantId, String(N)],
    { encoding: 'utf-8', env: { ...process.env, NODE_ENV: 'production' } }
  );
  if (result.status !== 0) {
    throw new Error(`handler-alloc-child.js failed for ${variantId}: ${result.stderr || result.stdout}`);
  }
  const parsed = parseChildResult(result.stdout);
  const gcInWindow = TRACE_GC ? countGcBetweenMarkers(result.stderr) : null;
  return { bytesPerOp: parsed.bytesPerOp, gcCount: parsed.gcCount, gcInWindow };
}

function measureVariant(variantId) {
  const samples = [];
  let rejected = 0;
  while (samples.length < runs) {
    let sample;
    let attempts = 0;
    do {
      sample = runOnce(variantId);
      const dirty = sample.gcCount > 0 || (sample.gcInWindow ?? 0) > 0;
      if (!dirty) break;
      rejected++;
      attempts++;
    } while (attempts < MAX_RETRIES);

    if (sample.gcCount > 0 || (sample.gcInWindow ?? 0) > 0) {
      throw new Error(
        `${variantId}: GC fired during the measured window after ${MAX_RETRIES} retries ` +
          `(gcCount=${sample.gcCount}, gcInWindow=${sample.gcInWindow}). ` +
          `Raise --semi (currently ${SEMI}MB) or lower --n (currently ${N}).`
      );
    }
    samples.push(sample.bytesPerOp);
  }
  return { stats: computeStats(samples), rejected };
}

function main() {
  logHeader('GROSS Allocation Micro-Bench — createHandler per-request closure');
  logResult('Runs per variant', runs);
  logResult('Requests per run (N)', N.toLocaleString());
  logResult('Young gen (--max-semi-space-size)', `${SEMI} MB`);
  if (TRACE_GC) logWarn('--trace-gc calibration mode: bracketing GC trace between window markers.');

  const report = {
    timestamp: new Date().toISOString(),
    method: 'gross-allocation (no mid-loop GC; heapUsed delta ÷ N)',
    node: process.version,
    runs,
    requestsPerRun: N,
    maxSemiSpaceSizeMB: SEMI,
    variants: {},
  };

  for (const v of VARIANTS) {
    logStep(`Measuring ${v.label}...`);
    const measured = measureVariant(v.id);
    report.variants[v.id] = { label: v.label, ...measured.stats, rejectedRuns: measured.rejected };
    logResult(v.label, `${measured.stats.mean.toFixed(1)} B/req ± ${measured.stats.stddev.toFixed(1)} (cv ${measured.stats.cv}%)`);
  }

  const resultsDir = join(RESULTS_DIR, `handler-alloc-${timestamp()}`);
  ensureDir(resultsDir);
  saveResults(resultsDir, 'handler-alloc.json', report);
  logResult('Saved to', resultsDir);
}

try {
  main();
} catch (err) {
  logError(String(err?.stack ?? err));
  process.exit(1);
}
