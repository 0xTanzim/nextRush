#!/usr/bin/env node

/**
 * Native hello-world allocation micro-benchmark — RFC-035 P3 hard gate for the
 * `@nextrush/express-bridge` unused-path guarantee (docs/RFC/ecosystem-interop/
 * 035-express-bridge.md §8.10, G6).
 *
 * Measures the REAL, built native request path — `createApp()` + one `ctx.json`
 * handler served through `@nextrush/adapter-node` `createHandler` — WITHOUT
 * importing `@nextrush/express-bridge`. Pinning a committed baseline lets
 * `check-alloc-regression.js --harness native-hello-alloc --tolerance 0` detect
 * any drift on the native hello-world path (delta ≠ 0 fails the gate): a stray
 * `core`/`router`/`types`/`runtime`/`adapter`/`nextrush` → bridge import, or
 * any other native-path allocation regression, is surfaced here. RFC-035 §8.10:
 * "This is a *violation detector*, not the definition of 'zero cost' — the
 * definition is the import-graph + no-execution-path guarantee above."
 *
 * The bridge is deliberately absent: an unused bridge MUST contribute ZERO
 * bytes to the native path (no import edge ⇒ no code loaded ⇒ nothing to
 * allocate). The method is identical to `handler-alloc.js` / `context-alloc.js`
 * / `dispatch-alloc.js`: each run in its own `--expose-gc` child under an
 * enlarged young generation (`--max-semi-space-size`) so no scavenge fires
 * mid-loop; `heapUsed` delta ÷ N is the total bytes allocated per request. A
 * run in which GC fired during the window is REJECTED and retried.
 *
 * Requires a current `@nextrush/core` and `@nextrush/adapter-node` build
 * (the child imports the workspace dist):
 *   pnpm --filter @nextrush/core --filter @nextrush/adapter-node build
 *
 * Usage:
 *   node scripts/alloc/native-hello-alloc.js                     # 5 runs, N=50000, semi=256MB
 *   node scripts/alloc/native-hello-alloc.js --runs 5 --n 50000 --semi 256
 *   node scripts/alloc/native-hello-alloc.js --trace-gc          # zero-GC calibration
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { computeStats } from '../lib/stats.js';
import { RESULTS_DIR } from '../lib/paths.js';
import { logError, logHeader, logResult, logStep, logWarn, parseArgs } from '../utils.js';
import { ensureDir, saveResults } from '../lib/fsx.js';
import { timestamp } from '../lib/time.js';

const args = parseArgs();
const runs = args.runs ? Number.parseInt(String(args.runs), 10) : 5;
const N = args.n ? Number.parseInt(String(args.n), 10) : 50_000;
const SEMI = args.semi ? Number.parseInt(String(args.semi), 10) : 256;
const TRACE_GC = Boolean(args['trace-gc']);
const MAX_RETRIES = 3;

const CHILD_SCRIPT = join(import.meta.dirname, 'native-hello-alloc-child.js');

const VARIANTS = [{ id: 'native-hello', label: 'native hello-world (no express-bridge import)' }];

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
    throw new Error(`native-hello-alloc-child.js failed for ${variantId}: ${result.stderr || result.stdout}`);
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
  logHeader('GROSS Allocation Micro-Bench — native hello-world (RFC-035 unused-path hard gate)');
  logResult('Runs per variant', runs);
  logResult('Requests per run (N)', N.toLocaleString());
  logResult('Young gen (--max-semi-space-size)', `${SEMI} MB`);
  if (TRACE_GC) logWarn('--trace-gc calibration mode: bracketing GC trace between window markers.');

  const report = {
    timestamp: new Date().toISOString(),
    method: 'gross-allocation (no mid-loop GC; heapUsed delta / N)',
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
    logResult(v.label, `${measured.stats.mean.toFixed(1)} B/req +/- ${measured.stats.stddev.toFixed(1)} (cv ${measured.stats.cv}%)`);
  }

  const resultsDir = join(RESULTS_DIR, `native-hello-alloc-${timestamp()}`);
  ensureDir(resultsDir);
  saveResults(resultsDir, 'native-hello-alloc.json', report);
  logResult('Saved to', resultsDir);
}

try {
  main();
} catch (err) {
  logError(String(err?.stack ?? err));
  process.exit(1);
}