/**
 * Counterbalanced (rotated) cross-framework measurement — split out of
 * `bench-exec.js` to keep that file under the repo's 300-line cap
 * (`fix-benchmark-position-bias`).
 *
 * A direct A/B on this harness showed the framework measured FIRST in an
 * invocation scores materially lower than the same framework measured later
 * — reversible by swapping which framework goes first. `runRotatedComparison`
 * counterbalances this: every framework's server restarts once per repeat,
 * and which framework occupies which position rotates across repeats, so the
 * position effect lands equally on every framework's mean instead of being
 * concentrated on whichever framework a fixed order always starts first.
 */

import { METRICS_INTERVAL_MS } from '../config/constants.js';
import { getScenario } from '../config/scenarios.js';
import {
  aggregateLatency,
  analyzeCpuSamples,
  analyzeGcEvents,
  analyzeMemorySamples,
  analyzeSampleCoverage,
  MIN_SAMPLE_COVERAGE_PCT,
  computeStats,
  filterValidRuns,
  log,
  logError,
  logHeader,
  logResult,
  logStep,
  logWarn,
  isInvalidRun,
  sleep,
  startMetricsSampling,
  startServer,
  stopServer,
} from './utils.js';
import { buildUrl, cleanupWrkScripts, runBenchmark, warmup, warmupScenario } from './bench-exec.js';
import { connectionsForScenario } from './lib/scenario-connections.js';

/**
 * Run ONE measurement pass for one framework: start -> warm -> per-scenario
 * per-concurrency SINGLE run -> memory/GC -> stop. A pass restarts the server
 * process every call, deliberately — this is what lets rotation counterbalance
 * measurement position (see module doc comment).
 */
async function benchmarkFrameworkOnePass(tool, framework, opts) {
  const { port, scenarios, connections, duration, threads, profile, pinCores, clientPinCores, traceGc, runId } = opts;
  const results = { framework: framework.name, scenarios: {} };

  const warmupFailures = [];
  let serverHandle;
  try {
    logStep(`Starting ${framework.name} server...`);
    serverHandle = await startServer(framework.file, port, { traceGc, pinCores });
    logStep(`Server started (PID: ${serverHandle.child.pid})`);

    logStep(`Warming up framework (${profile.warmupDuration})...`);
    await warmup(tool, profile.warmupDuration, port, warmupFailures);

    const metrics = startMetricsSampling(serverHandle.child.pid, METRICS_INTERVAL_MS);

    for (const scenario of scenarios) {
      logStep(`Scenario: ${scenario.name}`);
      await warmupScenario(tool, scenario, profile.scenarioWarmupDuration, port, runId, warmupFailures);

      const scenarioResults = { scenario: scenario.name, scenarioId: scenario.id, concurrencyResults: {} };

      for (const conn of connectionsForScenario(scenario, connections)) {
        log(`  Connections: ${conn}`);
        const result = await runBenchmark(tool, {
          url: buildUrl(scenario, port),
          connections: conn,
          threads,
          duration,
          scenario,
          clientPinCores,
          runId,
        });
        if (isInvalidRun(scenario, result)) {
          logWarn(`    Non-2xx (${result.errors.nonOk}) in a success scenario — run excluded from stats.`);
        }
        logResult('    RPS', Math.round(result.rps).toLocaleString());
        logResult('    Latency p50', result.latency.p50 || 'N/A');
        logResult('    Latency p99', result.latency.p99 || 'N/A');

        scenarioResults.concurrencyResults[conn] = { connections: conn, run: result };
      }

      results.scenarios[scenario.id] = scenarioResults;
      await sleep(profile.pauseBetweenTestsMs);
    }

    if (warmupFailures.length > 0) results.warmupFailures = warmupFailures;

    const samples = metrics.stop();
    results.memory = analyzeMemorySamples(samples);
    results.cpu = analyzeCpuSamples(samples);
    results.gc = analyzeGcEvents(serverHandle.gcEvents);
    results.sampleCoverage = analyzeSampleCoverage(samples, METRICS_INTERVAL_MS);
  } catch (err) {
    logError(`Failed benchmarking ${framework.name}: ${err.message}`);
    results.error = err.message;
  } finally {
    if (serverHandle) {
      logStep(`Stopping ${framework.name} server...`);
      await stopServer(serverHandle);
    }
  }

  return results;
}

