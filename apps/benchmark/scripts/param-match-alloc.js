#!/usr/bin/env node

/**
 * GROSS-allocation micro-benchmark for the router param-match path
 * (OpenSpec: router-param-path-profile-gate, tasks 2.1–2.4 / D1).
 *
 * Measures the REAL, built `@nextrush/router` matcher's TOTAL (transient
 * included) bytes-per-match for three cases — a static hit, a depth-2 param
 * route (`/users/:id`), and a depth-8 deep-param route
 * (`/api/v1/orgs/:o/teams/:t/members/:m`) — so per-segment allocation scaling is
 * visible. This is the instrument the net-retained bench (`router-match-alloc.js`)
 * could not provide: each variant runs in its own process under an enlarged
 * young generation (`--max-semi-space-size`) so no scavenge fires mid-loop,
 * making `heapUsed`-delta ÷ N the total allocated per match.
 *
 * For every variant it reports TWO figures (design.md Risk 1 — escape analysis
 * is a first-class variable):
 *   - `retain` — results kept alive (the escaping, production-realistic gross);
 *   - `discard` — results dropped, so V8 may scalar-replace the non-escaping
 *     allocation. A near-zero discard figure is EVIDENCE the allocation is
 *     escape-analysis-eligible, not a measurement artifact.
 *
 * A run in which GC fired during the measured window is REJECTED (a scavenge
 * reclaims transient garbage and under-counts). If a variant cannot produce a
 * clean run at the given N/semi-space, the script fails with a hint to raise
 * `--semi` or lower `--n` (D1's calibration contract).
 *
 * Requires a current `@nextrush/router` build (child imports the workspace dist):
 *   pnpm --filter @nextrush/router build
 *
 * Usage:
 *   node scripts/param-match-alloc.js                      # 5 runs, N=200000, semi=512MB
 *   node scripts/param-match-alloc.js --runs 5 --n 200000 --semi 512
 *   node scripts/param-match-alloc.js --trace-gc           # zero-GC calibration (task 2.3)
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
const N = args.n ? Number.parseInt(String(args.n), 10) : 200_000;
const SEMI = args.semi ? Number.parseInt(String(args.semi), 10) : 512;
const TRACE_GC = Boolean(args['trace-gc']);
const MAX_RETRIES = 3;

const CHILD_SCRIPT = join(import.meta.dirname, 'param-match-alloc-child.js');

const VARIANTS = [
  { id: 'static', label: 'Static hit (/users/list)', segments: 3 },
  { id: 'depth2', label: 'Depth-2 param (/users/:id)', segments: 2 },
  { id: 'depth8', label: 'Depth-8 param (…/orgs/:o/teams/:t/members/:m)', segments: 8 },
];

function nodeArgs() {
  const flags = ['--expose-gc', `--max-semi-space-size=${SEMI}`];
  if (TRACE_GC) flags.push('--trace-gc');
  return flags;
}

/**
 * Extract the last line of stdout that parses as our result JSON. `--trace-gc`
 * writes `[pid:...] ... Scavenge ...` lines to stdout too, so we can't blindly
 * take the last line — we scan upward for the first `{...variant...}` object.
 */
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

/** Count `Scavenge/Mark-Compact` gc trace lines between the child's window markers. */
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

/** Run one child; returns { bytesPerOp, gcCount, gcInWindow }. */
function runOnce(variant, mode) {
  const result = spawnSync(
    process.execPath,
    [...nodeArgs(), CHILD_SCRIPT, variant, String(N), mode],
    { encoding: 'utf-8', env: { ...process.env, NODE_ENV: 'production' } }
  );
  if (result.status !== 0) {
    throw new Error(`param-match-alloc-child.js failed for ${variant}/${mode}: ${result.stderr || result.stdout}`);
  }
  const parsed = parseChildResult(result.stdout);
  // --trace-gc lands on stdout, not stderr, so window-bracket counting reads stdout here.
  const gcInWindow = TRACE_GC ? countGcBetweenMarkers(result.stdout) : null;
  return { bytesPerOp: parsed.bytesPerOp, gcCount: parsed.gcCount, gcInWindow };
}

