#!/usr/bin/env node

/**
 * Response-construction allocation and latency micro-benchmark — the spike for the
 * `bun-response-cost` change.
 *
 * `WebResponseBuilder` allocates a `Headers` instance per request, writes the default
 * `Content-Type` into it, and hands it to `new Response(body, { status, headers })`. A Bun
 * profile attributes 18.7 % self to `Response`, but that figure spans the constructor, the
 * header copy and the body write. This harness holds the body constant and varies only the
 * header record, so a header-record win is distinguishable from the constructor floor — and
 * so a null result is a finding rather than a surprise.
 *
 * Each variant × shape runs in its own `--expose-gc` child, under every requested runtime,
 * reporting retained bytes/response, ns/response, and the run-to-run spread. Runs that see a
 * collection inside the measured window are rejected and retried (matching
 * `handler-alloc.js` / `param-match-alloc.js`).
 *
 * The verdict printed here is about the SPIKE, not adoption: it says whether a header-record
 * variant is cheaper by more than the measurement's own spread. Adoption is decided by the
 * `dev-check` in-process ratio, because this harness measures one response in isolation and
 * cannot see the rest of the request.
 *
 * Usage:
 *   node scripts/alloc/response-construction-alloc.js --runtime bun --runtime node
 *   node scripts/alloc/response-construction-alloc.js --runs 5 --n 50000
 *   node scripts/alloc/response-construction-alloc.js --shape default
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { computeStats } from '../lib/stats.js';
import { RESULTS_DIR } from '../lib/paths.js';
import { ensureDir, saveResults } from '../lib/fsx.js';
import { timestamp } from '../lib/time.js';
import { logError, logHeader, logResult, logStep, parseArgs } from '../utils.js';

const RUNTIME_BINS = { node: process.execPath, bun: 'bun' };
const VARIANTS = ['current', 'literal', 'shared-frozen', 'pairs', 'json', 'pre-serialized'];
const SHAPES = ['default', 'one-extra', 'cookies'];
const RECORD_VARIANTS = ['literal', 'shared-frozen', 'pairs'];
/** Shapes whose extra headers repeat a field name; object-literal variants cannot express them. */
const SHAPE_HAS_REPEATED_FIELD = { default: false, 'one-extra': false, cookies: true };
/** Variants that need every field name to be unique. */
const UNIQUE_FIELD_ONLY = new Set(['literal', 'shared-frozen', 'pre-serialized']);
const MAX_RETRIES = 5;
const DEFAULT_RUNS = 3;
const DEFAULT_N = 20_000;
const DEFAULT_SEMI = 256;

const CHILD_SCRIPT = join(import.meta.dirname, 'response-construction-alloc-child.js');

/**
 * Repeatable flags.
 *
 * `parseArgs` keeps the last value of a repeated `--flag`, which silently collapsed
 * `--runtime bun --runtime node` to `node`. Reading `process.argv` here keeps the harness's
 * own multi-value contract explicit rather than changing a shared parser other scripts
 * depend on.
 */
function collectRepeated(flag) {
  const values = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === `--${flag}`) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        values.push(next);
        i++;
      }
    } else if (arg.startsWith(`--${flag}=`)) {
      values.push(arg.slice(flag.length + 3));
    }
  }
  return values;
}

const args = parseArgs();
const runs = args.runs ? Number.parseInt(String(args.runs), 10) : DEFAULT_RUNS;
const N = args.n ? Number.parseInt(String(args.n), 10) : DEFAULT_N;
const SEMI = args.semi ? Number.parseInt(String(args.semi), 10) : DEFAULT_SEMI;
const VERIFY_GC = Boolean(args['verify-gc']);
const requestedRuntimes = collectRepeated('runtime');
const RUNTIMES = requestedRuntimes.length > 0 ? requestedRuntimes : ['node'];
const requestedShapes = collectRepeated('shape');
const SHAPES_TO_RUN = requestedShapes.length > 0 ? requestedShapes : SHAPES;

