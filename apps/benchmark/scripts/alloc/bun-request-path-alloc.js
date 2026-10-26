#!/usr/bin/env node

/**
 * Allocation micro-benchmark for the two Bun adapter request-path candidates
 * (OpenSpec: reduce-bun-request-path-cost, task 1.4) — the per-request drain
 * async wrapper and the per-request `requestIP` resolver thunk.
 *
 * Measures the ISOLATED removed work per request, bytes/op, in isolated
 * `--expose-gc` child processes (5 runs per variant by default), mirroring the
 * web-context-alloc harness protocol: each child warms up, forces GC, and
 * reports `heapUsed` delta ÷ N over retained ops.
 *
 * This is an instrument, not a gate: the accept/park decision belongs to the
 * change's RFC, written after these numbers; a delta at zero is a recorded
 * measurement, not a failure (unlike the shipped-trim harnesses).
 *
 * Usage:
 *   node scripts/alloc/bun-request-path-alloc.js
 *   node scripts/alloc/bun-request-path-alloc.js --runs 3 --n 100000
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { computeStats } from '../lib/stats.js';
import { RESULTS_DIR } from '../lib/paths.js';
import { logHeader, logResult, logStep, parseArgs } from '../utils.js';
import { ensureDir, saveResults } from '../lib/fsx.js';
import { timestamp } from '../lib/time.js';

const args = parseArgs();
const runs = args.runs ? Number.parseInt(String(args.runs), 10) : 5;
const N = args.n ? Number.parseInt(String(args.n), 10) : 200_000;

const CHILD_SCRIPT = join(import.meta.dirname, 'bun-request-path-alloc-child.js');

const PAIRS = [
  {
    name: 'drain',
    current: 'wrapped',
    after: 'direct',
    label: 'trackedHandler async wrapper + counter',
  },
  {
    name: 'ip',
    current: 'thunk',
    after: 'refs',
    label: 'requestIP resolver thunk',
  },
];

function runOnce(variant) {
  const result = spawnSync(
    process.execPath,
    ['--expose-gc', CHILD_SCRIPT, variant, String(N)],
    { encoding: 'utf-8', env: { ...process.env, NODE_ENV: 'production' } }
  );
  if (result.status !== 0) {
    throw new Error(
      `bun-request-path-alloc-child.js failed for ${variant}: ${result.stderr || result.stdout}`
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
  logHeader('Allocation Micro-Bench — Bun request-path candidates');
  logResult('Runs per variant', runs);
  logResult('Requests per run (N)', N.toLocaleString());

  const report = {
    timestamp: new Date().toISOString(),
    runs,
    requestsPerRun: N,
    note: 'Absolute bytes-per-request of the ISOLATED removed work, not a whole-request percentage.',
    pairs: {},
  };

  for (const pair of PAIRS) {
    logStep(`[${pair.name}] measuring current (${pair.current}) path...`);
    const current = measureVariant(pair.current);
    logStep(`[${pair.name}] measuring post-trim (${pair.after}) path...`);
    const after = measureVariant(pair.after);

    const delta = current.mean - after.mean;
    logResult(
      `[${pair.name}] Current  (${pair.current})`,
      `${current.mean.toFixed(1)} B/req ± ${current.stddev.toFixed(1)}`,
      `(cv ${current.cv}%)`
    );
    logResult(
      `[${pair.name}] Post-trim (${pair.after})`,
      `${after.mean.toFixed(1)} B/req ± ${after.stddev.toFixed(1)}`,
      `(cv ${after.cv}%)`
    );
    logResult(`[${pair.name}] Removed per request`, `${delta.toFixed(1)} B/req`, `(${pair.label})`);

    report.pairs[pair.name] = {
      current,
      after,
      deltaBytesPerRequest: Number(delta.toFixed(1)),
    };
  }

  const resultsDir = join(RESULTS_DIR, `bun-request-path-alloc-${timestamp()}`);
  ensureDir(resultsDir);
  saveResults(resultsDir, 'bun-request-path-alloc.json', report);
  logResult('Saved to', resultsDir);
}

main();