/** Collect `sampleCount` GC-free samples for a variant/mode, retrying runs that saw in-window GC. */
function measureVariant(variant, mode, sampleCount) {
  const samples = [];
  let rejected = 0;
  while (samples.length < sampleCount) {
    let sample;
    let attempts = 0;
    do {
      sample = runOnce(variant, mode);
      const dirty = sample.gcCount > 0 || (sample.gcInWindow ?? 0) > 0;
      if (!dirty) break;
      rejected++;
      attempts++;
    } while (attempts < MAX_RETRIES);

    if (sample.gcCount > 0 || (sample.gcInWindow ?? 0) > 0) {
      throw new Error(
        `${variant}/${mode}: GC fired during the measured window after ${MAX_RETRIES} retries ` +
          `(gcCount=${sample.gcCount}, gcInWindow=${sample.gcInWindow}). ` +
          `Raise --semi (currently ${SEMI}MB) or lower --n (currently ${N}).`
      );
    }
    samples.push(sample.bytesPerOp);
  }
  return { stats: computeStats(samples), rejected };
}

function main() {
  logHeader('GROSS Allocation Micro-Bench — router param-match path (D1)');
  logResult('Runs per variant', runs);
  logResult('Matches per run (N)', N.toLocaleString());
  logResult('Young gen (--max-semi-space-size)', `${SEMI} MB`);
  if (TRACE_GC) logWarn('--trace-gc calibration mode: bracketing GC trace between window markers.');

  const report = {
    timestamp: new Date().toISOString(),
    method: 'gross-allocation (no mid-loop GC; heapUsed delta ÷ N)',
    node: process.version,
    runs,
    matchesPerRun: N,
    maxSemiSpaceSizeMB: SEMI,
    variants: {},
  };

  for (const v of VARIANTS) {
    logStep(`Measuring ${v.label}...`);
    const retain = measureVariant(v.id, 'retain', runs);
    const discard = measureVariant(v.id, 'discard', Math.min(runs, 2)); // floor evidence
    report.variants[v.id] = {
      label: v.label,
      segments: v.segments,
      retain: { ...retain.stats, rejectedRuns: retain.rejected },
      discard: { ...discard.stats, rejectedRuns: discard.rejected },
    };
    logResult(
      v.label,
      `retain ${retain.stats.mean.toFixed(1)} B/op ± ${retain.stats.stddev.toFixed(1)} (cv ${retain.stats.cv}%)`,
      `| discard floor ${discard.stats.mean.toFixed(1)} B/op`
    );
  }

  // Derived scaling on the retain (escaping-gross) figures.
  const s = report.variants.static?.retain.mean ?? 0;
  const d2 = report.variants.depth2?.retain.mean ?? 0;
  const d8 = report.variants.depth8?.retain.mean ?? 0;
  report.derived = {
    paramOverheadVsStatic_depth2: Math.round((d2 - s) * 10) / 10,
    paramOverheadVsStatic_depth8: Math.round((d8 - s) * 10) / 10,
    perAddedSegment_depth2to8: Math.round(((d8 - d2) / 6) * 10) / 10,
  };
  logResult('Param overhead vs static (depth-2)', `${report.derived.paramOverheadVsStatic_depth2} B/op`);
  logResult('Param overhead vs static (depth-8)', `${report.derived.paramOverheadVsStatic_depth8} B/op`);
  logResult('Per added segment (depth-2→8)', `${report.derived.perAddedSegment_depth2to8} B/op`);

  const resultsDir = join(RESULTS_DIR, `param-match-alloc-${timestamp()}`);
  ensureDir(resultsDir);
  saveResults(resultsDir, 'param-match-alloc.json', report);
  logResult('Saved to', resultsDir);
}

try {
  main();
} catch (err) {
  logError(String(err?.stack ?? err));
  process.exit(1);
}
