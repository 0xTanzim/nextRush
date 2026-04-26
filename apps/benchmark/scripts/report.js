#!/usr/bin/env node

/**
 * Report viewer — displays and compares benchmark results.
 *
 * Usage:
 *   node scripts/report.js                 # Show latest report
 *   node scripts/report.js --latest        # Show latest report
 *   node scripts/report.js --list          # List all runs
 *   node scripts/report.js --id <run-id>   # Show specific run
 *   node scripts/report.js --trend         # Show RPS trend across runs
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RESULTS_DIR, log, logError, logHeader, logResult, parseArgs } from './utils.js';

const args = parseArgs();

function main() {
  if (args.list) {
    listRuns();
  } else if (args.trend) {
    showTrend();
  } else {
    const runId = args.id || 'latest';
    showReport(runId);
  }
}

function listRuns() {
  if (!existsSync(RESULTS_DIR)) {
    logError('No results directory found. Run a benchmark first.');
    return;
  }

  const entries = readdirSync(RESULTS_DIR)
    .filter((e) => e !== 'latest' && statSync(join(RESULTS_DIR, e)).isDirectory())
    .sort()
    .reverse();

  if (entries.length === 0) {
    logError('No benchmark results found.');
    return;
  }

  logHeader('Benchmark Runs');
  log(`${'ID'.padEnd(25)} ${'Profile'.padEnd(12)} ${'Tool'.padEnd(12)} ${'Frameworks'.padEnd(30)}`);
  log('─'.repeat(80));

  for (const entry of entries) {
    const resultsFile = join(RESULTS_DIR, entry, 'results.json');
    if (!existsSync(resultsFile)) continue;

    try {
      const data = JSON.parse(readFileSync(resultsFile, 'utf-8'));
      const frameworks = Object.keys(data.results || {}).join(', ');
      log(
        `${entry.padEnd(25)} ${(data.profile || '?').padEnd(12)} ${(data.tool || '?').padEnd(12)} ${frameworks}`
      );
    } catch {
      log(`${entry.padEnd(25)} (corrupt)`);
    }
  }
}

function showReport(runId) {
  const reportPath = join(RESULTS_DIR, runId, 'REPORT.md');
  if (!existsSync(reportPath)) {
    logError(`No report found for run: ${runId}`);
    logError(`Try: node scripts/report.js --list`);
    return;
  }

  const content = readFileSync(reportPath, 'utf-8');
  console.log(content);
}

function showTrend() {
  if (!existsSync(RESULTS_DIR)) {
    logError('No results directory found.');
    return;
  }

  const entries = readdirSync(RESULTS_DIR)
    .filter((e) => e !== 'latest' && statSync(join(RESULTS_DIR, e)).isDirectory())
    .sort();

  if (entries.length < 2) {
    logError('Need at least 2 runs for trend analysis.');
    return;
  }

  logHeader('RPS Trend (Hello World — NextRush v3)');

  const dataPoints = [];
  for (const entry of entries) {
    const resultsFile = join(RESULTS_DIR, entry, 'results.json');
    if (!existsSync(resultsFile)) continue;

    try {
      const data = JSON.parse(readFileSync(resultsFile, 'utf-8'));
      const nrResult = data.results?.['nextrush-v3'];
      if (!nrResult) continue;

      const hw = nrResult.scenarios?.['hello-world'];
      if (!hw) continue;

      const firstConn = Object.keys(hw.concurrencyResults)[0];
      const rps = hw.concurrencyResults[firstConn]?.stats?.mean || 0;

      dataPoints.push({ id: entry, rps: Math.round(rps), profile: data.profile, tool: data.tool });
    } catch {
      continue;
    }
  }

  if (dataPoints.length === 0) {
    logError('No NextRush v3 hello-world results found.');
    return;
  }

  // ASCII chart
  const maxRps = Math.max(...dataPoints.map((d) => d.rps));
  const chartWidth = 40;

  for (const dp of dataPoints) {
    const barLen = Math.round((dp.rps / maxRps) * chartWidth);
    const bar = '█'.repeat(barLen);
    log(`${dp.id.slice(0, 16).padEnd(18)} ${bar} ${dp.rps.toLocaleString()} RPS (${dp.tool})`);
  }

  if (dataPoints.length >= 2) {
    const first = dataPoints[0].rps;
    const last = dataPoints[dataPoints.length - 1].rps;
    const change = ((last - first) / first) * 100;
    log('');
    logResult('Overall change', `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`);
  }
}

main();
