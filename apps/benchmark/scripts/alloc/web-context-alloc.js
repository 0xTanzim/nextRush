#!/usr/bin/env node

/**
 * Allocation micro-benchmark for the Web-adapter per-request-work trims
 * (OpenSpec: web-adapters-per-request-work-trim, §6). Sibling of the Node
 * context-alloc.js.
 *
 * Proves design D7's gate for Bun / Deno / Edge: the shipped `trimmed` path
 * allocates measurably less per request than the pre-trim `legacy` path, because
 * HP-1 removes the eager IP-lookup closure + policy call when `trustProxy` is
 * false and HP-7 removes the extra `async` frame in `ctx.next()`. Runs each
 * adapter × variant in its own `--expose-gc` child process for `--runs` runs and
 * reports the ABSOLUTE before/after bytes-per-request (mean ± stddev), the
 * per-request byte delta, and a pass/fail verdict (trimmed strictly lower).
 *
 * The absolute bytes-per-request are reported deliberately: this is the isolated
 * removed-work figure, NOT a percentage of total request allocation — the trim
 * must not be overstated as a whole-request reduction (the surrounding
 * Request/Context construction is unchanged and not measured here).
 *
 * Requires a current `@nextrush/runtime` build (the child imports the workspace
 * package's dist). Build first: `pnpm --filter @nextrush/runtime build`.
 *
 * Usage:
 *   node scripts/web-context-alloc.js                 # 5 runs, N=200000, all adapters
 *   node scripts/web-context-alloc.js --runs 3 --n 100000
 *   node scripts/web-context-alloc.js --adapter deno
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
const ADAPTERS = args.adapter ? [String(args.adapter)] : ['bun', 'deno', 'edge'];

const CHILD_SCRIPT = join(import.meta.dirname, 'web-context-alloc-child.js');

function runOnce(adapter, variant) {
  const result = spawnSync(
    process.execPath,
    ['--expose-gc', CHILD_SCRIPT, adapter, variant, String(N)],
    { encoding: 'utf-8', env: { ...process.env, NODE_ENV: 'production' } }
  );
  if (result.status !== 0) {
    throw new Error(
      `web-context-alloc-child.js failed for ${adapter}/${variant}: ${result.stderr || result.stdout}`
    );
  }
  const line = result.stdout.trim().split('\n').pop();
  return JSON.parse(line).bytesPerOp;
}

function measureVariant(adapter, variant) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    samples.push(runOnce(adapter, variant));
  }
  return computeStats(samples);
}

function main() {
  logHeader('Allocation Micro-Bench — Web adapters per-request-work trims (HP-1/HP-7)');
  logResult('Runs per variant', runs);
  logResult('Requests per run (N)', N.toLocaleString());
  logResult('Adapters', ADAPTERS.join(', '));

  const perAdapter = {};
  let allPassed = true;

  for (const adapter of ADAPTERS) {
    logStep(`[${adapter}] measuring trimmed (shipped) path...`);
    const trimmed = measureVariant(adapter, 'trimmed');
    logStep(`[${adapter}] measuring legacy (pre-trim) path...`);
    const legacy = measureVariant(adapter, 'legacy');

    const deltaBytes = legacy.mean - trimmed.mean;
    const reduction = legacy.mean > 0 ? (1 - trimmed.mean / legacy.mean) * 100 : 0;
    const passed = trimmed.mean < legacy.mean;
    allPassed = allPassed && passed;
    const verdict = passed ? 'PASS — trims allocate less' : 'FAIL — no allocation reduction';

    // Absolute before/after bytes-per-request, not just a percentage (D7 honesty).
    logResult(`[${adapter}] Legacy  (before)`, `${legacy.mean.toFixed(1)} B/req ± ${legacy.stddev.toFixed(1)}`, `(cv ${legacy.cv}%)`);
    logResult(`[${adapter}] Trimmed (after)`, `${trimmed.mean.toFixed(1)} B/req ± ${trimmed.stddev.toFixed(1)}`, `(cv ${trimmed.cv}%)`);
    logResult(`[${adapter}] Removed per request`, `${deltaBytes.toFixed(1)} B/req`, `(${reduction.toFixed(1)}% of the measured path) → ${verdict}`);

    perAdapter[adapter] = {
      trimmed,
      legacy,
      deltaBytesPerRequest: Number(deltaBytes.toFixed(1)),
      reductionPercent: Number(reduction.toFixed(1)),
      verdict,
    };
  }

  const report = {
    timestamp: new Date().toISOString(),
    runs,
    requestsPerRun: N,
    note: 'Absolute bytes-per-request of the ISOLATED removed work (IP-lookup closure + policy + async next frame), not a percentage of total request allocation.',
    perAdapter,
    allPassed,
  };

  const resultsDir = join(RESULTS_DIR, `web-context-alloc-${timestamp()}`);
  ensureDir(resultsDir);
  saveResults(resultsDir, 'web-context-alloc.json', report);
  logResult('Saved to', resultsDir);

  if (!allPassed) {
    logError('Allocation gate FAILED: at least one adapter did not allocate less on the trimmed path.');
    process.exit(1);
  }
}

main();