/**
 * Merge `runs` single-pass results into the shape the report generator
 * already expects. Stat computation (mean/stddev/CV, invalid-run exclusion,
 * latency aggregation) is IDENTICAL to the pre-rotation code — only WHERE the
 * repeats come from changed, not how they are combined.
 */
function mergePassResults(passResults, framework, frameworkId) {
  const merged = { framework: framework.name, frameworkId, scenarios: {} };
  const first = passResults[0];
  if (!first || first.error) {
    return { ...merged, error: first?.error ?? 'no passes completed' };
  }

  for (const scenarioId of Object.keys(first.scenarios)) {
    const scenarioMeta = first.scenarios[scenarioId];
    const scenarioResults = { scenario: scenarioMeta.scenario, scenarioId, concurrencyResults: {} };

    for (const conn of Object.keys(scenarioMeta.concurrencyResults)) {
      // The REAL scenario object, not a `{ id }` stand-in. `isInvalidRun` exempts
      // error scenarios by reading `expectStatus`, so a reconstructed object
      // without it counted every expected 500 as a non-2xx failure and marked
      // every `error-handling` cell `allInvalid` — in rotation mode only, which
      // is the mode publishable comparisons use (audit F-21).
      const scenario = getScenario(scenarioId) ?? { id: scenarioId };
      const runResults = passResults
        .filter((p) => !p.error)
        .map((p) => p.scenarios[scenarioId]?.concurrencyResults[conn]?.run)
        .filter(Boolean);

      const { valid, anyInvalid, allInvalid } = filterValidRuns(scenario, runResults);
      const measured = valid.length ? valid : runResults;
      const stats = computeStats(measured.map((r) => r.rps));
      const latency = aggregateLatency(measured);

      scenarioResults.concurrencyResults[conn] = {
        connections: Number(conn),
        runs: runResults,
        validRuns: valid.length,
        stats,
        latency,
        invalid: anyInvalid,
        allInvalid,
        summary: {
          rpsMean: stats.mean,
          rpsStddev: stats.stddev,
          rpsMin: stats.min,
          rpsMax: stats.max,
          cv: stats.cv,
        },
      };
    }

    merged.scenarios[scenarioId] = scenarioResults;
  }

  // Memory/CPU/GC: average the per-pass summaries rather than re-deriving
  // from raw samples, since each pass sampled its own independent process.
  const passesWithMetrics = passResults.filter((p) => !p.error && p.memory);
  merged.memory = averageMetric(passesWithMetrics, 'memory');
  merged.cpu = averageMetric(passesWithMetrics, 'cpu');
  merged.gc = averageMetric(passesWithMetrics, 'gc');
  // Coverage is averaged like the rest, then `starved` re-derived from the
  // averaged percentage — a boolean cannot be meaningfully averaged.
  const coverage = averageMetric(
    passResults.filter((p) => !p.error && p.sampleCoverage),
    'sampleCoverage'
  );
  if (coverage) {
    merged.sampleCoverage = {
      ...coverage,
      starved: (coverage.coveragePct ?? 0) < MIN_SAMPLE_COVERAGE_PCT,
    };
  }

  // Warmup failures: collect unique failures across passes
  const allFailures = passResults
    .filter((p) => !p.error && p.warmupFailures)
    .flatMap((p) => p.warmupFailures);
  if (allFailures.length > 0) {
    merged.warmupFailures = [...new Set(allFailures)];
  }

  return merged;
}

const BYTE_UNIT_FACTOR = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824 };

/** Parse a `formatBytes()` string ("150.0 MB") back into a byte count for comparison. */
function parseFormattedBytes(text) {
  const match = /^([\d.]+)\s*(B|KB|MB|GB)$/.exec(String(text ?? '').trim());
  if (!match) return null;
  return parseFloat(match[1]) * BYTE_UNIT_FACTOR[match[2]];
}

