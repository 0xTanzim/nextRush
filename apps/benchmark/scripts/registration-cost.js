#!/usr/bin/env node

/**
 * Registration-cost benchmark — measures `registerControllers()` boot time at
 * multiple controller-count scales (design.md D2), to reveal whether
 * registration cost scales linearly or worse (e.g. a hidden O(n²) that only
 * shows up at 1000+ controllers — the checklist's own "why it matters" risk).
 *
 * Each (scale × run) boots in its own child process (registration-cost-child.js)
 * so one scale's V8 JIT/GC warmth never leaks into the next, matching the
 * per-run process-isolation the rest of this harness already relies on
 * (scripts/lib/server.js spawns a fresh server process per benchmark run).
 *
 * Usage:
 *   node scripts/registration-cost.js                       # default scales, 5 runs
 *   node scripts/registration-cost.js --scales 1,10,100,1000
 *   node scripts/registration-cost.js --runs 3
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { computeStats } from './lib/stats.js';
import { RESULTS_DIR } from './lib/paths.js';
import { logError, logHeader, logResult, logStep, parseArgs } from './utils.js';
import { ensureDir, saveResults } from './lib/fsx.js';
import { timestamp } from './lib/time.js';

const args = parseArgs();
const scales = (args.scales ? String(args.scales).split(',') : ['1', '10', '100', '1000']).map(
  (s) => parseInt(s, 10)
);
const runs = args.runs ? parseInt(args.runs, 10) : 5;

const CHILD_SCRIPT = join(import.meta.dirname, 'registration-cost-child.js');

function runOnce(n) {
  const result = spawnSync(process.execPath, [CHILD_SCRIPT, String(n)], {
    encoding: 'utf-8',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  if (result.status !== 0) {
    throw new Error(
      `registration-cost-child.js failed for n=${n}: ${result.stderr || result.stdout}`
    );
  }
  const line = result.stdout.trim().split('\n').pop();
  const parsed = JSON.parse(line);
  return parsed.bootMs;
}

function main() {
  logHeader('Registration Cost — Class/DI Path');
  logResult('Scales', scales.join(', '));
  logResult('Runs per scale', runs);

  const byScale = {};
  for (const n of scales) {
    logStep(`Measuring boot time at N=${n} controllers (${runs} runs)...`);
    const bootTimes = [];
    for (let i = 0; i < runs; i++) {
      bootTimes.push(runOnce(n));
    }
    const stats = computeStats(bootTimes);
    byScale[n] = stats;
    logResult(`N=${n}`, `${stats.mean}ms ± ${stats.stddev}ms`, `(cv ${stats.cv}%)`);
  }

  // Simple scaling signal: ratio of (mean at largest N)/(mean at smallest N)
  // vs the ratio of N itself. A ratio far above the N-ratio suggests
  // super-linear (e.g. O(n²)) registration cost, not just constant overhead.
  const sortedScales = [...scales].sort((a, b) => a - b);
  const smallest = sortedScales[0];
  const largest = sortedScales[sortedScales.length - 1];
  const nRatio = largest / smallest;
  const timeRatio = byScale[largest].mean / (byScale[smallest].mean || 1);
  const scalingVerdict =
    timeRatio <= nRatio * 1.5
      ? 'linear or better'
      : timeRatio <= nRatio * 3
        ? 'mildly super-linear'
        : 'super-linear — investigate';

  logResult('N ratio', `${largest}/${smallest} = ${nRatio.toFixed(1)}x`);
  logResult('Time ratio', `${timeRatio.toFixed(1)}x`, `→ ${scalingVerdict}`);

  const report = {
    timestamp: new Date().toISOString(),
    runs,
    scales: sortedScales,
    results: byScale,
    scalingVerdict,
  };

  const resultsDir = join(RESULTS_DIR, `registration-cost-${timestamp()}`);
  ensureDir(resultsDir);
  saveResults(resultsDir, 'registration-cost.json', report);
  logResult('Saved to', resultsDir);
}

main();
