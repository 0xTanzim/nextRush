#!/usr/bin/env node

/**
 * Tight allocation-regression gate — compares freshly-measured `*-alloc.js`
 * harness output against a committed baseline and fails (exit 1) if any
 * metric's mean increased beyond a near-zero tolerance (design.md: bytes-
 * per-request has `cv≈0`, so any real increase is a genuine regression, not
 * CI-runner noise — the counterpart to `check-regression.js`'s loose
 * throughput gate).
 *
 * Usage:
 *   node scripts/check-alloc-regression.js --harness handler-alloc
 *   node scripts/check-alloc-regression.js --harness handler-alloc --tolerance 0.03
 *   node scripts/check-alloc-regression.js --baseline-file <path> --latest-file <path>
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { findAllocRegressions } from '../lib/alloc-regression.js';
import { logError, logHeader, log, parseArgs } from '../utils.js';
import { RESULTS_DIR } from '../lib/paths.js';

const args = parseArgs();
const tolerance = args.tolerance ? parseFloat(args.tolerance) : 0.05;

function loadJson(path) {
  if (!existsSync(path)) {
    logError(`Not found: ${path}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    logError(`Failed to parse ${path}: ${err.message}`);
    return null;
  }
}

function main() {
  const harnessName = args.harness ? String(args.harness) : null;
  const baselineFile = args['baseline-file']
    ? String(args['baseline-file'])
    : join(RESULTS_DIR, 'baseline', `${harnessName}.json`);
  const latestFile = args['latest-file'] ? String(args['latest-file']) : join(RESULTS_DIR, `${harnessName}.json`);

  if (!harnessName && !args['baseline-file']) {
    logError('Provide --harness <name> or explicit --baseline-file/--latest-file.');
    process.exit(2);
  }

  if (!existsSync(baselineFile)) {
    logError(
      `No committed allocation baseline at ${baselineFile}. A pinned baseline is required — see ` +
        'apps/benchmark/README.md for how to seed one.'
    );
    process.exit(2);
  }

  const baseline = loadJson(baselineFile);
  const latest = loadJson(latestFile);
  if (!baseline || !latest) process.exit(2);

  logHeader(`Allocation Regression Check — ${harnessName ?? baselineFile} (tolerance ${(tolerance * 100).toFixed(0)}%)`);

  const regressions = findAllocRegressions(baseline, latest, { tolerance });
  if (regressions.length === 0) {
    log('✓ No allocation regressions beyond tolerance.');
    process.exit(0);
  }

  logError(`${regressions.length} allocation regression(s) detected:`);
  for (const r of regressions) log(`  ✗ ${r}`);
  process.exit(1);
}

main();
