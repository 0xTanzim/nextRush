#!/usr/bin/env node

/**
 * Regression gate — compares the latest run against a pinned baseline and fails
 * (exit 1) if any framework/scenario/concurrency regresses beyond tolerance
 * (audit ARCH-07). Intended for CI.
 *
 * Usage:
 *   node scripts/check-regression.js                          # latest vs results/baseline
 *   node scripts/check-regression.js --baseline <dir>         # explicit baseline dir
 *   node scripts/check-regression.js --latest <dir>           # explicit latest dir
 *   node scripts/check-regression.js --tolerance 0.15         # 15% allowed drop
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REGRESSION_TOLERANCE } from '../config/constants.js';
import { withRecomputedPublishable } from './lib/publishable.js';
import { RESULTS_DIR, log, logError, logHeader, logWarn, parseArgs } from './utils.js';

const args = parseArgs();
const tolerance = args.tolerance ? parseFloat(args.tolerance) : REGRESSION_TOLERANCE;
const baselineDir = args.baseline || join(RESULTS_DIR, 'baseline');
const latestDir = args.latest || join(RESULTS_DIR, 'latest');

function loadReport(dir) {
  const file = join(dir, 'results.json');
  if (!existsSync(file)) {
    logError(`No results.json in ${dir}`);
    return null;
  }
  try {
    return withRecomputedPublishable(JSON.parse(readFileSync(file, 'utf-8')));
  } catch (err) {
    logError(`Failed to parse ${file}: ${err.message}`);
    return null;
  }
}

function meanRps(report, fwId, scenarioId, conn) {
  return report.results?.[fwId]?.scenarios?.[scenarioId]?.concurrencyResults?.[conn]?.stats?.mean;
}

function main() {
  if (!existsSync(baselineDir)) {
    logError(`No baseline at ${baselineDir}.`);
    logWarn(
      'Create one from a publishable run: `pnpm bench:compare --profile full`, then ' +
        '`cp -r results/latest results/baseline`.'
    );
    process.exit(2);
  }

  const baseline = loadReport(baselineDir);
  const latest = loadReport(latestDir);
  if (!baseline || !latest) process.exit(2);

  if (!baseline.publishable || !latest.publishable) {
    logWarn('Baseline or latest was produced by a non-publishable (single-run) profile — comparison is advisory only.');
  }

  logHeader(`Regression Check (tolerance ${(tolerance * 100).toFixed(0)}%)`);

  const regressions = [];
  let compared = 0;

  for (const fwId of Object.keys(latest.results || {})) {
    const fwLatest = latest.results[fwId];
    if (fwLatest.error) continue;
    for (const scenarioId of Object.keys(fwLatest.scenarios || {})) {
      const conns = Object.keys(fwLatest.scenarios[scenarioId].concurrencyResults || {});
      for (const conn of conns) {
        const now = meanRps(latest, fwId, scenarioId, conn);
        const base = meanRps(baseline, fwId, scenarioId, conn);
        if (typeof now !== 'number' || typeof base !== 'number' || base <= 0) continue;
        compared++;
        const drop = 1 - now / base;
        if (drop > tolerance) {
          regressions.push(
            `${fwId} · ${scenarioId} @${conn}c: ${Math.round(base).toLocaleString()} → ${Math.round(now).toLocaleString()} RPS (−${(drop * 100).toFixed(1)}%)`
          );
        }
      }
    }
  }

  log(`Compared ${compared} data point(s).`);
  if (regressions.length === 0) {
    log('✓ No regressions beyond tolerance.');
    process.exit(0);
  }

  logError(`${regressions.length} regression(s) detected:`);
  for (const r of regressions) log(`  ✗ ${r}`);
  process.exit(1);
}

main();