/**
 * Average a named per-pass metric object's numeric fields across passes.
 *
 * `rssPeak` is special-cased to the maximum across passes rather than their
 * mean — "peak" means the highest value observed, and averaging per-pass
 * maxima together produces a number that is neither a mean nor a maximum.
 * `rssPeak` is stored as a formatted string ("150.0 MB"), not a raw number,
 * so it is compared by parsed byte magnitude and the winning pass's own
 * formatted string is kept (never re-formatted or numerically merged).
 */
export function averageMetric(passes, key) {
  if (passes.length === 0) return undefined;
  const keys = Object.keys(passes[0][key] ?? {});
  const out = {};
  for (const k of keys) {
    if (k === 'rssPeak') {
      const withBytes = passes
        .map((p) => ({ raw: p[key]?.[k], bytes: parseFormattedBytes(p[key]?.[k]) }))
        .filter((v) => v.bytes !== null);
      out[k] = withBytes.length
        ? withBytes.reduce((max, cur) => (cur.bytes > max.bytes ? cur : max)).raw
        : passes[0][key]?.[k];
      continue;
    }
    const values = passes.map((p) => p[key]?.[k]).filter((v) => typeof v === 'number');
    out[k] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : passes[0][key]?.[k];
  }
  return out;
}

/**
 * Round-robin left-rotation: `rotate([a,b,c], 1) === [b,c,a]`.
 *
 * Chosen over reshuffling randomly every repeat because rotation guarantees
 * EXACT position balance when `runs` is a multiple of the framework count.
 *
 * It does NOT give near-balance otherwise, which an earlier version of this
 * comment claimed: with 6 frameworks and `runs: 3` each framework visits only 3
 * of the 6 positions, and mean position spreads across a 3-slot range (measured
 * on run 2026-07-30T18-14-52: fastify 1.0, nextrush 2.0, hono 2.0, raw-node 3.0,
 * koa 3.0, express 4.0). `derivePublishable` therefore refuses to stamp a
 * cross-framework ranking publishable unless `runs % frameworkCount === 0`
 * (audit F-22).
 */
export function rotate(items, offset) {
  const n = items.length;
  if (n === 0) return [];
  const shift = ((offset % n) + n) % n;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

/**
 * Run a full counterbalanced comparison: `runs` repeats, each restarting
 * every framework's server, with framework order rotated per repeat so every
 * framework occupies every measurement position an equal (±1) number of
 * times across the full set of repeats.
 *
 * @returns {Promise<{ resultsByFramework: Record<string, object>, positionLog: Array<{ repeat: number, order: string[] }> }>}
 */
export async function runRotatedComparison(tool, frameworksById, frameworkIds, opts) {
  const { runs, ...passOpts } = opts;
  const passesByFramework = {};
  for (const id of frameworkIds) passesByFramework[id] = [];

  const positionLog = [];
  for (let repeat = 0; repeat < runs; repeat++) {
    const order = rotate(frameworkIds, repeat);
    positionLog.push({ repeat, order: [...order] });

    for (const frameworkId of order) {
      logHeader(`Benchmarking: ${frameworksById[frameworkId].name} (repeat ${repeat + 1}/${runs})`);
      const pass = await benchmarkFrameworkOnePass(tool, frameworksById[frameworkId], passOpts);
      passesByFramework[frameworkId].push(pass);

      const isVeryLastPass = repeat === runs - 1 && order.indexOf(frameworkId) === order.length - 1;
      if (!isVeryLastPass) await sleep(opts.profile.cooldownMs);
    }
  }

  const resultsByFramework = {};
  for (const id of frameworkIds) {
    resultsByFramework[id] = mergePassResults(passesByFramework[id], frameworksById[id], id);
  }

  if (opts.runId) cleanupWrkScripts(opts.runId);

  return { resultsByFramework, positionLog };
}