for (const runtime of RUNTIMES) {
  if (RUNTIME_BINS[runtime] === undefined) {
    throw new Error(`unknown runtime "${runtime}"; expected node or bun`);
  }
}
for (const shape of SHAPES_TO_RUN) {
  if (!SHAPES.includes(shape)) {
    throw new Error(`unknown shape "${shape}"; expected one of ${SHAPES.join(', ')}`);
  }
}

/** Node gets `--trace-gc` for the calibration brackets; Bun has no equivalent flag. */
function nodeArgs(runtime, semi) {
  if (runtime === 'bun') return ['--expose-gc'];
  const flags = ['--expose-gc', `--max-semi-space-size=${semi}`];
  if (VERIFY_GC) flags.push('--trace-gc');
  return flags;
}

/** Count collections `--trace-gc` printed between the child's bracket markers. */
function countGcInWindow(stderr) {
  let inWindow = false;
  let count = 0;
  for (const line of String(stderr).split('\n')) {
    if (line.includes('MEASURE_START')) inWindow = true;
    else if (line.includes('MEASURE_END')) inWindow = false;
    else if (inWindow && /\b(Scavenge|Mark-Compact|Mark-sweep)\b/.test(line)) count++;
  }
  return count;
}

function runOnce(runtime, variant, shape) {
  const result = spawnSync(
    RUNTIME_BINS[runtime],
    [...nodeArgs(runtime, SEMI), CHILD_SCRIPT, variant, shape, String(N)],
    { encoding: 'utf-8', env: { ...process.env, NODE_ENV: 'production' } }
  );

  if (result.error) {
    throw new Error(`${runtime} could not run the child: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `response-construction-alloc-child.js failed for ${runtime}/${variant}/${shape}: ` +
        `${result.stderr || result.stdout}`
    );
  }

  const line = result.stdout.trim().split('\n').pop();
  const parsed = JSON.parse(line);
  // Bun has no `--trace-gc`; its window is unverified and reported as such. Without
  // `--verify-gc` Node is unverified too, rather than claimed clean.
  const gcInWindow = VERIFY_GC && runtime === 'node' ? countGcInWindow(result.stderr) : null;
  return { ...parsed, gcInWindow };
}

/**
 * Collect `runs` samples for one variant × shape.
 *
 * With `--verify-gc`, a sample whose window saw a collection is rejected and retried. A
 * retaining loop of N responses necessarily promotes them, so a zero-collection window is
 * not always attainable; after `MAX_RETRIES` the sample is kept and marked
 * `gcVerified: false` rather than failing the run. That is honest — the figure is a
 * comparison between variants that all retain the same objects, so the collection cost is
 * common-mode — but it is never silently reported as clean.
 */
function measure(runtime, variant, shape) {
  const samples = [];
  let rejected = 0;
  let unverified = 0;

  for (let i = 0; i < runs; i++) {
    let sample = runOnce(runtime, variant, shape);

    if (VERIFY_GC && (sample.gcInWindow ?? 0) > 0) {
      for (let attempt = 0; attempt < MAX_RETRIES && (sample.gcInWindow ?? 0) > 0; attempt++) {
        rejected++;
        sample = runOnce(runtime, variant, shape);
      }
      if ((sample.gcInWindow ?? 0) > 0) unverified++;
    }

    samples.push(sample);
  }

  const first = samples[0];
  return {
    bytes: computeStats(samples.map((s) => s.bytesPerOp)),
    externalBytes: computeStats(samples.map((s) => s.externalBytesPerOp)),
    ns: computeStats(samples.map((s) => s.nsPerOp)),
    gcVerified: first.gcInWindow === null ? null : unverified === 0,
    rejected,
    unverifiedRuns: unverified,
  };
}

/**
 * A delta is only treated as a real gap when it clears BOTH the samples' combined spread
 * and a floor tied to the thing being measured.
 *
 * The floor matters more than the spread here. Run-to-run variance on these figures is
 * fractions of a byte, so a −0.1 B/req difference can clear its own spread while being
 * meaningless: a `Headers` instance with one entry is tens of bytes, so anything below a
 * byte per response cannot be the header record. Without a floor the harness reports
 * measurement precision as if it were an effect.
 */
const MIN_EFFECT_BYTES = 8;

function isRealGap(delta, spread) {
  return delta < 0 && Math.abs(delta) > spread && Math.abs(delta) >= MIN_EFFECT_BYTES;
}

function fmt(value, digits = 1) {
  return Number(value).toFixed(digits);
}

/**
 * Confirm every variant produces the same status, `Content-Type` and body as `current`.
 *
 * A perf comparison between variants with different output is meaningless, and the
 * object-literal forms are exactly the ones at risk: both runtimes silently join a repeated
 * header field. This runs in a child, through the same entry point as the measurement, so it
 * checks the code being measured rather than a reimplementation of it.
 */
function assertOutputEquivalent(runtime) {
  const result = spawnSync(RUNTIME_BINS[runtime], [CHILD_SCRIPT, 'verify-output', String(N)], {
    encoding: 'utf-8',
    env: { ...process.env, NODE_ENV: 'production' },
  });

  if (result.error) {
    throw new Error(`${runtime} could not run the output check: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${runtime} output check failed: ${result.stderr || result.stdout}`);
  }

  const line = result.stdout.trim().split('\n').pop();
  const report = JSON.parse(line);
  if (!report.equivalent) {
    throw new Error(`${runtime} output check FAILED: ${JSON.stringify(report.mismatches)}`);
  }
  return report;
}

function main() {
  logHeader('Response-construction spike — header record vs constructor vs JSON fast path');
  logResult('Runs per variant', runs);
  logResult('Responses per run (N)', N.toLocaleString());
  logResult('Runtimes', RUNTIMES.join(', '));
  logResult('Shapes', SHAPES_TO_RUN.join(', '));
  logResult('Semi-space (Node)', `${SEMI} MB`);
  logResult('GC verification', VERIFY_GC ? 'on (Node: --trace-gc window brackets)' : 'off');

  const report = {
    timestamp: new Date().toISOString(),
    runs,
    responsesPerRun: N,
    semiSpaceMb: SEMI,
    method: {
      footprint:
        'heapUsed allocation rate over a RETAINING loop, no collection before the second snapshot',
      timing: 'non-retaining loop; GC runs uncontrolled, so spread is reported and it never gates',
      gate: 'This harness does not decide adoption. The gate is the same-run dev-check inproc ratio.',
      gcVerification: VERIFY_GC
        ? {
            node: '--trace-gc window brackets between the markers; dirty runs retried, then marked unverified',
            bun: 'no --trace-gc equivalent; the window is unverified',
          }
        : 'off — pass --verify-gc to count collections inside the window',
    },
    runtimes: {},
  };

  const verdicts = [];

  for (const runtime of RUNTIMES) {
    report.runtimes[runtime] = {};

    const equivalence = assertOutputEquivalent(runtime);
    logResult(`[${runtime}] output equivalence`, `verified across ${equivalence.checked} variants`);

    // One result directory per runtime, so the two runs never overwrite each other.
    const resultsDir = join(RESULTS_DIR, `response-construction-alloc-${runtime}-${timestamp()}`);
    ensureDir(resultsDir);

    for (const shape of SHAPES_TO_RUN) {
      logStep(`[${runtime}] shape=${shape}`);

      const applicable = VARIANTS.filter(
        (variant) => !(UNIQUE_FIELD_ONLY.has(variant) && SHAPE_HAS_REPEATED_FIELD[shape])
      );
      const skipped = VARIANTS.filter((variant) => !applicable.includes(variant));
      if (skipped.length > 0) {
        logResult(
          '  skipped',
          skipped.join(', '),
          '(object-literal init cannot carry a repeated header field)'
        );
      }

      const byVariant = {};
      for (const variant of applicable) {
        byVariant[variant] = measure(runtime, variant, shape);
        const { bytes, ns, gcVerified } = byVariant[variant];
        logResult(
          `  ${variant.padEnd(14)}`,
          `${fmt(bytes.mean).padStart(8)} B/req ± ${fmt(bytes.stddev)}`,
          `${fmt(ns.mean, 0).padStart(6)} ns/req`,
          `(cv ${bytes.cv}% / ${ns.cv}%)${gcVerified === false ? ' [gc unverified]' : ''}`
        );
      }

      const current = byVariant.current;
      const deltas = {};
      for (const variant of applicable) {
        if (variant === 'current') continue;
        const record = byVariant[variant];
        const bytesDelta = record.bytes.mean - current.bytes.mean;
        const nsDelta = record.ns.mean - current.ns.mean;
        const spread = current.bytes.stddev + record.bytes.stddev;
        deltas[variant] = {
          bytesDelta: Number(bytesDelta.toFixed(1)),
          nsDelta: Number(nsDelta.toFixed(1)),
          combinedStddev: Number(spread.toFixed(1)),
          bytesCheaperBeyondSpread: isRealGap(bytesDelta, spread),
        };
        const beyondSpread = Math.abs(bytesDelta) > spread;
        logResult(
          `  Δ ${variant.padEnd(12)}`,
          `${bytesDelta <= 0 ? '−' : '+'}${fmt(Math.abs(bytesDelta))} B/req`,
          `${nsDelta <= 0 ? '−' : '+'}${fmt(Math.abs(nsDelta), 0)} ns/req`,
          deltas[variant].bytesCheaperBeyondSpread
            ? `(cheaper beyond ±${fmt(spread)} spread and ≥${MIN_EFFECT_BYTES} B floor)`
            : beyondSpread
              ? `(beyond ±${fmt(spread)} spread but below the ${MIN_EFFECT_BYTES} B effect floor)`
              : `(within ±${fmt(spread)} spread)`
        );
      }

      report.runtimes[runtime][shape] = {
        variants: Object.fromEntries(
          Object.entries(byVariant).map(([name, value]) => [
            name,
            {
              bytes: value.bytes,
              externalBytes: value.externalBytes,
              ns: value.ns,
              gcVerified: value.gcVerified,
              rejectedRuns: value.rejected,
              unverifiedRuns: value.unverifiedRuns,
            },
          ])
        ),
        deltasVsCurrent: deltas,
      };

      for (const variant of RECORD_VARIANTS) {
        if (deltas[variant] === undefined) continue;
        verdicts.push({
          runtime,
          shape,
          variant,
          ...deltas[variant],
        });
      }
    }

    saveResults(resultsDir, 'response-construction-alloc.json', {
      ...report,
      runtimes: { [runtime]: report.runtimes[runtime] },
    });
    logResult(`Saved [${runtime}]`, resultsDir);
  }

  const wins = verdicts.filter((v) => v.bytesCheaperBeyondSpread);

  logResult('Record variants cheaper beyond spread', `${wins.length} of ${verdicts.length}`);
  if (wins.length > 0) {
    for (const win of wins) {
      logResult(
        '  win',
        `[${win.runtime}] ${win.shape} / ${win.variant}`,
        `${win.bytesDelta} B/req beyond ±${win.combinedStddev}`
      );
    }
  }

  logResult(
    'Verdict',
    wins.length > 0
      ? 'a header-record variant allocates less by a real margin — the builder change has a target'
      : verdicts.some((v) => v.bytesDelta < 0)
        ? 'record variants differ only within the spread or below the effect floor — no measurable allocation gap; a builder rewrite is not justified'
        : 'no header-record variant allocates less — the change is a null result on allocation'
  );
}

try {
  main();
} catch (error) {
  logError(String(error?.message ?? error));
  process.exit(1);
}
