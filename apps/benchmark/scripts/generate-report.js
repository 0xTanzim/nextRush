#!/usr/bin/env node

/**
 * Regenerate every report artifact from a stored run — no benchmarking.
 *
 * A publishable run takes hours; `results.json` is the source of truth and every
 * view (Markdown, README tables, CSV, machine-readable scoreboard, cross-run
 * history) is a pure derivation of it. Change the report format, re-run this,
 * never re-run wrk.
 *
 * Usage:
 *   node scripts/generate-report.js                      # latest run
 *   node scripts/generate-report.js --id <run-id>        # a specific run
 *   node scripts/generate-report.js --all                # every stored run
 *   node scripts/generate-report.js --rank-at 256        # headline concurrency level
 *   node scripts/generate-report.js --out /tmp/report    # write elsewhere
 *   node scripts/generate-report.js --history            # also write results/HISTORY.md
 *   node scripts/generate-report.js --stdout             # print REPORT.md, write nothing
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateArtifacts } from './report-md.js';
import { readInstalledFrameworkVersions } from './lib/installed-versions.js';
import { buildHistory } from './lib/report/history.js';
import { RESULTS_DIR, ensureDir, log, logError, logHeader, logStep, parseArgs } from './utils.js';

const args = parseArgs();

function listRunDirs() {
  if (!existsSync(RESULTS_DIR)) return [];
  return readdirSync(RESULTS_DIR)
    .filter((entry) => entry !== 'latest')
    .filter((entry) => statSync(join(RESULTS_DIR, entry)).isDirectory())
    .filter((entry) => existsSync(join(RESULTS_DIR, entry, 'results.json')))
    .sort();
}

function loadReport(runId) {
  const file = join(RESULTS_DIR, runId, 'results.json');
  if (!existsSync(file)) {
    logError(`No results.json for run "${runId}" (looked in ${file}).`);
    logError(`Available runs: ${listRunDirs().join(', ') || 'none'}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch (error) {
    logError(`Failed to parse ${file}: ${error.message}`);
    return null;
  }
}

/**
 * Versions recorded by the run are authoritative. For a run that predates version
 * recording, fall back to what is installed now and label it — a value read today
 * is not evidence about what was measured then.
 */
function resolveOptions(report) {
  const options = args['rank-at'] ? { rankAt: Number(args['rank-at']) } : {};
  const recorded = report?.configuration?.frameworkVersions;

  if (recorded && Object.keys(recorded).length > 0) {
    return { ...options, frameworkVersions: recorded, versionSource: 'recorded at run time' };
  }
  return {
    ...options,
    frameworkVersions: readInstalledFrameworkVersions(),
    versionSource:
      'read from the current `apps/benchmark/package.json` at report-generation time — this run ' +
      'did not record them, so verify against the commit the run was made from',
  };
}

function writeArtifacts(runId, outDir) {
  const report = loadReport(runId);
  if (!report) return false;

  const artifacts = generateArtifacts(report, resolveOptions(report));
  ensureDir(outDir);
  for (const [filename, contents] of Object.entries(artifacts)) {
    writeFileSync(join(outDir, filename), contents, 'utf-8');
    log(`  ✓ ${join(outDir, filename)}`);
  }
  return true;
}

function writeHistory() {
  const reports = listRunDirs()
    .map((runId) => loadReport(runId))
    .filter(Boolean);

  if (reports.length === 0) {
    logError('No stored runs to build a history from.');
    return false;
  }

  const target = join(RESULTS_DIR, 'HISTORY.md');
  writeFileSync(target, buildHistory(reports), 'utf-8');
  log(`  ✓ ${target} (${reports.length} run(s))`);
  return true;
}

function main() {
  if (args.history && !args.id && !args.all && !args.latest) {
    logHeader('Benchmark History');
    process.exit(writeHistory() ? 0 : 1);
  }

  const runIds = args.all ? listRunDirs() : [args.id || 'latest'];
  if (runIds.length === 0) {
    logError('No benchmark runs found. Run a benchmark first.');
    process.exit(1);
  }

  if (args.stdout) {
    const report = loadReport(runIds[0]);
    if (!report) process.exit(1);
    console.log(generateArtifacts(report, resolveOptions(report))['REPORT.md']);
    return;
  }

  logHeader('Regenerating Report Artifacts');
  log('Source of truth: results.json — nothing is re-measured.');

  let failures = 0;
  for (const runId of runIds) {
    logStep(`Run ${runId}`);
    const outDir = args.out ? String(args.out) : join(RESULTS_DIR, runId);
    if (!writeArtifacts(runId, outDir)) failures++;
  }

  if (args.history) {
    logStep('History');
    if (!writeHistory()) failures++;
  }

  process.exit(failures > 0 ? 1 : 0);
}

main();
