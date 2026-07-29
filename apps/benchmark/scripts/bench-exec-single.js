/**
 * Single-framework, internally-repeating measurement loop — split out of
 * `bench-exec.js` to keep that file under the repo's 300-line cap once
 * rotation support (`fix-benchmark-position-bias`) was added there.
 *
 * Used only when a caller measures ONE framework with no cross-framework
 * ranking, so there is no position bias to counterbalance and no reason to
 * pay rotation's per-repeat server-restart cost. A comparison across multiple
 * frameworks uses `runRotatedComparison` in `bench-exec.js` instead.
 */

import { METRICS_INTERVAL_MS } from '../config/constants.js';
import {
  aggregateLatency,
  analyzeCpuSamples,
  analyzeGcEvents,
  analyzeMemorySamples,
  computeStats,
  filterValidRuns,
  isInvalidRun,
  log,
  logError,
  logResult,
  logStep,
  logWarn,
  sleep,
  startMetricsSampling,
  startServer,
  stopServer,
} from './utils.js';
import { buildUrl, runBenchmark, warmup, warmupScenario } from './bench-exec.js';

export async function benchmarkFramework(tool, framework, opts) {
  const { frameworkId, port, scenarios, connections, runs, duration, threads, profile, pinCores, clientPinCores, traceGc } =
    opts;
  const results = { framework: framework.name, frameworkId, scenarios: {} };

  let serverHandle;
  try {
    logStep(`Starting ${framework.name} server...`);
    serverHandle = await startServer(framework.file, port, { traceGc, pinCores });
    logStep(`Server started (PID: ${serverHandle.child.pid})`);

    logStep(`Warming up framework (${profile.warmupDuration})...`);
    await warmup(tool, profile.warmupDuration, port);

    const metrics = startMetricsSampling(serverHandle.child.pid, METRICS_INTERVAL_MS);

    for (const scenario of scenarios) {
      logStep(`Scenario: ${scenario.name}`);
      await warmupScenario(tool, scenario, profile.scenarioWarmupDuration, port);

      const scenarioResults = { scenario: scenario.name, scenarioId: scenario.id, concurrencyResults: {} };

      for (const conn of connections) {
        log(`  Connections: ${conn}`);
        const runResults = [];

        for (let run = 0; run < runs; run++) {
          log(`    Run ${run + 1}/${runs}...`, 'dim');
          const result = await runBenchmark(tool, {
            url: buildUrl(scenario, port),
            connections: conn,
            threads,
            duration,
            scenario,
            clientPinCores,
          });
          if (isInvalidRun(scenario, result)) {
            logWarn(`    Non-2xx (${result.errors.nonOk}) in a success scenario — run excluded from stats.`);
          }
          runResults.push(result);
          logResult('    RPS', Math.round(result.rps).toLocaleString());
          logResult('    Latency p50', result.latency.p50 || 'N/A');
          logResult('    Latency p99', result.latency.p99 || 'N/A');
          if (runs > 1 && run < runs - 1) await sleep(profile.pauseBetweenTestsMs);
        }

        // Invalid runs (non-2xx in a success scenario) are EXCLUDED from the mean
        // so fast errors never inflate RPS (audit F-H01). If every run was invalid,
        // fall back to the raw set so the point still reports a (flagged) number.
        const { valid, anyInvalid, allInvalid } = filterValidRuns(scenario, runResults);
        const measured = valid.length ? valid : runResults;
        const stats = computeStats(measured.map((r) => r.rps));
        const latency = aggregateLatency(measured); // median across runs (audit F-M04)

        scenarioResults.concurrencyResults[conn] = {
          connections: conn,
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

        if (runs > 1) {
          logResult(
            '    Mean RPS',
            `${Math.round(stats.mean).toLocaleString()} ± ${Math.round(stats.stddev).toLocaleString()}`,
            `(CV: ${stats.cv}%)${anyInvalid ? ` ⚠️ ${valid.length}/${runResults.length} valid` : ''}`
          );
        }
      }

      results.scenarios[scenario.id] = scenarioResults;
      await sleep(profile.pauseBetweenTestsMs);
    }

    const samples = metrics.stop();
    results.memory = analyzeMemorySamples(samples);
    results.cpu = analyzeCpuSamples(samples);
    results.gc = analyzeGcEvents(serverHandle.gcEvents);
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
